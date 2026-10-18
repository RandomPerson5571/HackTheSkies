import { useMemo } from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import { colors } from "../theme";

/** A small, dedicated swipe target that dismisses a bottom sheet on drag down. */
export function SheetDragHandle({ onDismiss }: { onDismiss: () => void }) {
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > 70) onDismiss();
        },
      }),
    [onDismiss],
  );

  return (
    <View {...responder.panHandlers} style={s.area} accessible={false}>
      <View style={s.handle} />
    </View>
  );
}

const s = StyleSheet.create({
  area: { height: 24, alignItems: "center", justifyContent: "center" },
  handle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
  },
});
