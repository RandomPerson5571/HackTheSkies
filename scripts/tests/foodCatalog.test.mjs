import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { buildCatalog } from "../import-food-catalog.mjs";
import { findCommonsPhotos } from "../lib/commons-photos.mjs";

const meal = (
  idMeal,
  strMeal,
  strMealThumb = `https://www.themealdb.com/images/media/meals/${idMeal}.jpg`,
) => ({ idMeal, strMeal, strMealThumb });

test("offline import covers the taxonomy without making provider requests", async () => {
  const { foods, report } = await buildCatalog({
    offline: true,
    fetcher() {
      throw new Error("Unexpected request");
    },
  });
  assert.equal(foods.length, 131);
  assert.equal(Object.keys(report.counts).length, 16);
  assert.equal(report.counts.Other, 0);
  assert.equal(new Set(foods.map((food) => food.id)).size, foods.length);
});

test("provider areas map to groups, merge accent variants, and retain curated IDs", async () => {
  const calls = [];
  const fetcher = async (url) => {
    calls.push(url);
    if (url.includes("list.php"))
      return Response.json({
        meals: ["Vietnamese", "Mexican", "Indian", "British"].map(
          (strArea) => ({ strArea }),
        ),
      });
    const area = new URL(url).searchParams.get("a");
    return Response.json({
      meals:
        area === "Vietnamese"
          ? [meal("1", "Pho"), meal("2", "  PHỞ  ")]
          : area === "Mexican"
            ? [meal("3", "Tacos")]
            : [meal("4", "Dosa")],
    });
  };
  const { foods, report } = await buildCatalog({ fetcher });
  assert.equal(foods.length, 131);
  const pho = foods.find((food) => food.id === "pho");
  assert.equal(pho.name, "Phở");
  assert.deepEqual(pho.providerIds, ["1", "2"]);
  assert.equal(pho.image.reviewed, false);
  assert.equal(foods.find((food) => food.id === "tacos").cuisine, "Latin");
  assert.equal(foods.find((food) => food.id === "dosa").cuisine, "South Asian");
  assert.deepEqual(report.unmappedAreas, ["British"]);
  assert.ok(report.unsupportedAreas.Persian.includes("Iraqi"));
  assert.equal(calls.length, 4);
});

test("unsafe image URLs are discarded and optional Pexels candidates retain credits", async () => {
  const { foods } = await buildCatalog({
    pexelsKey: "test-photo-key",
    fetcher: async (url, options) => {
      if (url.includes("list.php"))
        return Response.json({ meals: [{ strArea: "Japanese" }] });
      if (url.includes("filter.php"))
        return Response.json({
          meals: [meal("1", "Ramen", "https://untrusted.example/food.jpg")],
        });
      assert.equal(options.headers.Authorization, "test-photo-key");
      return Response.json({
        photos: [
          {
            url: "https://www.pexels.com/photo/food-123/",
            src: { medium: "https://images.pexels.com/photos/123/food.jpeg" },
            photographer: "Sample Photographer",
            photographer_url: "https://www.pexels.com/@sample",
          },
        ],
      });
    },
  });
  const image = foods.find((food) => food.id === "ramen").image;
  assert.equal(image.source, "pexels");
  assert.equal(image.photographer, "Sample Photographer");
  assert.equal(image.licenseUrl, "https://www.pexels.com/license/");
  assert.equal(image.reviewed, false);
  assert.match(image.attribution, /on Pexels/);
});

test("refresh keeps reviewed photos and repeated imports have stable results", async () => {
  const fetcher = async (url) =>
    Response.json(
      url.includes("list.php")
        ? { meals: [{ strArea: "Japanese" }] }
        : { meals: [meal("1", "Ramen"), meal("2", "New dish")] },
    );
  const first = await buildCatalog({ fetcher });
  first.foods.find((food) => food.id === "ramen").image.reviewed = true;
  const second = await buildCatalog({ fetcher, previous: first.foods });
  assert.equal(
    second.foods.find((food) => food.id === "ramen").image.reviewed,
    true,
  );
  const third = await buildCatalog({ fetcher, previous: second.foods });
  assert.deepEqual(third, second);
});

