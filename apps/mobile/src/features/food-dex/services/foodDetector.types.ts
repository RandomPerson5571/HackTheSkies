import type { FoodDetection, FrameSize } from "../models/foodDetection";
export type DetectionImage = FrameSize & { uri: string };
export type FoodDetector = {
  detect: (image: DetectionImage) => Promise<FoodDetection[]>;
};
