import type { DishBounds } from "../models/foodTracking";
import type { CameraCapturedPicture, CameraPictureOptions } from "expo-camera";

export type FoodCameraHandle = {
  takePictureAsync: (
    options?: CameraPictureOptions,
  ) => Promise<CameraCapturedPicture>;
};

export type FoodTrackingProps = {
  tracking?: boolean;
  onTrackingError?: (message: string) => void;
  onTracking?: (anchor: DishBounds) => void;
};
