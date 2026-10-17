import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase =
  url && key
    ? createClient(url, key, {
        global: {
          fetch: async (input, init) => {
            const controller = new AbortController();
            const abort = () => controller.abort();
            const signal = init?.signal;
            if (signal?.aborted) abort();
            signal?.addEventListener("abort", abort);
            const timer = setTimeout(abort, 15000);
            try {
              return await fetch(input, { ...init, signal: controller.signal });
            } finally {
              clearTimeout(timer);
              signal?.removeEventListener("abort", abort);
            }
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      })
    : null;
