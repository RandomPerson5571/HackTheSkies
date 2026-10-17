import { normalizeBox } from "../models/foodDetection.ts";
import type { FoodDetector, DetectionImage } from "./foodDetector.types";
const foods = new Set([
  "banana",
  "apple",
  "sandwich",
  "orange",
  "broccoli",
  "carrot",
  "hot dog",
  "pizza",
  "donut",
  "cake",
]);
// COCO-SSD runs suppression on CPU, even when inference uses WebGL. Register
// and initialize CPU first so its internal backend switch is synchronous.
export async function initializeFoodDetectorBackend() {
  const tf = await import("@tensorflow/tfjs-core");
  await import("@tensorflow/tfjs-backend-cpu");
  await tf.setBackend("cpu");
  await tf.ready();
  if (typeof document !== "undefined") {
    await import("@tensorflow/tfjs-backend-webgl");
    if (tf.env().getNumber("WEBGL_VERSION") > 0) {
      try {
        if (!(await tf.setBackend("webgl"))) await tf.setBackend("cpu");
      } catch {
        await tf.setBackend("cpu");
      }
    }
  }
  await tf.ready();
  return tf;
}

let loaded: Promise<FoodDetector> | null = null;
export function loadFoodDetector(): Promise<FoodDetector> {
  return (loaded ??= (async () => {
    const tf = await initializeFoodDetectorBackend();
    const { load } = await import("@tensorflow-models/coco-ssd");
    const model = await load({ base: "lite_mobilenet_v2" });
    // The model temporarily switches TensorFlow's global backend. Serialize
    // inference across camera sessions, including an old session winding down.
    let pending: Promise<unknown> = Promise.resolve();
    return {
      detect(image: DetectionImage) {
        const job = pending.then(async () => {
          const element = new Image();
          element.src = image.uri;
          await element.decode();
          const backend = tf.getBackend();
          try {
            const objects = await model.detect(element, 20, 0.5);
            return objects
              .filter((object) => foods.has(object.class))
              .flatMap((object) => {
                const [x, y, width, height] = object.bbox;
                const box = normalizeBox({ x, y, width, height }, image);
                return box ? [{ box, confidence: object.score }] : [];
              });
          } finally {
            if (tf.getBackend() !== backend) await tf.setBackend(backend);
          }
        });
        pending = job.catch(() => undefined);
        return job;
      },
    };
  })().catch((error) => {
    loaded = null;
    throw error;
  }));
}
