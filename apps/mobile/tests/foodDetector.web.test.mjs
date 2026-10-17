import assert from "node:assert/strict";
import { test } from "node:test";
import { ObjectDetection } from "@tensorflow-models/coco-ssd";
import { initializeFoodDetectorBackend } from "../src/features/food-dex/services/foodDetector.web.ts";

test("browser detector registers CPU and falls back when WebGL is unavailable", async () => {
  const tf = await initializeFoodDetectorBackend();
  assert.ok(tf.findBackend("cpu"));
  assert.equal(tf.getBackend(), "cpu");
});

test("COCO-SSD suppression handles repeated frames without backend errors, WebGL warnings or tensor leaks", async () => {
  const tf = await initializeFoodDetectorBackend();
  const detector = new ObjectDetection("lite_mobilenet_v2");
  // Exercise the installed model's real detect/suppression path with fixed graph
  // outputs. No network download or physical camera is needed for this regression.
  detector.model = {
    async executeAsync() {
      const scores = new Float32Array(180);
      scores[58] = 0.9; // COCO class 59: pizza.
      scores[90 + 58] = 0.8;
      return [
        tf.tensor3d(scores, [1, 2, 90]),
        tf.tensor4d([0, 0, 1, 1, 0.05, 0.05, 0.95, 0.95], [1, 2, 1, 4]),
      ];
    },
    dispose() {},
  };
  const input = tf.zeros([8, 8, 3], "int32");
  const baseline = tf.memory().numTensors;
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  try {
    for (let frame = 0; frame < 20; frame++) {
      const result = await detector.detect(input, 20, 0.5);
      assert.equal(result.length, 1);
      assert.equal(result[0].class, "pizza");
      assert.deepEqual(result[0].bbox, [0, 0, 8, 8]);
      assert.equal(tf.getBackend(), "cpu");
      assert.equal(tf.memory().numTensors, baseline);
    }
    assert.equal(
      warnings.some((warning) =>
        /nonMaxSuppression.*locks the UI thread/.test(warning),
      ),
      false,
    );
  } finally {
    console.warn = originalWarn;
    input.dispose();
    detector.dispose();
  }
});
