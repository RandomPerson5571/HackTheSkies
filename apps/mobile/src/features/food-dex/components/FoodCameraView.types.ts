import type { CameraCapturedPicture, CameraPictureOptions } from "expo-camera";

export type FoodCameraHandle = {
  takePictureAsync: (
    options?: CameraPictureOptions,
  ) => Promise<CameraCapturedPicture>;
};
