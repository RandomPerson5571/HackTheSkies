export type DishBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
  visible: boolean;
};
export type Detection = {
  label: string;
  score: number;
  box: { xmin: number; ymin: number; xmax: number; ymax: number };
};
const foodLabels = new Set([
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

// Prefer the same object across frames rather than jumping to a new nearby dish.
export function selectDish(detections: Detection[], previous?: Detection) {
  const candidates = detections.filter(
    (d) => foodLabels.has(d.label) && d.score >= 0.4,
  );
  return candidates.sort((a, b) => rank(b) - rank(a))[0];
  function rank(d: Detection) {
    const box = d.box;
    const cx = (box.xmin + box.xmax) / 2;
    const cy = (box.ymin + box.ymax) / 2;
    if (previous) {
      const p = previous.box;
      const intersection =
        Math.max(0, Math.min(box.xmax, p.xmax) - Math.max(box.xmin, p.xmin)) *
        Math.max(0, Math.min(box.ymax, p.ymax) - Math.max(box.ymin, p.ymin));
      const area = (box.xmax - box.xmin) * (box.ymax - box.ymin);
      const oldArea = (p.xmax - p.xmin) * (p.ymax - p.ymin);
      return (
        (intersection / Math.max(0.0001, area + oldArea - intersection)) * 3 +
        d.score
      );
    }
    return d.score - Math.hypot(cx - 0.5, cy - 0.5) * 0.5;
  }
}

// Model coordinates are normalized to the source frame, before objectFit: cover.
export function projectDish(
  box: Detection["box"],
  source: { width: number; height: number },
  preview: { width: number; height: number },
  mirrored: boolean,
): DishBounds {
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
  return {
    x: mirrored ? 1 - right : left,
    y: top,
    width: right - left,
    height: bottom - top,
    visible: right > 0 && left < 1 && bottom > 0 && top < 1,
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
