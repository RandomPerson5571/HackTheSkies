import { useImperativeHandle, useRef, type Ref } from "react";
import { CameraView, type CameraViewProps } from "expo-camera";
import type { FoodCameraHandle } from "./FoodCameraView.types";

export function FoodCameraView({
  ref,
  ...props
}: CameraViewProps & { ref?: Ref<FoodCameraHandle> }) {
  const camera = useRef<CameraView>(null);
  useImperativeHandle(
    ref,
    () => ({
      async takePictureAsync(options) {
        if (!camera.current) throw new Error("The camera is not ready yet.");
        return camera.current.takePictureAsync(options);
      },
    }),
    [],
  );
  return <CameraView ref={camera} {...props} />;
}
