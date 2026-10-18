import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import test from "node:test";
import * as ort from "onnxruntime-web";
import {
  decodeYolo,
  YOLO_INPUT_SIZE,
} from "../src/features/food-dex/models/yolo.ts";

test("bundled food model runs in the app's WASM runtime and matches the decoder contract", async () => {
  ort.env.wasm.numThreads = 1;
  const session = await ort.InferenceSession.create(
    fileURLToPath(
      new URL("../assets/models/food-yolo11n-416.onnx", import.meta.url),
    ),
    { executionProviders: ["wasm"] },
  );
  const input = new ort.Tensor(
    "float32",
    new Float32Array(3 * YOLO_INPUT_SIZE ** 2),
    [1, 3, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE],
  );
  try {
    const output = await session.run({ [session.inputNames[0]]: input });
    try {
      assert.equal(session.outputNames.length, 1);
      const boxes = output[session.outputNames[0]];
      assert.deepEqual(boxes.dims, [1, 5, 3549]);
      assert.ok(boxes.data.every(Number.isFinite));
      assert.deepEqual(
        decodeYolo(boxes.data, YOLO_INPUT_SIZE, YOLO_INPUT_SIZE, 0, 0),
        [],
      );
    } finally {
      Object.values(output).forEach((tensor) => tensor.dispose());
    }
  } finally {
    input.dispose();
    await session.release();
  }
});
