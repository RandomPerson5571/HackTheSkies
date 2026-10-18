import { Platform } from "react-native";

const themedColor = (name: string, fallback: string) =>
  Platform.OS === "web" ? `var(--cibo-${name}, ${fallback})` : fallback;

// Matcha is the default palette. On web, these tokens resolve through the
// selected profile theme so every screen updates without rebuilding styles.
export const colors = {
  ink: themedColor("ink", "#253D6A"),
  muted: themedColor("muted", "#596A97"),
  paper: themedColor("paper", "#FFFDF5"),
  white: themedColor("white", "#FFFDF5"),
  accent: themedColor("accent", "#253D6A"),
  border: themedColor("border", "#E6E9D2"),
  tint: themedColor("tint", "#F3F4E7"),
  blue: themedColor("blue", "#253D6A"),
  gold: "#F4C542",
  coral: "#FF7A6B",
  scrim: themedColor("scrim", "#3D568F66"),
};

export function applyAvatarTheme(palette: {
  background: string;
  foreground: string;
}) {
  if (Platform.OS !== "web" || typeof document === "undefined") return;
  const root = document.documentElement.style;
  root.setProperty("--cibo-ink", palette.foreground);
  root.setProperty("--cibo-accent", palette.foreground);
  root.setProperty("--cibo-blue", palette.foreground);
  root.setProperty("--cibo-tint", palette.background);
  root.setProperty(
    "--cibo-muted",
    `color-mix(in srgb, ${palette.foreground} 76%, #fffdf5)`,
  );
  root.setProperty(
    "--cibo-border",
    `color-mix(in srgb, ${palette.background} 68%, #ffffff)`,
  );
  root.setProperty(
    "--cibo-paper",
    `color-mix(in srgb, ${palette.background} 14%, #fffdf5)`,
  );
  root.setProperty(
    "--cibo-white",
    `color-mix(in srgb, ${palette.background} 8%, #fffdf5)`,
  );
  root.setProperty(
    "--cibo-scrim",
    `color-mix(in srgb, ${palette.foreground} 40%, transparent)`,
  );
}

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
