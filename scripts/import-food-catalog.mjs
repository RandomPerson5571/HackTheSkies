import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  cuisines,
  mealDbAreas,
} from "../packages/food-catalog/src/cuisines.ts";
import { seedDishes } from "../packages/food-catalog/data/seeds.ts";
import { cuisineRegions } from "../packages/food-catalog/src/cuisines.ts";
import { findCommonsPhotos } from "./lib/commons-photos.mjs";
import { mobileImageManifest } from "./lib/mobile-image-manifest.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const defaultOutput = resolve(root, "packages/food-catalog/data/catalog.ts");
const defaultReport = resolve(
  root,
  "packages/food-catalog/data/import-report.json",
);

function dishKey(name, cuisine) {
  return `${cuisine}:${name.normalize("NFKD").replace(/\p{M}/gu, "").trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function safeUrl(value, hosts) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.includes(url.hostname)
      ? url.href
      : null;
  } catch {
    return null;
  }
}

async function requestJson(fetcher, url, options) {
  const response = await fetcher(url, {
    ...options,
    signal: AbortSignal.timeout(15_000),
  });
  // Do not include request URLs or headers in errors: API keys can be in either.
  if (!response.ok)
    throw new Error(
      `Catalog provider returned HTTP ${response.status}. Existing catalog was not replaced.`,
    );
  return response.json();
}

export async function buildCatalog({
  fetcher = fetch,
  apiKey = process.env.THEMEALDB_API_KEY || "1",
  pexelsKey = "",
  offline = false,
  limitPerArea = 25,
  previous = [],
  commonsPhotos = false,
  onProgress = () => {},
} = {}) {
  if (
    limitPerArea !== null &&
    (!Number.isSafeInteger(limitPerArea) ||
      limitPerArea < 1 ||
      limitPerArea > 100)
  ) {
    throw new Error("limitPerArea must be an integer from 1 to 100.");
  }
  const foods = structuredClone(seedDishes);
  const byKey = new Map(
    foods.map((food) => [dishKey(food.name, food.cuisine), food]),
  );
  const report = {
    mode: offline ? "offline" : "themealdb",
    availableAreas: [],
    unmappedAreas: [],
    unsupportedAreas: {},
    emptyAreas: [],
    counts: {},
    missingImages: [],
    unreviewedImages: [],
    photoErrors: [],
    providerAreaCounts: {},
    limitPerArea,
  };
  if (!offline) {
    const base = `https://www.themealdb.com/api/json/v1/${encodeURIComponent(apiKey)}/`;
    const areaData = await requestJson(fetcher, `${base}list.php?a=list`);
    if (
      !Array.isArray(areaData.meals) ||
      !areaData.meals.length ||
      areaData.meals.some(
        (area) => typeof area.strArea !== "string" || !area.strArea.trim(),
      )
    ) {
      throw new Error(
        "Invalid area list from TheMealDB. Existing catalog was not replaced.",
      );
    }
    const available = new Set(areaData.meals.map((area) => area.strArea));
    const mapped = new Set(Object.values(mealDbAreas).flat());
    report.availableAreas = [...available].sort();
    report.unmappedAreas = [...available]
      .filter((area) => !mapped.has(area))
      .sort();
    for (const cuisine of cuisines) {
      report.unsupportedAreas[cuisine] = mealDbAreas[cuisine].filter(
        (area) => !available.has(area),
      );
      for (const area of mealDbAreas[cuisine].filter((area) =>
        available.has(area),
      )) {
        const data = await requestJson(
          fetcher,
          `${base}filter.php?a=${encodeURIComponent(area)}`,
        );
        if (data.meals !== null && !Array.isArray(data.meals)) {
          throw new Error(
            "Invalid meal list from TheMealDB. Existing catalog was not replaced.",
          );
        }
        if (!data.meals?.length) report.emptyAreas.push(area);
        report.providerAreaCounts[area] = data.meals?.length ?? 0;
        // Stable selection makes repeated imports independent of provider ordering.
        const meals = (data.meals ?? [])
          .map((meal) => {
            if (
              typeof meal.idMeal !== "string" ||
              !/^\d+$/.test(meal.idMeal) ||
              typeof meal.strMeal !== "string" ||
              !meal.strMeal.trim()
            ) {
              throw new Error(
                "Invalid meal from TheMealDB. Existing catalog was not replaced.",
              );
            }
            return meal;
          })
          .sort((a, b) => a.idMeal.localeCompare(b.idMeal))
          .slice(0, limitPerArea ?? undefined);
        for (const meal of meals) {
          const key = dishKey(meal.strMeal, cuisine);
          const sourceUrl = `https://www.themealdb.com/meal.php?c=${meal.idMeal}`;
          let food = byKey.get(key);
          if (!food) {
            food = {
              id: `${cuisine.toLowerCase().replace(/\s+/g, "-")}:themealdb:${meal.idMeal}`,
              name: meal.strMeal.trim(),
              cuisine,
              cuisineIds: [cuisine],
              regions: [],
              note: `A dish listed under ${area} by TheMealDB.`,
              source: "themealdb",
              sourceUrl,
            };
            foods.push(food);
            byKey.set(key, food);
          }
          food.providerIds = [
            ...new Set([...(food.providerIds ?? []), meal.idMeal]),
          ];
          food.providerAreas = [
            ...new Set([...(food.providerAreas ?? []), area]),
          ];
          const url = safeUrl(meal.strMealThumb, [
            "www.themealdb.com",
            "themealdb.com",
          ]);
          if (url && !food.image)
            food.image = {
              url,
              source: "themealdb",
              sourceUrl,
              photographer: null,
              photographerUrl: null,
              licenseUrl: "https://www.themealdb.com/terms.php",
              attribution: "Recipe and image from TheMealDB",
              reviewed: false,
            };
        }
      }
    }
    onProgress(
      `Collected ${foods.length} dishes from all mapped provider areas.`,
    );
  }
  const previousByKey = new Map(
    previous.map((food) => [dishKey(food.name, food.cuisine), food]),
  );
  for (const food of foods) {
    const old = previousByKey.get(dishKey(food.name, food.cuisine));
    // Preserve an explicitly reviewed selection when refreshing provider data.
    if (
      old?.image &&
      (old.image.reviewed || !food.image || old.image.url === food.image.url)
    )
      food.image = structuredClone(old.image);
    if (
      food.image?.source === "wikimedia" &&
      food.image.licenseName === "Public domain" &&
      food.image.licenseUrl ===
        "https://creativecommons.org/publicdomain/zero/1.0/"
    )
      food.image.licenseUrl =
        "https://creativecommons.org/publicdomain/mark/1.0/";
    if (!offline && pexelsKey && !food.image) {
      const query = `${food.name} ${food.regions.join(" ") || food.cuisine} food`;
      const data = await requestJson(
        fetcher,
        `https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=1`,
        { headers: { Authorization: pexelsKey } },
      );
      if (!Array.isArray(data.photos))
        throw new Error(
          "Invalid Pexels photo response. Existing catalog was not replaced.",
        );
      const photo = data.photos[0];
      const url = safeUrl(photo?.src?.medium, ["images.pexels.com"]);
      const sourceUrl = safeUrl(photo?.url, ["www.pexels.com", "pexels.com"]);
      if (url && sourceUrl && typeof photo.photographer === "string")
        food.image = {
          url,
          source: "pexels",
          sourceUrl,
          photographer: photo.photographer,
          photographerUrl: safeUrl(photo.photographer_url, [
            "www.pexels.com",
            "pexels.com",
          ]),
          licenseUrl: "https://www.pexels.com/license/",
          attribution: `Photo by ${photo.photographer} on Pexels`,
          reviewed: false,
        };
    }
  }
  if (!offline && commonsPhotos) {
    const missing = foods.filter((food) => !food.image);
    const matches = await findCommonsPhotos(missing, { fetcher, onProgress });
    for (const food of missing)
      if (matches.has(food.id)) food.image = matches.get(food.id);
  }
  for (const food of foods) {
    if (!food.image) report.missingImages.push(food.id);
    else if (!food.image.reviewed) report.unreviewedImages.push(food.id);
  }
  report.counts = Object.fromEntries(
    cuisines.map((cuisine) => [
      cuisine,
      foods.filter((food) => food.cuisine === cuisine).length,
    ]),
  );
  return { foods, report };
}

