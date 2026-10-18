import {
  createElement,
  useEffect,
  useEffectEvent,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { View } from "react-native";
import type { CameraViewProps } from "expo-camera";
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

type Props = Pick<
  CameraViewProps,
  | "style"
  | "facing"
  | "flash"
  | "enableTorch"
  | "mode"
  | "autofocus"
  | "mirror"
  | "animateShutter"
  | "onCameraReady"
  | "onMountError"
> &
  FoodTrackingProps & { ref?: Ref<FoodCameraHandle> };

// Browser capture always stays in this video element. No capture file input,
// external camera application, or fullscreen player is involved.
export function FoodCameraView({
  ref,
  facing = "back",
  style,
  tracking,
  onTracking,
  onTrackingError,
  onCameraReady,
  onMountError,
}: Props) {
  const video = useRef<HTMLVideoElement | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const [mirrored, setMirrored] = useState(false);
  const ready = useEffectEvent(() => onCameraReady?.());
  const failed = useEffectEvent((message: string) =>
    onMountError?.({ message }),
  );

  useEffect(() => {
    let cancelled = false;
    let session: MediaStream | null = null;
    const element = video.current;
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "Open the preview over HTTPS or localhost to use the camera.",
          );
        session = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing === "front" ? "user" : "environment" },
            width: { ideal: 1280 },
            height: { ideal: 960 },
          },
        });
        if (cancelled || !element) {
          session.getTracks().forEach((track) => track.stop());
          return;
        }
        stream.current = session;
        const settings = session.getVideoTracks()[0]?.getSettings();
        setMirrored(
          settings?.facingMode === "user" ||
            (!settings?.facingMode && facing === "front"),
        );
        element.srcObject = session;
        await element.play();
        if (!cancelled) ready();
      } catch (error) {
        session?.getTracks().forEach((track) => track.stop());
        if (!cancelled)
          failed(
            error instanceof Error
              ? error.message
              : "Couldn’t start the browser camera.",
          );
      }
    }
    void start();
    return () => {
      cancelled = true;
      session?.getTracks().forEach((track) => track.stop());
      if (element) element.srcObject = null;
      if (stream.current === session) stream.current = null;
    };
  }, [facing]);

  const tracked = useEffectEvent((bounds: DishBounds) => onTracking?.(bounds));
  const trackingFailed = useEffectEvent(() =>
    onTrackingError?.(
      "Object tracking is unavailable. You can still take a photo.",
    ),
  );
  // Preprocessing runs on the main thread, so the sampling canvas and cadence
  // stay small: letterboxing pads to the model's 640px input either way.
  const FRAME_WIDTH = 480;
  const MISSES_BEFORE_UNAVAILABLE = 3;
  useEffect(() => {
    if (!tracking) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let previous: Detection | undefined;
    let lastSeen = 0;
    let misses = 0;
    // Hidden frames keep the last valid geometry; only visibility drops, so a
    // missing detection is never represented at (0, 0).
    let lastBounds: DishBounds | undefined;
    const hidden = () =>
      ({
        ...(lastBounds ?? { x: 0.28, y: 0.3, width: 0.44, height: 0.25 }),
        visible: !!lastBounds && Date.now() - lastSeen <= 700,
      }) satisfies DishBounds;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    async function run() {
      try {
        const { detectDish } = await import("../services/dishDetector.web");
        if (cancelled) return;
        const element = video.current;
        if (element && element.readyState >= 2 && context) {
          canvas.width = FRAME_WIDTH;
          canvas.height = Math.round(
            (FRAME_WIDTH * element.videoHeight) / element.videoWidth,
          );
          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          const detections = await detectDish(
            context.getImageData(0, 0, canvas.width, canvas.height),
          );
          if (cancelled) return;
          const dish = selectDish(detections, previous);
          const now = Date.now();
          if (dish) {
            previous = dish;
            misses = 0;
            const bounds = element.getBoundingClientRect();
            if (bounds.width && bounds.height) {
              const projected = projectDish(
                dish.box,
                { width: element.videoWidth, height: element.videoHeight },
                bounds,
                mirrored,
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
            }
          } else {
            if (now - lastSeen > 650) previous = undefined;
            tracked(hidden());
          }
        }
        // Sequential inference: never queue frames or upload camera pixels.
        if (!cancelled) timer = setTimeout(() => void run(), 180);
      } catch {
        if (cancelled) return;
        tracked(hidden());
        misses += 1;
        if (misses === MISSES_BEFORE_UNAVAILABLE) trackingFailed();
        // A dropped frame or cold runtime download recovers with the next tick
        // instead of ending tracking on the first error.
        timer = setTimeout(() => void run(), 800);
      }
    }
    void run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      canvas.width = 0;
      canvas.height = 0;
    };
  }, [tracking, mirrored]);

  useImperativeHandle(
    ref,
    () => ({
      async takePictureAsync(options = {}) {
        const element = video.current;
        if (
          !element ||
          element.readyState < 2 ||
          !element.videoWidth ||
          !element.videoHeight
        )
          throw new Error(
            "The camera is still getting ready. Try again in a moment.",
          );
        const canvas = document.createElement("canvas");
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;
        const context = canvas.getContext("2d");
        if (!context)
          throw new Error("This browser couldn’t capture the photo.");
        context.drawImage(element, 0, 0);
        const uri = canvas.toDataURL("image/jpeg", options.quality ?? 0.7);
        const settings = stream.current?.getVideoTracks()[0]?.getSettings();
        const result = {
          uri,
          width: canvas.width,
          height: canvas.height,
          format: "jpg" as const,
          base64: options.base64 ? uri.slice(uri.indexOf(",") + 1) : undefined,
          exif: { ...settings, facingMode: mirrored ? "user" : "environment" },
        };
        canvas.width = 0;
        canvas.height = 0;
        return result;
      },
    }),
    [mirrored],
  );

  return (
    <View style={style}>
      {createElement("video", {
        ref: video,
        autoPlay: true,
        muted: true,
        playsInline: true,
        "aria-label": "Live food camera",
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: mirrored ? "scaleX(-1)" : undefined,
        },
      })}
    </View>
  );
}
