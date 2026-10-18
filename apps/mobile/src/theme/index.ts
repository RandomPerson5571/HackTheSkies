import { Platform, type ViewStyle } from "react-native";

// Cibo's palette: deep blue with a light lime secondary.
export const colors = {
  ink: "#3D568F",
  muted: "#596A97",
  paper: "#FFFDF5",
  white: "#FFFDF5",
  accent: "#3D568F",
  border: "#D5DDB1",
  tint: "#EAF3B2",
  blue: "#3D568F",
  scrim: "#3D568F40",
};

const webBlur =
  Platform.OS === "web"
    ? { backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)" }
    : {};

export const frostedGlass = {
  ...webBlur,
  backgroundColor: "rgba(255,253,245,0.07)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.28)",
} as ViewStyle;

export const frostedGlassTint = {
  ...webBlur,
  backgroundColor: "rgba(234,243,178,0.11)",
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.30)",
} as ViewStyle;

export const frostedGlassSelected = {
  ...webBlur,
  backgroundColor: "rgba(234,243,178,0.48)",
  borderWidth: 1,
  borderColor: "rgba(61,86,143,0.24)",
} as ViewStyle;

// Camera overlays stay legible over both light and dark live images.
export const cameraColors = {
  background: "#090C12",
  surface: "#121925EB",
  foreground: "#FFFFFF",
  muted: "#D5DCE8",
  border: "#FFFFFF66",
};
