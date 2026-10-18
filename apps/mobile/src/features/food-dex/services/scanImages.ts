import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { Platform } from "react-native";

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
  image: { uri: string; width: number; height: number },
  maxSize: number,
  base64 = false,
) {
  const context = ImageManipulator.manipulate(image.uri);
  const { width, height } = image;
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
