import type { ApiEnvironment } from "../environment.ts";

// Keep rotation local to the incoming request, including multi-call food scans.
export function createGroqClient(env: ApiEnvironment) {
  const keys = [
    ...new Set(
      [env.GROQ_API_KEY, env.GROQ_API_KEY_1, env.GROQ_API_KEY_2]
        .map((key) => key?.trim())
        .filter((key): key is string => Boolean(key)),
    ),
  ];
  if (!keys.length) return undefined;
  let current = 0;
  return async (options: RequestInit & { body: string }): Promise<Response> => {
    for (let attempt = 0; ; attempt++) {
      options.signal?.throwIfAborted();
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          ...options,
          headers: {
            ...options.headers,
            Authorization: `Bearer ${keys[current]}`,
          },
        },
      );
      if (response.status !== 429 || attempt === keys.length - 1)
        return response;
      await response.body?.cancel();
      current = (current + 1) % keys.length;
    }
  };
}
