import { Platform } from "react-native";
import NfcManager, { Ndef, NfcTech } from "react-native-nfc-manager";
import { parseNfcFoodPayload, type NfcFoodItem } from "./nfcFood";

export async function readFoodTag(signal: AbortSignal): Promise<NfcFoodItem> {
  let requestAttempted = false;
  let cancelPromise: Promise<void> | null = null;
  const cancel = () => {
    if (requestAttempted) {
      cancelPromise ??= NfcManager.cancelTechnologyRequest().catch(() => {});
    }
  };
  signal.addEventListener("abort", cancel);
  try {
    if (signal.aborted) throw new Error("NFC scan cancelled.");
    if (!(await NfcManager.isSupported(NfcTech.Ndef))) {
      throw new Error("This device does not support NFC food tags.");
    }
    if (signal.aborted) throw new Error("NFC scan cancelled.");
    if (Platform.OS === "android" && !(await NfcManager.isEnabled())) {
      throw new Error("Turn on NFC in your device settings, then try again.");
    }

    await NfcManager.start();
    if (signal.aborted) throw new Error("NFC scan cancelled.");
    requestAttempted = true;
    await NfcManager.requestTechnology(NfcTech.Ndef, {
      alertMessage: "Hold your phone near a food tag.",
    });
    if (signal.aborted) throw new Error("NFC scan cancelled.");
    const tag = await NfcManager.getTag();
    for (const record of tag?.ndefMessage ?? []) {
      try {
        const isText = Ndef.isType(
          record,
          Ndef.TNF_WELL_KNOWN,
          Ndef.RTD_TEXT,
        );
        const isUri = Ndef.isType(
          record,
          Ndef.TNF_WELL_KNOWN,
          Ndef.RTD_URI,
        );
        if (!isText && !isUri) continue;

        const bytes = new Uint8Array(record.payload);
        const payload = isText
          ? Ndef.text.decodePayload(bytes)
          : Ndef.uri.decodePayload(bytes);
        const food = parseNfcFoodPayload(payload);
        if (food) return food;
      } catch {
        // Skip unrecognized records and continue through the tag's NDEF message.
      }
    }
    throw new Error(
      "This tag has no food number or dish name. Use an NFC tag with a food number, dish name, or food link.",
    );
  } finally {
    signal.removeEventListener("abort", cancel);
    if (requestAttempted) {
      await (cancelPromise ??
        NfcManager.cancelTechnologyRequest().catch(() => {}));
    }
  }
}
