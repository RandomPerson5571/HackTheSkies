import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import type { CollectionQuest } from "../models/collectionQuests";

const artwork = {
  restaurants: require("../../../../assets/quests/restaurants.svg"),
  discoveries: require("../../../../assets/quests/discoveries.svg"),
  home: require("../../../../assets/quests/home.svg"),
  days: require("../../../../assets/quests/days.svg"),

  cuisine: require("../../../../assets/quests/first-bite.svg"),
  ramen: require("../../../../assets/quests/ramen.svg"),
  dessert: require("../../../../assets/quests/dessert.svg"),
  world: require("../../../../assets/quests/world.svg"),
  set: require("../../../../assets/quests/collection.svg"),
};

const flags = {
  Japanese: require("../../../../assets/quests/flags/japanese.svg"),
  Italian: require("../../../../assets/quests/flags/italian.svg"),
  French: require("../../../../assets/quests/flags/french.svg"),
  Chinese: require("../../../../assets/quests/flags/chinese.svg"),
  Korean: require("../../../../assets/quests/flags/korean.svg"),
  Vietnamese: require("../../../../assets/quests/flags/vietnamese.svg"),
  "South Asian": require("../../../../assets/quests/flags/south-asian.svg"),
};

export function QuestArt({
  metric,
  cuisine,
  size = 76,
}: {
  metric: CollectionQuest["metric"];
  cuisine?: CollectionQuest["cuisine"];
  size?: number;
}) {
  return (
    <View style={{ width: size, height: size }} accessible={false}>
      <Image
        source={artwork[metric]}
        contentFit="contain"
        accessible={false}
        style={{ width: size, height: size }}
      />
      {cuisine && (
        <View style={styles.flag}>
          <Image
            source={flags[cuisine]}
            contentFit="cover"
            accessible={false}
            style={styles.flagImage}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flag: {
    position: "absolute",
    bottom: 0,
    right: -2,
    borderRadius: 5,
    padding: 2,
    backgroundColor: "#FFFDF5",
    shadowColor: "#172642",
    shadowOpacity: 0.15,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  flagImage: { width: 27, height: 18, borderRadius: 3 },
});
