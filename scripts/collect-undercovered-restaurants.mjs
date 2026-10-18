import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const keyFile = path.join(root, "apps/api/.dev.vars");
const outputFile = path.join(root, "data/global-restaurant-sample.json");
const hardLimit = 400;
const perAreaLimit = 3;
const halfWidth = 0.07;

// These city centers target countries and regions missing from, or thinly
// represented in, the current sample. Queries stay local to each target area.
const targets = [
  { name: "Berlin, Germany", lon: 13.405, lat: 52.52 },
  { name: "Madrid, Spain", lon: -3.704, lat: 40.417 },
  { name: "Warsaw, Poland", lon: 21.012, lat: 52.23 },
  { name: "Bucharest, Romania", lon: 26.102, lat: 44.426 },
  { name: "Amsterdam, Netherlands", lon: 4.904, lat: 52.367 },
  { name: "Casablanca, Morocco", lon: -7.589, lat: 33.573 },
  { name: "Cairo, Egypt", lon: 31.235, lat: 30.044 },
  { name: "Lagos, Nigeria", lon: 3.379, lat: 6.524 },
  { name: "Nairobi, Kenya", lon: 36.821, lat: -1.292 },
  { name: "Addis Ababa, Ethiopia", lon: 38.757, lat: 8.98 },
  { name: "Kinshasa, DR Congo", lon: 15.266, lat: -4.441 },
  { name: "Lusaka, Zambia", lon: 28.322, lat: -15.387 },
  { name: "Accra, Ghana", lon: -0.187, lat: 5.603 },
  { name: "Dar es Salaam, Tanzania", lon: 39.208, lat: -6.792 },
  { name: "Maputo, Mozambique", lon: 32.583, lat: -25.969 },
  { name: "Delhi, India", lon: 77.209, lat: 28.614 },
  { name: "Dhaka, Bangladesh", lon: 90.412, lat: 23.81 },
  { name: "Kathmandu, Nepal", lon: 85.324, lat: 27.718 },
  { name: "Yangon, Myanmar", lon: 96.196, lat: 16.866 },
  { name: "Bangkok, Thailand", lon: 100.502, lat: 13.756 },
  { name: "Hanoi, Vietnam", lon: 105.834, lat: 21.028 },
  { name: "Manila, Philippines", lon: 120.984, lat: 14.599 },
  { name: "Jakarta, Indonesia", lon: 106.845, lat: -6.208 },
  { name: "Colombo, Sri Lanka", lon: 79.861, lat: 6.927 },
  { name: "Tashkent, Uzbekistan", lon: 69.279, lat: 41.299 },
  { name: "Havana, Cuba", lon: -82.367, lat: 23.113 },
  { name: "Kingston, Jamaica", lon: -76.793, lat: 17.971 },
  { name: "Guatemala City, Guatemala", lon: -90.506, lat: 14.634 },
  { name: "Lima, Peru", lon: -77.042, lat: -12.046 },
  { name: "Bogota, Colombia", lon: -74.072, lat: 4.711 },
  { name: "Sao Paulo, Brazil", lon: -46.634, lat: -23.55 },
  { name: "Port Moresby, Papua New Guinea", lon: 147.18, lat: -9.444 },
  { name: "Auckland, New Zealand", lon: 174.764, lat: -36.85 },
];

