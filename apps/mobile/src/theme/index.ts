import { Platform, type ViewStyle } from "react-native";

// Cibo's palette: deep blue with a light lime secondary.
export const colors = {
  ink: "#3D568F",
  muted: "#596A97",
  paper: "#FFFDF5",
  white: "#FFFDF5",
  accent: "#3D568F",
  border: "#E6E9D2",
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

// Collectible cards and the atlas share a night-sky surface and warm highlights.
export const discoveryColors = {
  night: "#172642",
  surface: "#213554",
  line: "#3D526F",
  muted: "#B8C7DC",
  light: "#FFFDF5",
  glow: "#EAF3B2",
  land: "#72929D",
  ocean: "#192E49",
  gold: "#F4DB91",
};

export const questColors = {
  ...colors,
  navy: "#253D6A",
  lime: "#EAF3B2",
  limeDark: "#657A21",
  lavender: "#EEEAF8",
  peach: "#FAE9D7",
  locked: "#ECEDE7",
  success: "#2F714C",
  danger: "#9F3E3E",
};
