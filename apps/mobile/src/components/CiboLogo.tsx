import { Image, StyleSheet } from "react-native";

import { ciboLogoSource } from "./ciboLogoSource";

export function CiboLogo() {
  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel="Cibo"
      source={ciboLogoSource}
      resizeMode="contain"
      style={styles.logo}
    />
  );
}

// One size and aspect ratio across every app header.
const styles = StyleSheet.create({
  logo: { width: 96, height: 96 * (389 / 923), flexShrink: 0 },
});
