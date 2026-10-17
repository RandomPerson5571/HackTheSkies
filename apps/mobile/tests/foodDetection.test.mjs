import assert from "node:assert/strict";
import { test } from "node:test";
import {
  normalizeBox,
  previewBox,
  createFoodTracker,
} from "../src/features/food-dex/models/foodDetection.ts";

test("boxes map to an aspect-fill preview and clip cropped edges", () => {
  assert.deepEqual(
    previewBox(
      { x: 0.25, y: 0.25, width: 0.5, height: 0.5 },
      { width: 400, height: 300 },
      { width: 200, height: 300 },
    ),
    { x: 0, y: 75, width: 200, height: 150 },
  );
  assert.equal(
    previewBox(
      { x: 0, y: 0, width: 0.1, height: 0.1 },
      { width: 400, height: 300 },
      { width: 100, height: 300 },
    ),
    null,
  );
  assert.deepEqual(
    previewBox(
      { x: 0.1, y: 0.2, width: 0.6, height: 0.4 },
      { width: 300, height: 400 },
      { width: 300, height: 400 },
    ),
    { x: 30, y: 80, width: 180, height: 160 },
  );
});
test("normalization rejects invalid detections and clamps out-of-frame boxes", () => {
  const frame = { width: 100, height: 200 };
  const normalized = normalizeBox(
    { x: -10, y: 40, width: 60, height: 80 },
    frame,
  );
  assert.equal(normalized.x, 0);
  assert.equal(normalized.y, 0.2);
  assert.equal(normalized.width, 0.5);
  assert.ok(Math.abs(normalized.height - 0.4) < 1e-10);
  assert.equal(
    normalizeBox({ x: NaN, y: 0, width: 20, height: 20 }, frame),
    null,
  );
  assert.equal(
    normalizeBox({ x: 120, y: 0, width: 20, height: 20 }, frame),
    null,
  );
  assert.equal(
    previewBox(
      { x: 0, y: 0, width: 1, height: 1 },
      { width: 0, height: 0 },
      frame,
    ),
    null,
  );
});
test("tracking follows multiple foods despite changed result order and drops missing boxes", () => {
  const tracker = createFoodTracker();
  const a = {
    box: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 },
    confidence: 0.9,
  };
  const b = {
    box: { x: 0.6, y: 0.5, width: 0.3, height: 0.3 },
    confidence: 0.9,
  };
  const first = tracker.update([a, b]);
  const second = tracker.update([b, { ...a, box: { ...a.box, x: 0.11 } }]);
  assert.equal(second[0].id, first[1].id);
  assert.equal(second[1].id, first[0].id);
  assert.equal(second[1].hits, 2);
  assert.deepEqual(tracker.update([]), []);
  assert.equal(tracker.update([a])[0].id, first[0].id);
  tracker.update([]);
  tracker.update([]);
  assert.notEqual(tracker.update([a])[0].id, first[0].id);
  assert.deepEqual(tracker.update([{ ...a, confidence: 0.1 }]), []);
});

test("front preview mirrors boxes while captured-image coordinates stay upright", () => {
  const box = { x: 0.1, y: 0.2, width: 0.3, height: 0.4 };
  const frame = { width: 100, height: 200 };
  const mirrored = previewBox(box, frame, frame, true);
  const captured = previewBox(box, frame, frame);
  assert.ok(Math.abs(mirrored.x - 60) < 1e-10);
  assert.equal(captured.x, 10);
  assert.ok(Math.abs(mirrored.width - captured.width) < 1e-10);
});
