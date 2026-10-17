import type { ImageSourcePropType } from "react-native";
import { catalogImages } from "../data/catalogImages";
import type { Dish } from "../models/foodDex";

export function catalogPhoto(
  dish: Dish | undefined,
): ImageSourcePropType | undefined {
  if (!dish) return undefined;
  return (
    catalogImages[dish.id] ?? (dish.image ? { uri: dish.image.url } : undefined)
  );
}
