export type Profile = {
  name: string;
  neighborhood: string;
  diet: "No preference" | "Vegetarian" | "Vegan" | "Pescatarian";
};
export function parseProfile(value: unknown): Profile {
  if (!value || typeof value !== "object") throw new Error("Invalid profile");
  const profile = value as Profile;
  if (
    typeof profile.name !== "string" ||
    !profile.name.trim() ||
    profile.name.length > 50 ||
    typeof profile.neighborhood !== "string" ||
    profile.neighborhood.length > 80 ||
    !["No preference", "Vegetarian", "Vegan", "Pescatarian"].includes(
      profile.diet,
    )
  ) {
    throw new Error("Invalid profile");
  }
  return {
    name: profile.name,
    neighborhood: profile.neighborhood,
    diet: profile.diet,
  };
}
