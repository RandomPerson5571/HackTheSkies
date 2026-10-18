// Expo inlines this public value into native and browser bundles.
export function apiEndpoint(path: string, override?: string): string {
  if (override) return override;
  const base = process.env.EXPO_PUBLIC_API_URL;
  return base ? new URL(path, base).toString() : "";
}
