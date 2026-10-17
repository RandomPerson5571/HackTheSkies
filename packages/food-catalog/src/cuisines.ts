// Product groupings supplied by the app owner; regions are culinary labels.
export const cuisines = [
  "Chinese",
  "Korean",
  "Japanese",
  "Vietnamese",
  "Thai",
  "South Asian",
  "Levant",
  "Greek",
  "Persian",
  "French",
  "Italian",
  "Latin",
  "Caribbean",
  "American",
  "Other",
] as const;

export type Cuisine = (typeof cuisines)[number];

export const cuisineRegions: Record<Cuisine, readonly string[]> = {
  Chinese: ["China", "Taiwan", "Tibet", "Hong Kong"],
  Korean: ["North Korea", "South Korea"],
  Japanese: ["Japan"],
  Vietnamese: ["Vietnam"],
  Thai: ["Thailand"],
  "South Asian": [
    "North India",
    "South India",
    "Pakistan",
    "Bangladesh",
    "Nepal",
    "Sri Lanka",
  ],
  Levant: ["Turkey", "Jordan", "Syria", "Lebanon", "Israel", "Palestine"],
  Greek: ["Greece"],
  Persian: ["Iran", "Iraq", "Afghanistan"],
  French: ["France"],
  Italian: ["Italy"],
  Latin: [
    "Mexico",
    "Puerto Rico",
    "Argentina",
    "Chile",
    "Brazil",
    "Colombia",
    "Costa Rica",
  ],
  Caribbean: ["Jamaica", "Cuba", "Haiti", "Dominican Republic", "Trinidad"],
  American: ["United States"],
  Other: [],
};

// Only exact provider area names are mapped. Unsupported areas stay in the report.
export const mealDbAreas: Record<Cuisine, readonly string[]> = {
  Chinese: ["Chinese", "Taiwanese", "Tibetan", "Hong Kong", "Hong Konger"],
  Korean: ["Korean", "North Korean", "South Korean"],
  Japanese: ["Japanese"],
  Vietnamese: ["Vietnamese"],
  Thai: ["Thai"],
  "South Asian": [
    "Indian",
    "Pakistani",
    "Bangladeshi",
    "Nepalese",
    "Nepali",
    "Sri Lankan",
  ],
  Levant: [
    "Turkish",
    "Jordanian",
    "Syrian",
    "Lebanese",
    "Israeli",
    "Palestinian",
  ],
  Greek: ["Greek"],
  Persian: ["Iranian", "Iraqi", "Afghan"],
  French: ["French"],
  Italian: ["Italian"],
  Latin: [
    "Mexican",
    "Puerto Rican",
    "Argentinian",
    "Argentine",
    "Chilean",
    "Brazilian",
    "Colombian",
    "Costa Rican",
  ],
  Caribbean: ["Jamaican", "Cuban", "Haitian", "Dominican", "Trinidadian"],
  American: ["American"],
  Other: [],
};

export function normalizeCuisine(value: unknown): Cuisine | null {
  if (typeof value !== "string") return null;
  const label = value.trim().toLowerCase();
  // Preserve collections saved before the expanded cuisine taxonomy.
  if (label === "indian") return "South Asian";
  if (label === "mexican") return "Latin";
  return cuisines.find((cuisine) => cuisine.toLowerCase() === label) ?? null;
}

export const cuisineGuide = cuisines
  .map(
    (cuisine) =>
      `${cuisine}${cuisineRegions[cuisine].length ? ` (${cuisineRegions[cuisine].join(", ")})` : ""}`,
  )
  .join("; ");
