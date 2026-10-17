export type FoodBox = { x: number; y: number; width: number; height: number };
export type FoodDetection = { box: FoodBox; confidence: number };
export type FoodTrack = FoodDetection & {
  id: number;
  hits: number;
  missed: number;
};
export type FrameSize = { width: number; height: number };

export function normalizeBox(box: FoodBox, frame: FrameSize): FoodBox | null {
  if (
    ![box.x, box.y, box.width, box.height, frame.width, frame.height].every(
      Number.isFinite,
    ) ||
    frame.width <= 0 ||
    frame.height <= 0 ||
    box.width <= 0 ||
    box.height <= 0
  )
    return null;
  const x = Math.max(0, Math.min(1, box.x / frame.width));
  const y = Math.max(0, Math.min(1, box.y / frame.height));
  const right = Math.max(0, Math.min(1, (box.x + box.width) / frame.width));
  const bottom = Math.max(0, Math.min(1, (box.y + box.height) / frame.height));
  return right > x && bottom > y
    ? { x, y, width: right - x, height: bottom - y }
    : null;
}

// Inputs are upright, unmirrored normalized coordinates. Clip aspect-fill crops.
export function previewBox(
  box: FoodBox,
  frame: FrameSize,
  preview: FrameSize,
  mirrored = false,
): FoodBox | null {
  if (
    frame.width <= 0 ||
    frame.height <= 0 ||
    preview.width <= 0 ||
    preview.height <= 0
  )
    return null;
  const scale = Math.max(
    preview.width / frame.width,
    preview.height / frame.height,
  );
  const x =
    (mirrored ? 1 - box.x - box.width : box.x) * frame.width * scale -
    (frame.width * scale - preview.width) / 2;
  const y =
    box.y * frame.height * scale - (frame.height * scale - preview.height) / 2;
  const right = Math.min(preview.width, x + box.width * frame.width * scale);
  const bottom = Math.min(
    preview.height,
    y + box.height * frame.height * scale,
  );
  return right > Math.max(0, x) && bottom > Math.max(0, y)
    ? {
        x: Math.max(0, x),
        y: Math.max(0, y),
        width: right - Math.max(0, x),
        height: bottom - Math.max(0, y),
      }
    : null;
}

export function overlap(a: FoodBox, b: FoodBox) {
  const intersection =
    Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
    Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return (
    intersection / (a.width * a.height + b.width * b.height - intersection || 1)
  );
}

export function createFoodTracker() {
  let nextId = 1;
  let tracks: FoodTrack[] = [];
  return {
    update(detections: FoodDetection[]) {
      const remaining = new Set(tracks);
      tracks = detections
        .filter((d) => d.confidence >= 0.5)
        .slice(0, 5)
        .map((detection) => {
          const match = [...remaining].sort(
            (a, b) =>
              overlap(b.box, detection.box) - overlap(a.box, detection.box),
          )[0];
          if (match && overlap(match.box, detection.box) >= 0.3) {
            remaining.delete(match);
            return {
              ...detection,
              id: match.id,
              hits: match.hits + 1,
              missed: 0,
            };
          }
          return { ...detection, id: nextId++, hits: 1, missed: 0 };
        });
      // Hide missing boxes immediately, retain IDs for one dropped inference.
      tracks.push(
        ...[...remaining]
          .filter((t) => t.missed < 1)
          .map((t) => ({ ...t, missed: t.missed + 1 })),
      );
      return tracks.filter((t) => t.missed === 0);
    },
  };
}
