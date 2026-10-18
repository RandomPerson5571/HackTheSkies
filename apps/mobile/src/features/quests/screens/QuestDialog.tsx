import { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CatalogPhoto } from "../../food-dex/components/CatalogPhoto";
import { catalogPhoto } from "../../food-dex/services/catalogPhotos";
import { useReducedMotion } from "../../food-dex/hooks/useReducedMotion";
import { hasDish, lessonFor, pathDishes, type Quest } from "../models/quests";
import type { FoodEntry } from "../../food-dex/models/foodDex";
import { hapticSuccess } from "../../../lib/sensory";
import { questColors as c } from "../../../theme";

export function QuestButton({
  title,
  onPress,
  secondary = false,
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (pressed || disabled) && { opacity: 0.6 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: c.ink }]}>{title}</Text>
    </Pressable>
  );
}

export function QuestDialog({
  quest,
  status,
  entries,
  personalized = false,
  onClose,
  onComplete,
  onCamera,
  onDex,
  onExplore,
}: {
  quest: Quest;
  status: "completed" | "current" | "locked";
  entries: FoodEntry[];
  personalized?: boolean;
  onClose: () => void;
  onComplete: () => void;
  onCamera: () => void;
  onDex: () => void;
  onExplore: () => void;
}) {
  const { dish, others } = lessonFor(quest);
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<"intro" | "quiz" | "reward">("intro");
  const [answer, setAnswer] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const reduced = useReducedMotion();
  const [scale] = useState(() => new Animated.Value(1));
  const isBoss = quest.type === "boss";
  const quizDishes = isBoss ? [dish, ...others.slice(0, 2)] : [dish];
  const quizDish = quizDishes[questionIndex]!;
  const choices = pathDishes(quest.cuisine);
  // Rotate choices by chapter so the correct answer isn't always in one position.
  const offset = (quest.chapter + 1) % choices.length;
  const options = [...choices.slice(offset), ...choices.slice(0, offset)];
  const correct = answer === quizDish.id;
  const collected = hasDish(entries, dish.id);
  useEffect(() => {
    if (stage !== "reward" || reduced !== false) return;
    scale.setValue(0.85);
    const animation = Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [stage, reduced, scale]);
  function finish() {
    hapticSuccess();
    onComplete();
    setStage("reward");
  }
  const description = {
    knowledge:
      "Small bites of knowledge. Read the dish card, then test your memory.",
    discovery:
      "Add this dish to your Food Dex with a photo or manual entry. You can also study its card and pass a mini quiz to earn the same quest XP at home.",
    cultural:
      "Food has its own vocabulary. Look closely at the ingredients and preparation that make this dish distinctive.",
    exploration:
      "Find a restaurant on the map to plan a future food adventure, or learn from the dish card at home. Either route finishes with a quick knowledge check.",
    mystery:
      "A mystery dish is hiding behind its description. Can you identify it?",
    bonus:
      "You’ve earned a moment of delight. Open your discovery chest for a learning card and bonus XP.",
    boss: "Your chapter finale: identify three dishes from their descriptions to earn a learning card, a passport stamp, and your next chapter.",
  }[quest.type];
  return (
    <Modal
      visible
      transparent
      animationType={reduced === false ? "fade" : "none"}
      onRequestClose={onClose}
    >
      <View
        style={[
          s.scrim,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <View accessibilityViewIsModal style={s.dialog}>
          <ScrollView contentContainerStyle={s.content}>
            <View style={s.top}>
              <Text style={s.eyebrow}>
                {stage === "reward"
                  ? "A LITTLE MORE ADVENTUROUS"
                  : `${quest.cuisine.toUpperCase()} · ${quest.type.toUpperCase()}`}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close quest"
                onPress={onClose}
                style={s.close}
              >
                <Ionicons name="close" size={24} color={c.ink} />
              </Pressable>
            </View>
            {stage === "reward" ? (
              <>
                <Animated.View style={[s.reward, { transform: [{ scale }] }]}>
                  <Ionicons
                    name={isBoss ? "ribbon" : "sparkles"}
                    size={40}
                    color={c.limeDark}
                    accessible={false}
                  />
                  <Text accessibilityRole="header" style={s.title}>
                    {isBoss ? "Chapter complete!" : "Quest complete!"}
                  </Text>
                  <Text style={s.xp}>+{quest.xp} XP</Text>
                  <CatalogPhoto
                    source={catalogPhoto(dish)}
                    label={dish.name}
                    style={s.rewardPhoto}
                  />
                  <Text style={s.cardName}>{dish.name}</Text>
                  <Text style={s.copy}>
                    Learning card unlocked{isBoss ? " · Passport stamped" : ""}
                  </Text>
                </Animated.View>
                <Text style={s.copy}>
                  {isBoss
                    ? quest.chapter === 3
                      ? `You’re a ${quest.cuisine} Cuisine Master. Your passport is looking delicious.`
                      : "The next chapter is ready. Keep following your curiosity."
                    : personalized
                      ? "Your personalized adventure is now part of your passport."
                      : "Your next quest is unlocked and ready when you are."}
                </Text>
                <QuestButton title="Keep exploring" onPress={onClose} />
              </>
            ) : (
              <>
                <Text accessibilityRole="header" style={s.title}>
                  {quest.title}
                </Text>
                <Text style={s.copy}>{description}</Text>
                <Text style={s.rewardLabel}>
                  {quest.xp} XP
                  {isBoss
                    ? " + chapter card + passport stamp"
                    : " + learning card"}
                </Text>
                {status === "locked" ? (
                  <View style={s.note}>
                    <Ionicons
                      name="lock-closed-outline"
                      size={24}
                      color={c.ink}
                    />
                    <Text style={s.copy}>
                      Complete the previous quest to play this one. You can
                      preview every stop along your journey.
                    </Text>
                  </View>
                ) : status === "completed" ? (
                  <View style={s.note}>
                    <Ionicons
                      name="checkmark-circle"
                      size={24}
                      color={c.success}
                    />
                    <Text style={s.copy}>
                      Already completed. Your XP and learning card are saved in
                      your passport.
                    </Text>
                  </View>
                ) : stage === "quiz" ? (
                  <>
                    <Text style={s.eyebrow}>
                      {isBoss
                        ? `FINALE · ${questionIndex + 1} OF ${quizDishes.length}`
                        : "QUICK KNOWLEDGE CHECK"}
                    </Text>
                    <Text style={s.question}>{quizDish.note}</Text>
                    {options.map((option) => (
                      <Pressable
                        key={option.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected: answer === option.id }}
                        onPress={() => setAnswer(option.id)}
                        style={({ pressed }) => [
                          s.option,
                          answer === option.id && s.selectedOption,
                          pressed && { opacity: 0.7 },
                        ]}
                      >
                        <Text style={s.optionText}>{option.name}</Text>
                        {answer === option.id && (
                          <Ionicons
                            name={correct ? "checkmark-circle" : "close-circle"}
                            size={24}
                            color={correct ? c.success : c.danger}
                          />
                        )}
                      </Pressable>
                    ))}
                    {answer && (
                      <Text
                        accessibilityLiveRegion="polite"
                        style={[
                          s.feedback,
                          { color: correct ? c.success : c.danger },
                        ]}
                      >
                        {correct
                          ? "That’s it. Nicely spotted!"
                          : "Take another look at the description and try again."}
                      </Text>
                    )}
                    <QuestButton
                      title={
                        isBoss && questionIndex < quizDishes.length - 1
                          ? "Next question"
                          : `Complete quest · ${quest.xp} XP`
                      }
                      disabled={!correct}
                      onPress={() => {
                        if (questionIndex < quizDishes.length - 1) {
                          setQuestionIndex((index) => index + 1);
                          setAnswer(null);
                        } else finish();
                      }}
                    />
                  </>
                ) : (
                  <>
                    {quest.type !== "mystery" &&
                      quest.type !== "boss" &&
                      quest.type !== "bonus" && (
                        <View style={s.studyCard}>
                          <CatalogPhoto
                            source={catalogPhoto(dish)}
                            label={dish.name}
                            style={s.photo}
                          />
                          <View style={s.studyCopy}>
                            <Text style={s.cardName}>{dish.name}</Text>
                            <Text style={s.copy}>{dish.note}</Text>
                          </View>
                        </View>
                      )}
                    {quest.type === "cultural" && (
                      <View style={s.note}>
                        <Text style={s.copy}>
                          Compare with {others[0]!.name.toLowerCase()}:{" "}
                          {others[0]!.note} Notice how the ingredients and
                          preparation change the experience.
                        </Text>
                      </View>
                    )}
                    {quest.type === "bonus" ? (
                      <QuestButton
                        title="Open discovery chest"
                        onPress={finish}
                      />
                    ) : (
                      <>
                        {quest.type === "discovery" && (
                          <>
                            {collected ? (
                              <QuestButton
                                title="Dish collected · Claim XP"
                                onPress={finish}
                              />
                            ) : (
                              <>
                                <QuestButton
                                  title="Discover with food camera"
                                  onPress={onCamera}
                                />
                                <QuestButton
                                  title="Open Food Dex / add manually"
                                  secondary
                                  onPress={onDex}
                                />
                              </>
                            )}
                          </>
                        )}
                        {quest.type === "exploration" && (
                          <QuestButton
                            title={`Explore ${quest.cuisine} restaurants`}
                            secondary
                            onPress={onExplore}
                          />
                        )}
                        <QuestButton
                          title={
                            quest.type === "discovery"
                              ? "Learn at home · Same XP"
                              : quest.type === "boss"
                                ? "Start chapter finale"
                                : quest.type === "mystery"
                                  ? "Solve the mystery"
                                  : "Test my knowledge"
                          }
                          secondary={quest.type === "discovery" && !collected}
                          onPress={() => setStage("quiz")}
                        />
                      </>
                    )}
                    <Text style={s.small}>
                      Learning cards live in your quest passport. Only foods you
                      add yourself appear as collected in Food Dex.
                    </Text>
                  </>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  scrim: {
    flex: 1,
    backgroundColor: "#172642BB",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  dialog: {
    backgroundColor: c.paper,
    width: "100%",
    maxWidth: 500,
    maxHeight: "100%",
    borderRadius: 28,
    overflow: "hidden",
  },
  content: { padding: 24, gap: 16 },
  top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  close: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.locked,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    color: c.muted,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.4,
    flexShrink: 1,
  },
  title: {
    color: c.navy,
    fontSize: 29,
    fontWeight: "800",
    letterSpacing: -0.8,
  },
  copy: { color: c.muted, fontSize: 15, lineHeight: 23 },
  rewardLabel: { color: c.limeDark, fontWeight: "700", fontSize: 13 },
  button: {
    minHeight: 52,
    backgroundColor: c.navy,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  secondary: { backgroundColor: c.lime },
  buttonText: {
    color: c.paper,
    fontSize: 15,
    fontWeight: "800",
    textAlign: "center",
  },
  note: { backgroundColor: c.lavender, borderRadius: 18, padding: 18, gap: 12 },
  studyCard: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 20,
    overflow: "hidden",
  },
  photo: { width: "100%", height: 180 },
  studyCopy: { padding: 18, gap: 8 },
  cardName: { color: c.ink, fontSize: 20, fontWeight: "800" },
  small: { color: c.muted, fontSize: 12, lineHeight: 19 },
  question: { fontSize: 20, fontWeight: "700", color: c.navy, lineHeight: 29 },
  option: {
    minHeight: 54,
    borderWidth: 2,
    borderColor: c.border,
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  selectedOption: { borderColor: c.ink, backgroundColor: c.lime },
  optionText: { color: c.ink, fontWeight: "700", flexShrink: 1 },
  feedback: { fontSize: 14, lineHeight: 22 },
  reward: {
    backgroundColor: c.lime,
    borderRadius: 24,
    padding: 24,
    gap: 12,
    alignItems: "center",
  },
  rewardPhoto: { width: 148, height: 148, borderRadius: 20 },
  xp: { color: c.navy, fontSize: 38, fontWeight: "900" },
});
