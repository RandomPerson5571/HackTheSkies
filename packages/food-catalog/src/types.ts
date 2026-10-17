import type { Cuisine } from "./cuisines.ts";

export type ImageCredit = {
  url: string;
  source: "themealdb" | "pexels" | "wikimedia";
  sourceUrl: string;
  photographer: string | null;
  photographerUrl: string | null;
  licenseUrl: string;
  attribution: string;
  reviewed: boolean;
  licenseName?: string;
  fileTitle?: string;
  matchMethod?: string;
  matchTitle?: string;
  localPath?: string;
};

export type CatalogDish = {
  id: string;
  name: string;
  cuisine: Cuisine;
  cuisineIds: Cuisine[];
  regions: string[];
  note: string;
  source: "curated" | "themealdb";
  sourceUrl?: string;
  providerIds?: string[];
  providerAreas?: string[];
  image?: ImageCredit;
};
