import { Asset } from "expo-asset";
import { File } from "expo-file-system";
import { decode } from "jpeg-js";
import type { CameraCapturedPicture } from "expo-camera";
import { resizeScanImage, deleteScanImage } from "./scanImages";
import type { Detection } from "../models/foodTracking";
import { decodeYolo, letterboxRgb, YOLO_INPUT_SIZE } from "../models/yolo";

// The runtime is imported lazily so older development clients can still capture.
async function createDetector() {
  const { InferenceSession, Tensor } = await import("onnxruntime-react-native");
  const asset = Asset.fromModule(
    require("../../../../assets/models/food-yolo11n-416.onnx"),
  );
  await asset.downloadAsync();
  const session = await InferenceSession.create(
    (asset.localUri ?? asset.uri).replace(/^file:\/\//, ""),
    { intraOpNumThreads: 2, interOpNumThreads: 1 },
  );
  return { session, Tensor };
}
let detector: ReturnType<typeof createDetector> | undefined;
async function detectFrame(image: CameraCapturedPicture): Promise<Detection[]> {
  detector ??= createDetector().catch((error: unknown) => {
    detector = undefined;
    throw error;
  });
  const { session, Tensor } = await detector;
  // Raw bytes skip the base64 encode/decode round trip on the JS thread,
  // which would otherwise stall every tracking frame on giant image payloads.
  const resized = await resizeScanImage(image, YOLO_INPUT_SIZE, false);
  try {
    const bytes = await new File(resized.uri).bytes();
    const rgb = decode(bytes, { useTArray: true, formatAsRGBA: true });
    const { data, width, height, offsetX, offsetY } = letterboxRgb(rgb);
    const input = new Tensor("float32", data, [
      1,
      3,
      YOLO_INPUT_SIZE,
      YOLO_INPUT_SIZE,
    ]);
    try {
      const output = await session.run({ [session.inputNames[0]!]: input });
      try {
        const tensor = output[session.outputNames[0]!]!;
        if (tensor.dims.length !== 3 || tensor.dims[1] !== 5)
          throw new Error("Unexpected YOLO output");
        return decodeYolo(
          tensor.data as Float32Array,
          width,
          height,
          offsetX,
          offsetY,
        ).map((detection) => ({
          ...detection,
          frameSize: { width: rgb.width, height: rgb.height },
        }));
      } finally {
        Object.values(output).forEach((value) => value.dispose());
      }
    } finally {
      input.dispose();
    }
  } finally {
    deleteScanImage(resized.uri);
  }
}

// A remount or camera switch may overlap cleanup with the previous inference.
// Drop that sample instead of queuing work on the shared session.
let busy = false;
export async function detectDish(
  frame: CameraCapturedPicture,
): Promise<Detection[]> {
  if (busy) return [];
  busy = true;
  try {
    return await detectFrame(frame);
  } finally {
    busy = false;
  }
}
