import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { Platform } from "react-native";
import type { FrameSize, FoodBox } from "../models/foodDetection";

export function deleteScanImage(uri: string) {
  if (Platform.OS === "web") {
    if (uri.startsWith("blob:")) URL.revokeObjectURL(uri);
    return;
  }
  if (!uri.startsWith("file:")) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* Temporary cache is also managed by the OS. */
  }
}

export async function resizeScanImage(
  image: FrameSize & { uri: string },
  maxSize: number,
  base64 = false,
  box?: FoodBox,
) {
  const context = ImageManipulator.manipulate(image.uri);
  let width = image.width;
  let height = image.height;
  if (box) {
    const originX = Math.max(0, Math.floor(box.x * width));
    const originY = Math.max(0, Math.floor(box.y * height));
    width = Math.max(
      1,
      Math.min(width - originX, Math.round(box.width * width)),
    );
    height = Math.max(
      1,
      Math.min(height - originY, Math.round(box.height * height)),
    );
    context.crop({ originX, originY, width, height });
  }
  if (Math.max(width, height) > maxSize)
    context.resize(width >= height ? { width: maxSize } : { height: maxSize });
  try {
    const rendered = await context.renderAsync();
    try {
      return await rendered.saveAsync({
        format: SaveFormat.JPEG,
        compress: 0.65,
        base64,
      });
    } finally {
      rendered.release();
    }
  } finally {
    context.release();
  }
}
