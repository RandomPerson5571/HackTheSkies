import { useEffect, useRef, useState, type RefObject } from "react";
import type { CameraCapturedPicture } from "expo-camera";
import type { FoodCameraHandle } from "../components/FoodCameraView.types";
import { Platform } from "react-native";
import {
  createFoodTracker,
  type FoodTrack,
  type FrameSize,
} from "../models/foodDetection";
import type {
  FoodDetector,
  DetectionImage,
} from "../services/foodDetector.types";
import { loadFoodDetector } from "../services/foodDetector";
import { resizeScanImage, deleteScanImage } from "../services/scanImages";

// Expo exposes still captures, not raw frames. Sample at most 5 Hz, one job at a
// time; the actual inference rate depends on capture + resize + detector latency.
// The lock also lets the shutter wait for an in-progress local sample.
export function useLiveFoodDetection(
  camera: RefObject<FoodCameraHandle | null>,
  enabled: boolean,
  sessionKey: string,
) {
  const [tracks, setTracks] = useState<FoodTrack[]>([]);
  const [frame, setFrame] = useState<FrameSize & { mirrored?: boolean }>({
    width: 0,
    height: 0,
  });
  const [status, setStatus] = useState("Loading food detector…");
  const captureInFlight = useRef<Promise<CameraCapturedPicture> | null>(null);
  const shutterRequested = useRef(false);
  const detectorRef = useRef<FoodDetector | null>(null);
  const sampleInFlight = useRef<Promise<void> | null>(null);
  const [trackedSession, setTrackedSession] = useState(sessionKey);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tracker = createFoodTracker();
    async function sample() {
      if (cancelled || shutterRequested.current || !camera.current) return;
      const started = Date.now();
      let original: CameraCapturedPicture | undefined;
      let resized: { uri: string } | undefined;
      try {
        const detector = await loadFoodDetector();
        detectorRef.current = detector;
        if (cancelled || shutterRequested.current || !camera.current) return;
        const job = camera.current.takePictureAsync({
          quality: 0.2,
          shutterSound: false,
          exif: true,
        });
        captureInFlight.current = job;
        try {
          original = await job;
        } finally {
          if (captureInFlight.current === job) captureInFlight.current = null;
        }
        if (cancelled || shutterRequested.current) return;
        const image = await resizeScanImage(original, 320);
        resized = image;
        const detections = await detector.detect(image);
        if (cancelled || shutterRequested.current) return;
        setTrackedSession(sessionKey);
        setFrame({
          width: image.width,
          height: image.height,
          mirrored:
            Platform.OS === "web"
              ? original.exif?.facingMode === "user"
              : sessionKey.startsWith("front"),
        });
        const next = tracker.update(detections);
        setTracks(next);
        setStatus(
          next.length
            ? "Food detected. Tap a box to choose your dish."
            : "Point your camera at a dish.",
        );
      } catch {
        if (!cancelled) {
          setTracks([]);
          setStatus(
            "Live detection unavailable. You can still take and identify a photo.",
          );
        }
        return;
      } finally {
        if (resized) deleteScanImage(resized.uri);
        if (original) deleteScanImage(original.uri);
      }
      if (!cancelled && !shutterRequested.current)
        timer = setTimeout(run, Math.max(0, 200 - (Date.now() - started)));
    }
    function run() {
      const job = sample();
      sampleInFlight.current = job;
      void job.finally(() => {
        if (sampleInFlight.current === job) sampleInFlight.current = null;
      });
    }
    run();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [camera, enabled, sessionKey, retry]);
  return {
    tracks: enabled && trackedSession === sessionKey ? tracks : [],
    frame,
    status,
    pause: async () => {
      shutterRequested.current = true;
      await captureInFlight.current?.catch(() => {});
      if (detectorRef.current) await sampleInFlight.current;
    },
    resume: () => {
      shutterRequested.current = false;
      setRetry((value) => value + 1);
    },
    detectCaptured: async (image: DetectionImage) =>
      (await detectorRef.current?.detect(image)) ?? [],
    retry: () => setRetry((value) => value + 1),
  };
}
