import type { Detection } from "./foodTracking";
const labels: Record<number, string> = {
  45: "bowl",
  46: "banana",
  47: "apple",
  48: "sandwich",
  49: "orange",
  50: "broccoli",
  51: "carrot",
  52: "hot dog",
  53: "pizza",
  54: "donut",
  55: "cake",
};
export function letterboxRgb(image: {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
}) {
  const scale = Math.min(640 / image.width, 640 / image.height);
  const width = Math.round(image.width * scale);
  const height = Math.round(image.height * scale);
  const offsetX = Math.floor((640 - width) / 2);
  const offsetY = Math.floor((640 - height) / 2);
  const data = new Float32Array(3 * 640 * 640).fill(114 / 255);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const source =
        (Math.min(image.height - 1, Math.floor(y / scale)) * image.width +
          Math.min(image.width - 1, Math.floor(x / scale))) *
        4;
      const target = (y + offsetY) * 640 + x + offsetX;
      for (let c = 0; c < 3; c++)
        data[c * 640 * 640 + target] = image.data[source + c]! / 255;
    }
  return { data, width, height, offsetX, offsetY };
}
export function decodeYolo(
  data: Float32Array,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number,
): Detection[] {
  const detections: Detection[] = [];
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  for (let i = 0; i + 5 < data.length; i += 6) {
    const score = data[i + 4]!;
    const label = labels[Math.round(data[i + 5]!)];
    if (!label || !Number.isFinite(score) || score < 0.4) continue;
    const box = {
      xmin: clamp((data[i]! - offsetX) / width),
      ymin: clamp((data[i + 1]! - offsetY) / height),
      xmax: clamp((data[i + 2]! - offsetX) / width),
      ymax: clamp((data[i + 3]! - offsetY) / height),
    };
    if (
      Object.values(box).every(Number.isFinite) &&
      box.xmax > box.xmin &&
      box.ymax > box.ymin
    )
      detections.push({ label, score, box });
  }
  return detections;
}
