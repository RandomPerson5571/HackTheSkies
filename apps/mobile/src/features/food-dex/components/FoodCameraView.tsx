import {
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import {
  CameraView,
  type CameraViewProps,
  type CameraCapturedPicture,
} from "expo-camera";
import type {
  FoodCameraHandle,
  FoodTrackingProps,
} from "./FoodCameraView.types";
import {
  projectDish,
  selectDish,
  type Detection,
  type DishBounds,
} from "../models/foodTracking";
import { deleteScanImage } from "../services/scanImages";

export function FoodCameraView({
  ref,
  tracking,
  onTracking,
  onTrackingError,
  onLayout,
  ...props
}: CameraViewProps & FoodTrackingProps & { ref?: Ref<FoodCameraHandle> }) {
  const camera = useRef<CameraView>(null);
  const pending = useRef<Promise<CameraCapturedPicture> | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const tracked = useEffectEvent((box: DishBounds) => onTracking?.(box));
  const failed = useEffectEvent(() =>
    onTrackingError?.(
      "Object tracking is unavailable. Check your connection and development build. You can still take a photo.",
    ),
  );
  useEffect(() => {
    if (!tracking || !size.width || !size.height) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let previous: Detection | undefined;
    async function tick() {
      let image: CameraCapturedPicture | undefined;
      try {
        const { detectDish } = await import("../services/dishDetector.native");
        if (cancelled) return;
        if (camera.current && !pending.current) {
          const capture = camera.current.takePictureAsync({
            quality: 0.4,
            base64: false,
            shutterSound: false,
          });
          pending.current = capture;
          try {
            image = await capture;
          } finally {
            if (pending.current === capture) pending.current = null;
          }
          if (cancelled) return;
          const result = await detectDish(image);
          if (cancelled) return;
          const dish = selectDish(result, previous);
          previous = dish;
          tracked(
            dish
              ? projectDish(dish.box, image, size, props.facing === "front")
              : { x: 0, y: 0, width: 0, height: 0, visible: false },
          );
        }
        if (!cancelled) timer = setTimeout(() => void tick(), 250);
      } catch {
        if (!cancelled) {
          tracked({ x: 0, y: 0, width: 0, height: 0, visible: false });
          failed();
        }
      } finally {
        if (image) deleteScanImage(image.uri);
      }
    }
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [tracking, size, props.facing]);
  useImperativeHandle(
    ref,
    () => ({
      async takePictureAsync(options) {
        if (pending.current) await pending.current.catch(() => {});
        if (!camera.current) throw new Error("The camera is not ready yet.");
        const capture = camera.current.takePictureAsync(options);
        pending.current = capture;
        try {
          return await capture;
        } finally {
          if (pending.current === capture) pending.current = null;
        }
      },
    }),
    [],
  );
  return (
    <CameraView
      ref={camera}
      {...props}
      onLayout={(event) => {
        setSize(event.nativeEvent.layout);
        onLayout?.(event);
      }}
    />
  );
}
