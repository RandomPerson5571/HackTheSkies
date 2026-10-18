import { Image } from "expo-image";
import { StyleSheet, Text, View } from "react-native";
import type { BadgeId } from "../../gamification/models/gamification";
import type { RankId, avatarPalettes } from "../models/customization";

const trophies = {
  "first-bite": require("../../../../assets/rewards/trophy-first-bite.svg"),
  "cuisine-explorer": require("../../../../assets/rewards/trophy-cuisine-explorer.svg"),
  "world-taster": require("../../../../assets/rewards/trophy-world-taster.svg"),
  collector: require("../../../../assets/rewards/trophy-collector.svg"),
  foodie: require("../../../../assets/rewards/trophy-foodie.svg"),
  gourmet: require("../../../../assets/rewards/trophy-gourmet.svg"),
  rater: require("../../../../assets/rewards/trophy-rater.svg"),
  critic: require("../../../../assets/rewards/trophy-critic.svg"),
  saver: require("../../../../assets/rewards/trophy-saver.svg"),
  wanderer: require("../../../../assets/rewards/trophy-wanderer.svg"),
  "streak-3": require("../../../../assets/rewards/trophy-streak-3.svg"),
  "streak-7": require("../../../../assets/rewards/trophy-streak-7.svg"),
  "passport-pro": require("../../../../assets/rewards/trophy-passport-pro.svg"),
  "menu-maestro": require("../../../../assets/rewards/trophy-menu-maestro.svg"),
  "century-supper": require("../../../../assets/rewards/trophy-century-supper.svg"),
  curator: require("../../../../assets/rewards/trophy-curator.svg"),
  "pin-collector": require("../../../../assets/rewards/trophy-pin-collector.svg"),
  "peoples-palate": require("../../../../assets/rewards/trophy-peoples-palate.svg"),
  "two-week-taster": require("../../../../assets/rewards/trophy-two-week-taster.svg"),
  "xp-legend": require("../../../../assets/rewards/trophy-xp-legend.svg"),
  japanese: require("../../../../assets/rewards/trophy-japanese.svg"),
  bakery: require("../../../../assets/rewards/trophy-bakery.svg"),
  coffee: require("../../../../assets/rewards/trophy-coffee.svg"),
  pizza: require("../../../../assets/rewards/trophy-pizza.svg"),
} satisfies Record<
  BadgeId | "japanese" | "bakery" | "coffee" | "pizza",
  number
>;

const frames: Record<RankId, number> = {
  sprout: require("../../../../assets/rewards/frame-sprout.svg"),
  "sous-chef": require("../../../../assets/rewards/frame-sous-chef.svg"),
  artisan: require("../../../../assets/rewards/frame-artisan.svg"),
  connoisseur: require("../../../../assets/rewards/frame-connoisseur.svg"),
  master: require("../../../../assets/rewards/frame-master.svg"),
  legend: require("../../../../assets/rewards/frame-legend.svg"),
  royal: require("../../../../assets/rewards/frame-royal.svg"),
  celestial: require("../../../../assets/rewards/frame-celestial.svg"),
  mythic: require("../../../../assets/rewards/frame-mythic.svg"),
};
// Labels live on the surrounding controls/cards so illustrations aren't read twice.
export function TrophyArt({
  id,
  size = 80,
  locked = false,
}: {
  id: keyof typeof trophies;
  size?: number;
  locked?: boolean;
}) {
  return (
    <Image
      source={trophies[id]}
      contentFit="contain"
      accessible={false}
      style={{ width: size, height: size, opacity: locked ? 0.4 : 1 }}
    />
  );
}

export function DecoratedAvatar({
  name,
  frame,
  palette,
  imageUri,
  size = 104,
}: {
  name: string;
  frame: RankId | null;
  palette: (typeof avatarPalettes)[number];
  imageUri?: string;
  size?: number;
}) {
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View
        style={{
          width: size * 0.64,
          height: size * 0.64,
          borderRadius: size,
          backgroundColor: palette.background,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            contentFit="cover"
            accessible={false}
            style={{
              width: size * 0.64,
              height: size * 0.64,
              borderRadius: size,
            }}
          />
        ) : (
          <Text
            style={{
              color: palette.foreground,
              fontSize: size * 0.29,
              fontWeight: "800",
            }}
          >
            {name.trim().charAt(0).toUpperCase() || "F"}
          </Text>
        )}
      </View>
      {frame && (
        <Image
          source={frames[frame]}
          accessible={false}
          contentFit="contain"
          style={StyleSheet.absoluteFill}
        />
      )}
    </View>
  );
}
