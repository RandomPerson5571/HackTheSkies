import assert from "node:assert/strict";
import test from "node:test";
import {
  arrowToBox,
  projectDish,
  selectDish,
} from "../src/features/food-dex/models/foodTracking.ts";
import {
  decodeYolo,
  letterboxRgb,
  YOLO_INPUT_SIZE,
} from "../src/features/food-dex/models/yolo.ts";

test("cover projection accounts for portrait crop and front camera mirroring", () => {
  const source = { width: 1280, height: 960 };
  const preview = { width: 400, height: 800 };
  const box = { xmin: 0.4, ymin: 0.2, xmax: 0.6, ymax: 0.7 };
  const actual = projectDish(box, source, preview, false);
  assert.ok(Math.abs(actual.x - 0.2333333333) < 1e-8);
  assert.equal(actual.y, 0.2);
  assert.ok(Math.abs(actual.width - 0.5333333333) < 1e-8);
  const mirrored = projectDish(
    { ...box, xmin: 0.5, xmax: 0.7 },
    source,
    preview,
    true,
  );
  const normal = projectDish(
    { ...box, xmin: 0.5, xmax: 0.7 },
    source,
    preview,
    false,
  );
  assert.ok(Math.abs(mirrored.x - (1 - normal.x - normal.width)) < 1e-8);
});

test("arrows land outside box edges and respond to object movement", () => {
  const from = { x: 0, y: 100 };
  assert.deepEqual(
    arrowToBox(from, { x: 100, y: 50, width: 100, height: 100 }),
    { x: 92, y: 100 },
  );
  assert.deepEqual(
    arrowToBox(from, { x: 160, y: 50, width: 100, height: 100 }),
    { x: 152, y: 100 },
  );
  const diagonal = arrowToBox(
    { x: 0, y: 0 },
    { x: 100, y: 100, width: 100, height: 100 },
  );
  assert.equal(diagonal.x, 92);
  assert.equal(diagonal.y, 92);
});

test("tracking selects the largest food box regardless of confidence or position", () => {
  const original = {
    label: "pizza",
    score: 0.6,
    box: { xmin: 0.05, ymin: 0.05, xmax: 0.5, ymax: 0.5 },
  };
  const other = {
    label: "cake",
    score: 0.95,
    box: { xmin: 0.6, ymin: 0.6, xmax: 0.9, ymax: 0.9 },
  };
  assert.equal(selectDish([other, original]), original);
  assert.equal(selectDish([original, other]), original);
  const larger = { ...other, box: { xmin: 0, ymin: 0, xmax: 1, ymax: 1 } };
  assert.equal(selectDish([original, larger]), larger);
  assert.equal(
    selectDish([original, { ...larger, label: "person" }]),
    original,
  );
  assert.equal(selectDish([original, { ...larger, score: 0.1 }]), original);
  assert.equal(selectDish([]), undefined);
  assert.equal(selectDish([{ ...original, label: "person" }]), undefined);
  assert.equal(selectDish([{ ...original, score: 0.1 }]), undefined);
});

test("YOLO preprocessing uses RGB planes and decoder reverses letterboxing", () => {
  const input = {
    data: new Uint8Array([255, 0, 0, 255, 0, 255, 0, 255]),
    width: 2,
    height: 1,
  };
  const encoded = letterboxRgb(input);
  assert.equal(encoded.offsetY, 104);
  assert.equal(encoded.data[104 * YOLO_INPUT_SIZE], 1);
  assert.equal(
    encoded.data[YOLO_INPUT_SIZE * YOLO_INPUT_SIZE + 104 * YOLO_INPUT_SIZE],
    0,
  );
  const detections = decodeYolo(
    new Float32Array([208, 208, 416, 208, 0.9]),
    encoded.width,
    encoded.height,
    encoded.offsetX,
    encoded.offsetY,
  );
  assert.equal(detections.length, 1);
  assert.equal(detections[0].label, "food");
  assert.deepEqual(detections[0].box, { xmin: 0, ymin: 0, xmax: 1, ymax: 1 });
});

test("invalid and cropped-out boxes return null instead of edge coordinates", () => {
  const source = { width: 1280, height: 960 };
  const preview = { width: 400, height: 800 };
  for (const box of [
    { xmin: 0, ymin: 0, xmax: 0, ymax: 0 },
    { xmin: 0.8, ymin: 0.2, xmax: 0.2, ymax: 0.8 },
    { xmin: NaN, ymin: 0.2, xmax: 0.8, ymax: 0.8 },
    { xmin: 0, ymin: 0.2, xmax: 0.05, ymax: 0.8 },
    { xmin: -1, ymin: 0.2, xmax: 0.8, ymax: 0.8 },
  ])
    assert.equal(projectDish(box, source, preview, false), null);
  assert.equal(
    projectDish(
      { xmin: 0.2, ymin: 0.2, xmax: 0.8, ymax: 0.8 },
      source,
      { width: 0, height: 0 },
      false,
    ),
    null,
  );
});

test("rotation is applied before cover projection and mirroring", () => {
  const box = { xmin: 0.1, ymin: 0.2, xmax: 0.4, ymax: 0.6 };
  const source = { width: 800, height: 400 };
  const preview = { width: 400, height: 800 };
  const projected = projectDish(box, source, preview, false, 90);
  assert.ok(Math.abs(projected.x - 0.4) < 1e-8);
  assert.ok(Math.abs(projected.y - 0.1) < 1e-8);
  assert.ok(Math.abs(projected.width - 0.4) < 1e-8);
  assert.ok(Math.abs(projected.height - 0.3) < 1e-8);
});

test("food anchors use NMS, reject invalid boxes and ignore low confidence", () => {
  // Five channels, four anchors: two overlapping, one invalid, one low score.
  const data = new Float32Array([
    100,
    102,
    NaN,
    300,
    100,
    102,
    100,
    300,
    80,
    80,
    80,
    80,
    80,
    80,
    80,
    80,
    0.9,
    0.8,
    0.9,
    0.1,
  ]);
  const detections = decodeYolo(data, 416, 416, 0, 0);
  assert.equal(detections.length, 1);
  assert.equal(detections[0].label, "food");
  assert.equal(selectDish(detections), detections[0]);
  assert.throws(() => decodeYolo(new Float32Array(6), 416, 416, 0, 0));
});
