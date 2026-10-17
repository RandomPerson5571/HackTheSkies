import { normalizeBox } from "../models/foodDetection";
import type { FoodDetector, DetectionImage } from "./foodDetector.types";
let loaded: Promise<FoodDetector> | null = null;
export function loadFoodDetector(): Promise<FoodDetector> {
  return (loaded ??= (async () => {
    const { RNMLKitDefaultObjectDetector } =
      await import("@infinitered/react-native-mlkit-object-detection");
    const detector = new RNMLKitDefaultObjectDetector({
      detectorMode: "singleImage",
      shouldEnableClassification: true,
      shouldEnableMultipleObjects: true,
    });
    await detector.load();
    return {
      async detect(image: DetectionImage) {
        const objects = await detector.detectObjects(image.uri);
        return objects.flatMap((object) => {
          const food = object.labels.find(
            (label) => /^food$/i.test(label.text) && label.confidence >= 0.5,
          );
          if (!food) return [];
          const box = normalizeBox(
            {
              x: object.frame.origin.x,
              y: object.frame.origin.y,
              width: object.frame.size.x,
              height: object.frame.size.y,
            },
            image,
          );
          return box ? [{ box, confidence: food.confidence }] : [];
        });
      },
    };
  })().catch((error) => {
    loaded = null;
    throw error;
  }));
}
