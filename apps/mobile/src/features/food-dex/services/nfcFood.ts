import {
  dishes,
  findDishByNumber,
  foodKey,
  normalizeCuisine,
  type Cuisine,
} from "../models/foodDex";

export type NfcFoodItem = { name: string; cuisine: Cuisine };

function makeFoodItem(nameValue: string, cuisineValue = "") {
  const name = nameValue.trim().replace(/^["']|["']$/g, "").slice(0, 80);
  if (!name) return null;

  const numberedDish = findDishByNumber(name);
  if (numberedDish) {
    return {
      name: numberedDish.name,
      cuisine: numberedDish.cuisine,
    } satisfies NfcFoodItem;
  }
  if (/^#?0*\d+$/.test(name)) return null;

  const catalogDish = dishes.find(
    (dish) => foodKey(dish.name, dish.cuisine) === foodKey(name, dish.cuisine),
  );
  const cuisine =
    normalizeCuisine(cuisineValue) ?? catalogDish?.cuisine ?? "Other";
  return { name, cuisine } satisfies NfcFoodItem;
}

function readObject(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const numberedDish = findDishByNumber(
    record.number ?? record.foodNumber ?? record.foodId ?? record.id,
  );
  if (numberedDish) {
    return {
      name: numberedDish.name,
      cuisine: numberedDish.cuisine,
    } satisfies NfcFoodItem;
  }
  const name = [record.name, record.dish, record.food].find(
    (part): part is string => typeof part === "string" && Boolean(part.trim()),
  );
  if (!name) return null;
  const cuisine = typeof record.cuisine === "string" ? record.cuisine : "";
  return makeFoodItem(name, cuisine);
}

function readUrl(value: string) {
  try {
    const url = new URL(value);
    const numberedDish = findDishByNumber(
      url.searchParams.get("number") ??
        url.searchParams.get("foodNumber") ??
        url.searchParams.get("foodId") ??
        url.searchParams.get("id"),
    );
    if (numberedDish) {
      return {
        name: numberedDish.name,
        cuisine: numberedDish.cuisine,
      } satisfies NfcFoodItem;
    }
    const lastSegment = url.pathname.split("/").filter(Boolean).at(-1) ?? "";
    const name =
      url.searchParams.get("name") ??
      url.searchParams.get("dish") ??
      url.searchParams.get("food") ??
      decodeURIComponent(lastSegment).replace(/[-_]+/g, " ");
    return makeFoodItem(name, url.searchParams.get("cuisine") ?? "");
  } catch {
    return null;
  }
}

export function parseNfcFoodPayload(payload: string): NfcFoodItem | null {
  const value = payload.trim();
  if (!value) return null;

  try {
    const parsed = readObject(JSON.parse(value));
    if (parsed) return parsed;
  } catch {
    // Most tags store a plain text dish name rather than JSON.
  }

  if (/^(https?|cibo):\/\//i.test(value)) {
    const parsed = readUrl(value);
    if (parsed) return parsed;
  }

  const numberField = value.match(
    /^(?:number|foodNumber|foodId|id)\s*[:=]\s*(.+)$/im,
  )?.[1];
  if (numberField) return makeFoodItem(numberField);

  const nameField = value.match(/^(?:name|dish|food)\s*[:=]\s*(.+)$/im)?.[1];
  const cuisineField = value.match(/^cuisine\s*[:=]\s*(.+)$/im)?.[1] ?? "";
  if (nameField) return makeFoodItem(nameField, cuisineField);

  const fields = value.split(/\s*[|;]\s*/);
  if (fields.length === 2 && normalizeCuisine(fields[1])) {
    return makeFoodItem(fields[0], fields[1]);
  }

  return makeFoodItem(value);
}
