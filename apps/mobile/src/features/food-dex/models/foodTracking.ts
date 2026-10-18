export type DishBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
  // Absent (yolo) for live on-device tracking; "groq" marks a fallback box
  // estimated by the vision model, which renders with a distinct style.
  source?: "yolo" | "groq";
};
export type Detection = {
  // Dimensions after orientation normalization, in the same space as the box.
  frameSize?: { width: number; height: number };
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
};
const foodLabels = new Set([
  "food",
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
  "bowl",
]);

// Always select the largest eligible food box in the current frame.
export function selectDish(detections: Detection[]) {
  const area = (d: Detection) =>
    (d.box.xmax - d.box.xmin) * (d.box.ymax - d.box.ymin);
  return detections
    .filter((d) => foodLabels.has(d.label) && d.score >= 0.3)
    .sort((a, b) => area(b) - area(a) || b.score - a.score)[0];
}

// Model coordinates are normalized to the source frame, before objectFit: cover.
// A box that slid partly off the preview stays visible while a meaningful
// portion remains, with coordinates clamped so its labels stay on screen.
// Fully off-screen or degenerate boxes drop out entirely (visible: false)
// instead of being parked at (0, 0) or an edge.
const MIN_VISIBLE_AREA = 0.3;
export function projectDish(
  box: Detection["box"],
  source: { width: number; height: number },
  preview: { width: number; height: number },
  mirrored: boolean,
  rotation: 0 | 90 | 180 | 270 = 0,
): DishBounds | null {
  if (
    ![source.width, source.height, preview.width, preview.height].every(
      (v) => Number.isFinite(v) && v > 0,
    ) ||
    !Object.values(box).every((v) => Number.isFinite(v) && v >= 0 && v <= 1) ||
    box.xmax <= box.xmin ||
    box.ymax <= box.ymin
  )
    return null;
  if (rotation === 90)
    box = {
      xmin: 1 - box.ymax,
      ymin: box.xmin,
      xmax: 1 - box.ymin,
      ymax: box.xmax,
    };
  if (rotation === 180)
    box = {
      xmin: 1 - box.xmax,
      ymin: 1 - box.ymax,
      xmax: 1 - box.xmin,
      ymax: 1 - box.ymin,
    };
  if (rotation === 270)
    box = {
      xmin: box.ymin,
      ymin: 1 - box.xmax,
      xmax: box.ymax,
      ymax: 1 - box.xmin,
    };
  if (rotation === 90 || rotation === 270)
    source = { width: source.height, height: source.width };
  const scale = Math.max(
    preview.width / source.width,
    preview.height / source.height,
  );
  const w = source.width * scale;
  const h = source.height * scale;
  const left = (box.xmin * w - (w - preview.width) / 2) / preview.width;
  const right = (box.xmax * w - (w - preview.width) / 2) / preview.width;
  const top = (box.ymin * h - (h - preview.height) / 2) / preview.height;
  const bottom = (box.ymax * h - (h - preview.height) / 2) / preview.height;
  // A mirrored preview flips the horizontal axis, including the parts of the
  // box that fall outside the frame.
  const edgeLeft = mirrored ? 1 - right : left;
  const edgeRight = mirrored ? 1 - left : right;
  const x0 = Math.max(0, Math.min(1, edgeLeft));
  const x1 = Math.max(0, Math.min(1, edgeRight));
  const y0 = Math.max(0, Math.min(1, top));
  const y1 = Math.max(0, Math.min(1, bottom));
  const area = (x1 - x0) * (y1 - y0);
  const fullArea =
    Math.max(0, edgeRight - edgeLeft) * Math.max(0, bottom - top);
  if (fullArea <= 0 || area / fullArea < MIN_VISIBLE_AREA) return null;
  return {
    x: x0,
    y: y0,
    width: x1 - x0,
    height: y1 - y0,
    visible: true,
  };
}

// Groq returns estimated boxes normalized to 0-1000 over the analyzed frame.
export function normalizedBoxToDetection(
  bbox: readonly [number, number, number, number],
): Detection["box"] {
  return {
    xmin: bbox[0]! / 1000,
    ymin: bbox[1]! / 1000,
    xmax: bbox[2]! / 1000,
    ymax: bbox[3]! / 1000,
  };
}

export function arrowToBox(
  from: { x: number; y: number },
  box: { x: number; y: number; width: number; height: number },
) {
  "worklet";
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const dx = from.x - cx;
  const dy = from.y - cy;
  const factor =
    1 /
    Math.max(
      Math.abs(dx) / (box.width / 2 + 8),
      Math.abs(dy) / (box.height / 2 + 8),
      1,
    );
  return { x: cx + dx * factor, y: cy + dy * factor };
}
