import type { Detection } from "./foodTracking";
// Fixed-size, box-only export of the food-trained YOLO11n-Seg checkpoint.
export const YOLO_INPUT_SIZE = 416;
export const FOOD_CONFIDENCE = 0.3;
export function letterboxRgb(image: {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}) {
  const scale = Math.min(
    YOLO_INPUT_SIZE / image.width,
    YOLO_INPUT_SIZE / image.height,
  );
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const offsetX = Math.floor((YOLO_INPUT_SIZE - width) / 2);
  const offsetY = Math.floor((YOLO_INPUT_SIZE - height) / 2);
  const data = new Float32Array(3 * YOLO_INPUT_SIZE * YOLO_INPUT_SIZE).fill(
    114 / 255,
  );
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const source =
        (Math.min(image.height - 1, Math.floor(y / scale)) * image.width +
          Math.min(image.width - 1, Math.floor(x / scale))) *
        4;
      const target = (y + offsetY) * YOLO_INPUT_SIZE + x + offsetX;
      for (let c = 0; c < 3; c++)
        data[c * YOLO_INPUT_SIZE * YOLO_INPUT_SIZE + target] =
          image.data[source + c]! / 255;
    }
  return { data, width, height, offsetX, offsetY };
}
// Output is channel-first [1, 5, N]: center x/y, width/height, food score.
// Segmentation prototypes and mask coefficients are pruned from the asset.
export function decodeYolo(
  data: Float32Array,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): Detection[] {
  if (data.length % 5 !== 0 || width <= 0 || height <= 0)
    throw new Error("Unexpected food detector output");
  const count = data.length / 5;
  const candidates: Detection[] = [];
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  for (let i = 0; i < count; i++) {
    const score = data[4 * count + i]!;
    if (!Number.isFinite(score) || score < FOOD_CONFIDENCE) continue;
    const x = data[i]!;
    const y = data[count + i]!;
    const w = data[2 * count + i]!;
    const h = data[3 * count + i]!;
    if (![x, y, w, h].every(Number.isFinite) || w <= 0 || h <= 0) continue;
    const box = {
      xmin: clamp((x - w / 2 - offsetX) / width),
      ymin: clamp((y - h / 2 - offsetY) / height),
      xmax: clamp((x + w / 2 - offsetX) / width),
      ymax: clamp((y + h / 2 - offsetY) / height),
    };
    if (box.xmax > box.xmin && box.ymax > box.ymin)
      candidates.push({ label: "food", score, box });
  }
  // Bound postprocessing even in noisy scenes; suppress overlapping anchors.
  candidates.sort((a, b) => b.score - a.score);
  const selected: Detection[] = [];
  const area = (b: Detection["box"]) => (b.xmax - b.xmin) * (b.ymax - b.ymin);
  for (const candidate of candidates.slice(0, 100)) {
    if (
      selected.some(({ box }) => {
        const b = candidate.box;
        const intersection =
          Math.max(0, Math.min(box.xmax, b.xmax) - Math.max(box.xmin, b.xmin)) *
          Math.max(0, Math.min(box.ymax, b.ymax) - Math.max(box.ymin, b.ymin));
        return intersection / (area(box) + area(b) - intersection) > 0.45;
      })
    )
      continue;
    selected.push(candidate);
    if (selected.length === 10) break;
  }
  return selected;
}
