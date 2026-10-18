import { parseCustomization, type Customization } from "./customization.ts";

export type Profile = {
  name: string;
  neighborhood: string;
  diet: "No preference" | "Vegetarian" | "Vegan" | "Pescatarian";
  customization?: Customization;
  avatarUri?: string;
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
  if (
    profile.avatarUri !== undefined &&
    (typeof profile.avatarUri !== "string" ||
      profile.avatarUri.length > 200_000 ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(profile.avatarUri))
  ) {
    throw new Error("Invalid profile picture");
  }
  return {
    name: profile.name,
    neighborhood: profile.neighborhood,
    diet: profile.diet,
    customization: parseCustomization(profile.customization),
    avatarUri: profile.avatarUri,
  };
}
