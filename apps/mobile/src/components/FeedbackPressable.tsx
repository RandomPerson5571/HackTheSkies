import { Pressable, type PressableProps, type View } from "react-native";
import type { Ref } from "react";
import { withButtonFeedback, type SoundName } from "../lib/sensory";

type Props = PressableProps & {
  ref?: Ref<View>;
  sound?: SoundName | false;
};

/** The usual Pressable behavior, with a quiet cue for completed presses. */
export function FeedbackPressable({ onPress, sound, ...props }: Props) {
  const cue =
    sound ??
    (props.accessibilityRole === "tab" || props.accessibilityRole === "radio"
      ? "select"
      : "click");
  return (
    <Pressable
      {...props}
      onPress={
        onPress
          ? (event) => {
              if (cue === false) onPress(event);
              else withButtonFeedback(() => onPress(event), cue);
            }
          : undefined
      }
    />
  );
}
