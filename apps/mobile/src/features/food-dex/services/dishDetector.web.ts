import { decodeYolo, letterboxRgb } from "../models/yolo";
import type { Detection } from "../models/foodTracking";
type Ort = typeof import("onnxruntime-web");
const version = "1.24.3";
let runtime: Promise<Ort> | undefined;

// Load the browser distribution directly: its WASM worker uses dynamic imports
// that Metro cannot rewrite. The version matches our installed type definitions.
function loadRuntime(): Promise<Ort> {
  runtime ??= new Promise<Ort>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/ort.min.js`;
    script.crossOrigin = "anonymous";
    script.onload = () => {
      const ort = (globalThis as typeof globalThis & { ort?: Ort }).ort;
      if (!ort) {
        reject(new Error("YOLO runtime did not load"));
        return;
      }
      ort.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${version}/dist/`;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = true;
      resolve(ort);
    };
    script.onerror = () => {
      script.remove();
      reject(new Error("Could not download object tracking runtime"));
    };
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    runtime = undefined;
    throw error;
  });
  return runtime;
}
async function createDetector() {
  const ort = await loadRuntime();
  const session = await ort.InferenceSession.create(
    "https://huggingface.co/onnx-community/YOLOv10/resolve/main/yolov10n.onnx",
    { executionProviders: ["wasm"] },
  );
  return { session, Tensor: ort.Tensor };
}
let detector: ReturnType<typeof createDetector> | undefined;
export async function detectDish(frame: ImageData): Promise<Detection[]> {
  detector ??= createDetector().catch((error: unknown) => {
    detector = undefined;
    throw error;
  });
  const { session, Tensor } = await detector;
  const { data, width, height, offsetX, offsetY } = letterboxRgb(frame);
  const input = new Tensor("float32", data, [1, 3, 640, 640]);
  try {
    const output = await session.run({ [session.inputNames[0]!]: input });
    const tensor = output[session.outputNames[0]!]!;
    try {
      if (tensor.dims[tensor.dims.length - 1] !== 6)
        throw new Error("Unexpected YOLO output");
      return decodeYolo(
        tensor.data as Float32Array,
        width,
        height,
        offsetX,
        offsetY,
      );
    } finally {
      Object.values(output).forEach((value) => value.dispose());
    }
  } finally {
    input.dispose();
  }
}
