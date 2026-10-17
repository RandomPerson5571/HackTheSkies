import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

export type Section = "collection" | "profile" | "foodDex";
let deviceKey: Promise<string> | undefined;
export function getDeviceKey() {
  if (!deviceKey) {
    deviceKey = (async () => {
      const stored = await AsyncStorage.getItem("cibo.deviceKey");
      if (stored && /^[a-f0-9]{64}$/.test(stored)) return stored;
      if (!supabase) throw new Error("Supabase is not configured");
      const { data: key, error } = await supabase.rpc("cibo_issue_device_key");
      if (error) throw error;
      if (typeof key !== "string" || !/^[a-f0-9]{64}$/.test(key))
        throw new Error("Invalid device key");
      // Persist the key before sending any data; otherwise the journal could be lost.
      await AsyncStorage.setItem("cibo.deviceKey", key);
      return key;
    })().catch((error) => {
      deviceKey = undefined;
      throw error;
    });
  }
  return deviceKey;
}

// Serialize reads/writes per document, including across screen remounts.
const pending = new Map<Section, Promise<unknown>>();
export function documentTask<T>(
  section: Section,
  task: () => Promise<T>,
): Promise<T> {
  const next = (pending.get(section) ?? Promise.resolve())
    .catch(() => {})
    .then(task);
  pending.set(section, next);
  return next;
}
export async function readDocument(section: Section) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { data, error } = await supabase.rpc("cibo_read_document", {
    p_key: await getDeviceKey(),
    p_section: section,
  });
  if (error) throw error;
  return data as unknown;
}
export async function writeDocument(section: Section, value: unknown) {
  if (!supabase) throw new Error("Supabase is not configured");
  const { error } = await supabase.rpc("cibo_write_document", {
    p_key: await getDeviceKey(),
    p_section: section,
    p_data: value,
  });
  if (error) throw error;
}