async function writeAtomic(path, content) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.tmp`;
  await writeFile(temporary, content, "utf8");
  await rename(temporary, path);
}

export function catalogMarkdown(foods) {
  const markdownText = (value) =>
    String(value)
      .replace(/[\\`*_{}\[\]<>#]/g, "\\$&")
      .replace(/\s+/g, " ");
  const pictureList = [
    "# Food catalog",
    "",
    `${foods.length} dishes from the available provider catalog and curated starters. Photos are stored locally with source and license credits. Image matches await review.`,
    "",
  ];
  for (const cuisine of cuisines) {
    const group = foods.filter((food) => food.cuisine === cuisine);
    if (!group.length) continue;
    pictureList.push(`## ${cuisine}`, "");
    for (const food of group) {
      pictureList.push(`### ${markdownText(food.name)}`, "");
      if (food.image?.localPath)
        pictureList.push(
          `![${markdownText(food.name)}](${food.image.localPath})`,
          "",
        );
      if (food.regions.length)
        pictureList.push(food.regions.map(markdownText).join(" · "), "");
      if (food.image)
        pictureList.push(
          `[${markdownText(food.image.attribution)}](${food.image.sourceUrl}) · [${markdownText(food.image.licenseName || "Source terms")}](${food.image.licenseUrl})`,
          "",
        );
    }
  }
  return `${pictureList.join("\n")}\n`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      offline: { type: "boolean", default: false },
      photos: { type: "boolean", default: false },
      limit: { type: "string", default: "25" },
      output: { type: "string", default: defaultOutput },
      report: { type: "string", default: defaultReport },
      help: { type: "boolean", default: false },
      all: { type: "boolean", default: false },
      commons: { type: "boolean", default: false },
      json: { type: "string" },
      "download-images": { type: "boolean", default: false },
    },
  });
  if (values.help) {
    console.log(
      "node scripts/import-food-catalog.mjs [--offline] [--photos] [--commons] [--all | --limit 25] [--download-images] [--json catalog.json] [--output catalog.ts] [--report report.json]\nTHEMEALDB_API_KEY defaults to development key 1. --photos requires PEXELS_API_KEY. --commons searches Wikimedia without credentials. --all removes the per-area limit. Image review flags are retained as catalog metadata.",
    );
    return;
  }
  const output = resolve(values.output);
  const reportPath = resolve(values.report);
  const jsonPath = resolve(values.json || output.replace(/\.ts$/, ".json"));
  if (
    !output.endsWith(".ts") ||
    !reportPath.endsWith(".json") ||
    output === reportPath ||
    !jsonPath.endsWith(".json") ||
    jsonPath === reportPath
  )
    throw new Error("Use a .ts catalog output and a separate .json report.");
  if (values.photos && !values.offline && !process.env.PEXELS_API_KEY)
    throw new Error("Set PEXELS_API_KEY to use --photos.");
  let previous = [];
  try {
    await readFile(output);
    previous = (await import(pathToFileURL(output).href)).catalogDishes;
    if (!Array.isArray(previous))
      throw new Error("Existing catalog has no catalogDishes array.");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const { foods, report } = await buildCatalog({
    offline: values.offline,
    pexelsKey: values.photos ? process.env.PEXELS_API_KEY : "",
    limitPerArea: values.all ? null : Number(values.limit),
    previous,
    commonsPhotos: values.commons,
    onProgress: console.log,
  });
  if (values["download-images"]) {
    const imageDirectory = resolve(dirname(output), "images");
    await mkdir(imageDirectory, { recursive: true });
    report.downloadErrors = [];
    let next = 0;
    await Promise.all(
      Array.from({ length: 3 }, async () => {
        while (next < foods.length) {
          const food = foods[next++];
          if (!food.image) continue;
          try {
            if (food.image.localPath) {
              const existing = resolve(dirname(jsonPath), food.image.localPath);
              if (
                existing.startsWith(`${imageDirectory}/`) &&
                (await readFile(existing)).length > 0
              )
                continue;
            }
            const response = await fetch(food.image.url, {
              headers: { "User-Agent": "HackTheSkiesFoodCatalog/1.0" },
              signal: AbortSignal.timeout(25_000),
            });
            if (!response.ok)
              throw new Error(`Image returned HTTP ${response.status}`);
            const mime = response.headers.get("content-type")?.split(";")[0];
            const extension = {
              "image/jpeg": "jpg",
              "image/png": "png",
              "image/webp": "webp",
            }[mime];
            if (!extension)
              throw new Error("Image response is not JPEG, PNG, or WebP");
            const bytes = Buffer.from(await response.arrayBuffer());
            if (bytes.length > 15_000_000)
              throw new Error("Image exceeds 15 MB");
            const filename = `${food.id.replace(/[^a-zA-Z0-9_-]/g, "-")}.${extension}`;
            const destination = resolve(imageDirectory, filename);
            await writeAtomic(destination, bytes);
            food.image.localPath = relative(dirname(jsonPath), destination)
              .split("\\")
              .join("/");
          } catch (error) {
            report.downloadErrors.push({ id: food.id, message: error.message });
          }
        }
      }),
    );
    console.log(
      `Downloaded ${foods.filter((food) => food.image?.localPath).length} dish photos; ${report.downloadErrors.length} download errors.`,
    );
  }
  report.generatedAt = new Date().toISOString();
  let typesPath = relative(
    dirname(output),
    resolve(root, "packages/food-catalog/src/types.ts"),
  )
    .split("\\")
    .join("/");
  if (!typesPath.startsWith(".")) typesPath = `./${typesPath}`;
  const source = `// Generated by scripts/import-food-catalog.mjs. Image source and license credits are retained.\nimport type { CatalogDish } from ${JSON.stringify(typesPath)};\n\nexport const catalogDishes: CatalogDish[] = ${JSON.stringify(foods, null, 2)};\n`;
  // Reporting errors occur before replacing the catalog consumed by the app.
  await writeAtomic(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeAtomic(output, source);
  await writeAtomic(
    jsonPath,
    `${JSON.stringify({ schemaVersion: 1, generatedAt: report.generatedAt, cuisines: cuisines.map((name) => ({ name, regions: cuisineRegions[name] })), foods, coverage: report }, null, 2)}\n`,
  );
  await writeAtomic(jsonPath.replace(/\.json$/, ".md"), catalogMarkdown(foods));
  if (output === defaultOutput) {
    const manifest = resolve(
      root,
      "apps/mobile/src/features/food-dex/data/catalogImages.ts",
    );
    await writeAtomic(
      manifest,
      mobileImageManifest(foods, dirname(jsonPath), manifest, dirname(output)),
    );
  }
  console.log(
    `Saved ${foods.length} dishes across ${cuisines.length} cuisine groups. ${report.missingImages.length} missing images; ${report.unreviewedImages.length} images awaiting review.`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  main().catch((error) => {
    // Only our own errors are safe to print; transport errors may contain URLs with keys.
    console.error(
      error instanceof TypeError
        ? "Catalog import failed. Check connectivity and provider credentials; the existing catalog was not replaced."
        : error.message,
    );
    process.exitCode = 1;
  });
}
