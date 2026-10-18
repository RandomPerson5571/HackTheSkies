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

// Small captures keep every tracking frame cheap to grab, resize, and decode.
// Recognition input never needs more than 640px on its longest side.
function pickTrackingPictureSize(sizes: string[] | undefined) {
  if (!sizes?.length) return undefined;
  const candidates = sizes
    .map((value) => value.toLowerCase().split("x").map(Number))
    .filter(
      (pair) =>
        pair.length === 2 && pair.every((size) => Number.isFinite(size)),
    )
    .filter((pair) => Math.max(...pair) >= 640)
    .sort((a, b) => Math.max(...a) - Math.max(...b));
  return candidates[0] ? `${candidates[0][0]}x${candidates[0][1]}` : undefined;
}

const MISSES_BEFORE_UNAVAILABLE = 3;
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
  const misses = useRef(MISSES_BEFORE_UNAVAILABLE);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const tracked = useEffectEvent((box: DishBounds) => onTracking?.(box));
  const failed = useEffectEvent(() =>
    onTrackingError?.(
      "Object tracking is unavailable. Check your connection and development build. You can still take a photo.",
    ),
  );

  useEffect(() => {
    misses.current = 0;
  }, [tracking, size, props.facing]);

  useEffect(() => {
    let active = true;
    async function choosePictureSize() {
      try {
        const sizes = (
          await camera.current?.getAvailablePictureSizesAsync?.()
        )?.filter(Boolean);
        if (!active) return;
        setPictureSize(pickTrackingPictureSize(sizes));
      } catch {
        // Device enumeration is optional; keep the system default resolution.
      }
    }
    void choosePictureSize();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!tracking || !size.width || !size.height) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let previous: Detection | undefined;
    let lastSeen = 0;
    // Hidden tracking frames keep the last valid geometry; only `visible`
    // drops. Coordinates are never (0, 0) for a missing detection.
    let lastBounds: DishBounds | undefined;
    const hidden = () =>
      ({
        ...(lastBounds ?? { x: 0.28, y: 0.3, width: 0.44, height: 0.25 }),
        visible: !!lastBounds && Date.now() - lastSeen <= 700,
      }) satisfies DishBounds;
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
          const now = Date.now();
          if (dish) {
            previous = dish;
            misses.current = 0;
            const projected = projectDish(
              dish.box,
              dish.frameSize ?? image,
              size,
              props.facing === "front",
            );
            if (projected) {
              lastSeen = now;
              lastBounds = projected;
              tracked(projected);
            } else {
              lastBounds = undefined;
              lastSeen = 0;
              tracked(hidden());
            }
          } else {
            // Retarget only after the dish has clearly left the frame, so a
            // passing person or cup does not steal the anchor mid-meal.
            if (now - lastSeen > 650) previous = undefined;
            tracked(hidden());
          }
        }
        if (!cancelled) timer = setTimeout(() => void tick(), 250);
      } catch {
        if (cancelled) return;
        tracked(hidden());
        misses.current += 1;
        if (misses.current === MISSES_BEFORE_UNAVAILABLE) failed();
        // A busy capture call or a hiccup in the runtime recovers on its own;
        // keep polling instead of ending tracking on the first failure.
        timer = setTimeout(() => void tick(), 800);
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
      pictureSize={pictureSize ?? props.pictureSize}
      onLayout={(event) => {
        setSize(event.nativeEvent.layout);
        onLayout?.(event);
      }}
    />
  );
}
