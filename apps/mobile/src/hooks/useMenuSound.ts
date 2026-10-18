import { useEffect, useRef } from "react";
import { playFeedback } from "../lib/sensory";

/** Follows visibility so keyboard, backdrop and hardware-back dismissals agree. */
export function useMenuSound(open: boolean) {
  const previous = useRef(false);
  useEffect(() => {
    if (previous.current === open) return;
    previous.current = open;
    if (open) void playFeedback("click");
  }, [open]);
}
