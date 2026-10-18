import { parseNfcFoodPayload, type NfcFoodItem } from "./nfcFood";

type WebNdefRecord = {
  data: DataView | null;
  encoding: string | null;
  mediaType: string | null;
  recordType: string;
};

type WebNdefReadingEvent = Event & {
  message: { records: WebNdefRecord[] };
};

type WebNdefReader = {
  addEventListener: (
    type: "reading" | "readingerror",
    listener: (event: Event) => void,
  ) => void;
  removeEventListener: (
    type: "reading" | "readingerror",
    listener: (event: Event) => void,
  ) => void;
  scan: (options?: { signal?: AbortSignal }) => Promise<void>;
};

type WebNdefReaderConstructor = new () => WebNdefReader;

function recordText(record: WebNdefRecord) {
  if (!record.data) return "";
  const isTextRecord =
    record.recordType === "text" ||
    record.recordType === "url" ||
    record.recordType === "absolute-url" ||
    (record.recordType === "mime" &&
      Boolean(record.mediaType?.startsWith("text/")));
  if (!isTextRecord) return "";

  return new TextDecoder(record.encoding ?? "utf-8")
    .decode(record.data)
    .trim();
}

export async function readFoodTag(signal: AbortSignal): Promise<NfcFoodItem> {
  if (signal.aborted) throw new Error("NFC scan cancelled.");
  if (typeof window === "undefined" || !window.isSecureContext) {
    throw new Error(
      "Browser NFC needs a secure HTTPS connection. Enter the food number below instead.",
    );
  }

  const Reader = (
    globalThis as typeof globalThis & {
      NDEFReader?: WebNdefReaderConstructor;
    }
  ).NDEFReader;
  if (!Reader) {
    throw new Error(
      "This browser or device does not support NFC scanning. Use a compatible NFC device or enter the food number below.",
    );
  }

  const reader = new Reader();
  return new Promise<NfcFoodItem>((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener("abort", onAbort);
      reader.removeEventListener("reading", onReading);
      reader.removeEventListener("readingerror", onReadingError);
    };
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onAbort = () =>
      finish(() => reject(new Error("NFC scan cancelled.")));
    const onReading = (event: Event) => {
      const readingEvent = event as WebNdefReadingEvent;
      for (const record of readingEvent.message.records) {
        const food = parseNfcFoodPayload(recordText(record));
        if (food) {
          finish(() => resolve(food));
          return;
        }
      }
      finish(() =>
        reject(
          new Error(
            "This tag has no food number or dish name. Use a tag with a food number, dish name, or food link.",
          ),
        ),
      );
    };
    const onReadingError = () =>
      finish(() =>
        reject(new Error("Could not read that NFC tag. Try another tag.")),
      );

    signal.addEventListener("abort", onAbort, { once: true });
    reader.addEventListener("reading", onReading);
    reader.addEventListener("readingerror", onReadingError);

    void reader.scan({ signal }).catch((reason: unknown) => {
      finish(() =>
        reject(
          new Error(
            reason instanceof Error
              ? reason.message
              : "Could not start NFC scanning. Check the browser permission and try again.",
          ),
        ),
      );
    });
  });
}