test("provider failures, malformed payloads, and invalid limits fail explicitly", async () => {
  for (const payload of [{}, { meals: [] }, { meals: [{ strArea: 7 }] }]) {
    await assert.rejects(
      buildCatalog({ fetcher: async () => Response.json(payload) }),
    );
  }
  await assert.rejects(
    buildCatalog({
      fetcher: async () => new Response("rate limited", { status: 429 }),
    }),
    /HTTP 429/,
  );
  await assert.rejects(
    buildCatalog({ limitPerArea: 0 }),
    /integer from 1 to 100/,
  );
  await assert.rejects(
    buildCatalog({
      fetcher: async (url) =>
        Response.json(
          url.includes("list.php")
            ? { meals: [{ strArea: "Japanese" }] }
            : { meals: [{}] },
        ),
    }),
    /Invalid meal/,
  );
});

test("CLI writes an importable catalog and a bad run preserves the existing file", async () => {
  const directory = await mkdtemp(join(tmpdir(), "food-catalog-test-"));
  const output = join(directory, "catalog.ts");
  const report = join(directory, "report.json");
  try {
    execFileSync(
      process.execPath,
      [
        "scripts/import-food-catalog.mjs",
        "--offline",
        "--output",
        output,
        "--report",
        report,
      ],
      { stdio: "pipe" },
    );
    const source = await readFile(output, "utf8");
    assert.match(source, /export const catalogDishes: CatalogDish\[\]/);
    assert.equal(JSON.parse(await readFile(report, "utf8")).counts.Chinese, 7);
    await writeFile(output, source);
    assert.throws(() =>
      execFileSync(
        process.execPath,
        [
          "scripts/import-food-catalog.mjs",
          "--offline",
          "--limit",
          "bad",
          "--output",
          output,
          "--report",
          report,
        ],
        { stdio: "pipe" },
      ),
    );
    assert.equal(await readFile(output, "utf8"), source);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("full imports do not truncate provider areas at 100 dishes", async () => {
  const { foods, report } = await buildCatalog({
    limitPerArea: null,
    fetcher: async (url) =>
      Response.json(
        url.includes("list.php")
          ? { meals: [{ strArea: "Japanese" }] }
          : {
              meals: Array.from({ length: 120 }, (_, index) =>
                meal(String(index + 1), `Test dish ${index}`),
              ),
            },
      ),
  });
  assert.equal(foods.length, 251);
  assert.equal(report.providerAreaCounts.Japanese, 120);
  assert.equal(report.limitPerArea, null);
});

test("batched Wikimedia photos resolve redirects and retain individual image licenses", async () => {
  const calls = [];
  const images = await findCommonsPhotos(
    [
      { id: "ramen", name: "Ramen" },
      { id: "dumplings", name: "Dumplings" },
    ],
    {
      fetcher: async (url) => {
        calls.push(url);
        if (url.includes("en.wikipedia.org"))
          return Response.json({
            query: {
              redirects: [{ from: "Dumplings", to: "Dumpling" }],
              pages: [
                { title: "Ramen", pageimage: "Ramen_photo.jpg" },
                { title: "Dumpling", pageimage: "Dumpling_photo.jpg" },
              ],
            },
          });
        return Response.json({
          query: {
            pages: ["Ramen", "Dumpling"].map((name) => ({
              title: `File:${name} photo.jpg`,
              imageinfo: [
                {
                  mime: "image/jpeg",
                  thumburl: `https://upload.wikimedia.org/${name}.jpg`,
                  descriptionurl: `https://commons.wikimedia.org/wiki/File:${name}.jpg`,
                  extmetadata: {
                    LicenseShortName: { value: "CC BY-SA 4.0" },
                    LicenseUrl: {
                      value: "//creativecommons.org/licenses/by-sa/4.0/",
                    },
                    Artist: { value: "<b>Test Photographer</b>" },
                  },
                },
              ],
            })),
          },
        });
      },
    },
  );
  assert.equal(calls.length, 2);
  assert.equal(images.size, 2);
  assert.equal(images.get("ramen").photographer, "Test Photographer");
  assert.equal(
    images.get("ramen").licenseUrl,
    "https://creativecommons.org/licenses/by-sa/4.0/",
  );
  assert.equal(images.get("dumplings").matchTitle, "Dumpling");
});
