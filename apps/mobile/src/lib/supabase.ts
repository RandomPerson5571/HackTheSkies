import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// Without keys the app still runs; anything needing Supabase should check for null.
export const supabase =
  supabaseUrl && supabaseKey
    ? createClient(supabaseUrl, supabaseKey, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
          lock: processLock,
        },
      })
    : null;

if (!supabase) {
  console.warn(
    "Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in apps/mobile/.env.local.",
  );
}

// Mount once in the app shell; clean up the listener on unmount or Fast Refresh.
export function startSupabaseSessionRefresh() {
  if (Platform.OS === "web" || !supabase) return;
  const client = supabase;

  if (AppState.currentState === "active") {
    void client.auth.startAutoRefresh();
  } else {
    void client.auth.stopAutoRefresh();
  }

  const subscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void client.auth.startAutoRefresh();
    } else {
      void client.auth.stopAutoRefresh();
    }
  });

  return () => {
    subscription.remove();
    void client.auth.stopAutoRefresh();
  };
}
