import { File, Paths } from "expo-file-system";
import { decode } from "jpeg-js";
import type { CameraCapturedPicture } from "expo-camera";
import { resizeScanImage, deleteScanImage } from "./scanImages";
import type { Detection } from "../models/foodTracking";
import { decodeYolo, letterboxRgb } from "../models/yolo";

// The runtime is imported lazily so older development clients can still capture.
async function createDetector() {
  const { InferenceSession, Tensor } = await import("onnxruntime-react-native");
  const destination = new File(Paths.cache, "cibo-yolov10n.onnx");
  if (!destination.exists)
    await File.downloadFileAsync(
      "https://huggingface.co/onnx-community/YOLOv10/resolve/main/yolov10n.onnx",
      destination,
      { idempotent: true },
    );
  const session = await InferenceSession.create(
    destination.uri.replace(/^file:\/\//, ""),
  );
  return { session, Tensor };
}
let detector: ReturnType<typeof createDetector> | undefined;
export async function detectDish(
  image: CameraCapturedPicture,
): Promise<Detection[]> {
  detector ??= createDetector().catch((error: unknown) => {
    detector = undefined;
    throw error;
  });
  const { session, Tensor } = await detector;
  const resized = await resizeScanImage(image, 640, true);
  try {
    if (!resized.base64) throw new Error("Missing tracking frame");
    const bytes = Uint8Array.from(atob(resized.base64), (c) => c.charCodeAt(0));
    const rgb = decode(bytes, { useTArray: true, formatAsRGBA: true });
    const { data, width, height, offsetX, offsetY } = letterboxRgb(rgb);
    const input = new Tensor("float32", data, [1, 3, 640, 640]);
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
      input.dispose();
      Object.values(output).forEach((value) => value.dispose());
    }
  } finally {
    deleteScanImage(resized.uri);
  }
}
