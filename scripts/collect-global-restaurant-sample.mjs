import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyFile = path.join(root, "apps/api/.dev.vars");
const output = path.join(root, "data/global-restaurant-sample.json");
const limit = 400;
const columns = 16;
const rows = 10;
const perCell = 3;

const keyLine = (await readFile(keyFile, "utf8"))
  .split(/\r?\n/)
  .find((line) => /^\s*GEOAPIFY_API_KEY\s*=\s*.+$/.test(line));
const apiKey = keyLine?.slice(keyLine.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
if (!apiKey) throw new Error("GEOAPIFY_API_KEY is missing from apps/api/.dev.vars");

const featuresByCell = [];
for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const west = -180 + (360 * column) / columns;
    const east = -180 + (360 * (column + 1)) / columns;
    const south = -85 + (170 * row) / rows;
    const north = -85 + (170 * (row + 1)) / rows;
    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", "catering.restaurant,catering.cafe,catering.fast_food,catering.food_court");
    url.searchParams.set("filter", `rect:${west},${south},${east},${north}`);
    url.searchParams.set("limit", String(perCell));
    url.searchParams.set("lang", "en");
    const response = await fetch(url, {
      headers: { "x-api-key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Geoapify request failed with HTTP ${response.status}`);
    const payload = await response.json();
    featuresByCell.push(Array.isArray(payload.features) ? payload.features : []);
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  console.log(`Searched ${Math.min((row + 1) * columns, columns * rows)} of ${columns * rows} global grid cells`);
}

const records = [];
const seen = new Set();
for (let round = 0; round < perCell && records.length < limit; round += 1) {
  for (const cellFeatures of featuresByCell) {
    const feature = cellFeatures[round];
    if (!feature || records.length >= limit) continue;
  const properties = feature.properties ?? {};
  const coordinates = feature.geometry?.coordinates;
  const name = properties.name || properties.address_line1;
  if (
    feature.geometry?.type !== "Point" ||
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    !coordinates.slice(0, 2).every(Number.isFinite) ||
    typeof name !== "string" ||
    !name.trim()
  ) continue;

  const identity = String(properties.place_id ?? feature.id ?? `${coordinates[0]}:${coordinates[1]}`);
  if (seen.has(identity)) continue;
  seen.add(identity);
  const address = [properties.address_line1, properties.address_line2]
    .filter((part) => typeof part === "string" && part.trim())
    .join(", ");
  records.push({
    id: `geoapify-${identity}`,
    name: name.trim(),
    category: "Restaurant",
    cuisine: typeof properties.catering_cuisine === "string" ? properties.catering_cuisine : undefined,
    neighborhood: properties.suburb || properties.city || "",
    address,
    coordinate: coordinates.slice(0, 2),
    country: properties.country || properties.country_code || "",
    image: "",
    note: "OpenStreetMap contributors",
    sourceUrl: "https://www.openstreetmap.org/",
  });
  }
}
if (!records.length) throw new Error("Geoapify returned no named restaurant points; no file was written.");

await writeFile(output, `${JSON.stringify(records, null, 2)}\n`, "utf8");
const countries = new Set(records.map((record) => record.country).filter(Boolean));
console.log(`Saved ${records.length} image-free records to ${path.relative(root, output)}`);
console.log(`Countries represented in the provider response: ${countries.size}`);
console.log("This is a capped sample, not an exhaustive or evenly distributed world catalog.");
