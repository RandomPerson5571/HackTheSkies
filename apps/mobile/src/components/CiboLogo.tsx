import { Image, StyleSheet } from "react-native";

// Keep the original map wordmark as the single brand asset for every screen.
const logo = require("../../assets/cibo.png");

export function CiboLogo() {
  return (
    <Image
      accessibilityRole="image"
      accessibilityLabel="Cibo"
      source={logo}
      resizeMode="contain"
      style={styles.logo}
    />
  );
}

// One size and aspect ratio across every app header.
const styles = StyleSheet.create({
  logo: { width: 96, height: 96 * (389 / 923), flexShrink: 0 },
});