const vars = await readFile(keyFile, "utf8");
const keyLine = vars.split(/\r?\n/).find((line) => /^\s*GEOAPIFY_API_KEY\s*=\s*.+$/.test(line));
const apiKey = keyLine?.slice(keyLine.indexOf("=") + 1).trim().replace(/^['"]|['"]$/g, "");
if (!apiKey) throw new Error("GEOAPIFY_API_KEY is missing from apps/api/.dev.vars");

const existing = JSON.parse(await readFile(outputFile, "utf8"));
if (!Array.isArray(existing)) throw new Error("Restaurant sample must be a JSON array.");
if (existing.length >= hardLimit) {
  console.log(`Already at the ${hardLimit}-restaurant hard limit; no requests made.`);
  process.exit(0);
}
const occupied = new Set(existing.map(identity));
const room = hardLimit - existing.length;
const additions = [];
const targetLimit = Math.min(targets.length, Math.max(1, Number(process.argv[2]) || targets.length));

function identity(place) {
  return `${String(place.name).trim().toLocaleLowerCase()}:${Number(place.coordinate?.[0]).toFixed(4)}:${Number(place.coordinate?.[1]).toFixed(4)}`;
}

function boundsFor(target) {
  return {
    west: target.lon - halfWidth,
    south: target.lat - halfWidth,
    east: target.lon + halfWidth,
    north: target.lat + halfWidth,
  };
}

async function fetchGeoapify(bounds) {
  const url = new URL("https://api.geoapify.com/v2/places");
  url.searchParams.set("categories", "catering.restaurant,catering.cafe,catering.fast_food,catering.food_court");
  url.searchParams.set("filter", `rect:${bounds.west},${bounds.south},${bounds.east},${bounds.north}`);
  url.searchParams.set("limit", "12");
  url.searchParams.set("lang", "en");
  const response = await fetch(url, {
    headers: { "x-api-key": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Geoapify returned HTTP ${response.status}`);
  const payload = await response.json();
  return (payload.features ?? []).flatMap((feature) => {
    const properties = feature.properties ?? {};
    const coordinates = feature.geometry?.coordinates;
    const name = properties.name || properties.address_line1;
    if (feature.geometry?.type !== "Point" || !Array.isArray(coordinates) ||
        coordinates.length < 2 || !coordinates.slice(0, 2).every(Number.isFinite) ||
        typeof name !== "string" || !name.trim()) return [];
    return [{
      id: `geoapify-${properties.place_id ?? feature.id ?? `${coordinates[0]}:${coordinates[1]}`}`,
      name: name.trim(),
      category: "Restaurant",
      cuisine: typeof properties.catering_cuisine === "string" ? properties.catering_cuisine : undefined,
      neighborhood: properties.suburb || properties.city || "",
      address: [properties.address_line1, properties.address_line2]
        .filter((part) => typeof part === "string" && part.trim()).join(", "),
      coordinate: coordinates.slice(0, 2),
      country: properties.country || properties.country_code || "",
      image: "",
      note: "OpenStreetMap contributors",
      sourceUrl: "https://www.openstreetmap.org/",
    }];
  });
}

async function fetchOpenStreetMap(bounds) {
  const query = `[out:json][timeout:20];nwr["amenity"~"^(restaurant|cafe|fast_food|food_court)$"](${bounds.south},${bounds.west},${bounds.north},${bounds.east});out center tags qt 12;`;
  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      "User-Agent": "CiboRestaurantMap/1.0 (targeted coverage collection)",
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Overpass returned HTTP ${response.status}`);
  const payload = await response.json();
  return (payload.elements ?? []).flatMap((element) => {
    const tags = element.tags ?? {};
    const lon = element.lon ?? element.center?.lon;
    const lat = element.lat ?? element.center?.lat;
    const name = tags.name || tags.brand;
    if (!element.type || !Number.isSafeInteger(element.id) || !Number.isFinite(lon) ||
        !Number.isFinite(lat) || typeof name !== "string" || !name.trim()) return [];
    const address = [
      [tags["addr:housenumber"], tags["addr:street"]].filter(Boolean).join(" "),
      tags["addr:suburb"], tags["addr:city"] || tags["addr:town"] || tags["addr:village"],
      tags["addr:state"], tags["addr:country"],
    ].filter(Boolean).join(", ");
    return [{
      id: `osm-${element.type}-${element.id}`,
      name: name.trim(),
      category: "Restaurant",
      cuisine: tags.cuisine,
      neighborhood: tags["addr:suburb"] || tags["addr:city"] || tags["addr:town"] || "",
      address,
      coordinate: [lon, lat],
      country: tags["addr:country"] || "",
      image: "",
      note: `OpenStreetMap - ${tags.amenity || "restaurant"}`,
      sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    }];
  });
}

for (let index = 0; index < targetLimit && additions.length < room; index += 1) {
  const target = targets[index];
  const bounds = boundsFor(target);
  const results = await Promise.allSettled([fetchOpenStreetMap(bounds), fetchGeoapify(bounds)]);
  const fromOsm = results[0].status === "fulfilled" ? results[0].value : [];
  const fromGeoapify = results[1].status === "fulfilled" ? results[1].value : [];
  if (results[0].status === "rejected") console.log(`${target.name}: Overpass error: ${results[0].reason?.message ?? "request failed"}`);
  if (results[1].status === "rejected") console.log(`${target.name}: Geoapify error: ${results[1].reason?.message ?? "request failed"}`);
  const areaCandidates = [];
  const limit = Math.max(fromOsm.length, fromGeoapify.length);
  for (let item = 0; item < limit; item += 1) {
    if (fromOsm[item]) areaCandidates.push(fromOsm[item]);
    if (fromGeoapify[item]) areaCandidates.push(fromGeoapify[item]);
  }
  let addedInArea = 0;
  for (const place of areaCandidates) {
    const key = identity(place);
    if (occupied.has(key)) continue;
    occupied.add(key);
    additions.push(place);
    addedInArea += 1;
    if (addedInArea >= perAreaLimit || additions.length >= room) break;
  }
  if (results.every((result) => result.status === "fulfilled"))
    console.log(`${target.name}: provider records ${fromOsm.length} OSM, ${fromGeoapify.length} Geoapify`);
  console.log(`${target.name}: added ${addedInArea}; total ${existing.length + additions.length}/${hardLimit}`);
  await new Promise((resolve) => setTimeout(resolve, 500));
}

if (!additions.length) throw new Error("No new named places were found; the existing sample was left unchanged.");
await writeFile(outputFile, `${JSON.stringify([...existing, ...additions].slice(0, hardLimit), null, 2)}\n`, "utf8");
console.log(`Added ${additions.length} image-free restaurants across undercovered regions.`);
