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
import type { FoodCameraHandle } from "./FoodCameraView.types";

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
> & { ref?: Ref<FoodCameraHandle> };

// Browser capture always stays in this video element. No capture file input,
// external camera application, or fullscreen player is involved.
export function FoodCameraView({
  ref,
  facing = "back",
  style,
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
