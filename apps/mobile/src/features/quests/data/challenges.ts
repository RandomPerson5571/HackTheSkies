import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
type IconName = ComponentProps<typeof Ionicons>["name"];
type Challenge = {
  id: string;
  title: string;
  cadence: "WEEKLY" | "MONTHLY";
  summary: string;
  details: string;
  points: number;
  icon: IconName;
  category?: string;
  metric?: "neighbourhoods" | "cuisines" | "categories";
};

export const challenges: Challenge[] = [
  {
    id: "new-restaurants",
    title: "Three-Stop Food Tour",
    cadence: "WEEKLY",
    summary: "Build a three-stop food tour this week.",
    details: "Check in at three different spots before the week ends.",
    points: 100,
    icon: "restaurant-outline" as IconName,
  },
  {
    id: "neighbourhood-explorer",
    title: "Neighbourhood Hop",
    cadence: "WEEKLY",
    summary: "Eat your way through two neighbourhoods.",
    details: "Visit spots in two different neighbourhoods this week.",
    metric: "neighbourhoods",
    points: 75,
    icon: "map-outline" as IconName,
  },
  {
    id: "cuisine-collector",
    title: "Five-Cuisine Explorer",
    cadence: "MONTHLY",
    summary: "Try five different cuisines this month.",
    details: "Check in at spots serving five different cuisines.",
    metric: "cuisines",
    points: 250,
    icon: "earth-outline" as IconName,
  },
  {
    id: "local-regular",
    title: "Local Legends",
    cadence: "MONTHLY",
    summary: "Find four new favourites around town.",
    details: "Check in at four different local spots this month.",
    points: 200,
    icon: "heart-outline" as IconName,
  },
  {
    id: "coffee-break",
    title: "Caffeine Circuit",
    cadence: "WEEKLY",
    summary: "Try three different coffee spots this week.",
    details: "Check in at three different coffee shops.",
    category: "Coffee",
    points: 100,
    icon: "cafe-outline" as IconName,
  },
  {
    id: "sweet-tooth",
    title: "Bakery Tour",
    cadence: "WEEKLY",
    summary: "Collect two bakery stops this week.",
    details: "Check in at two different bakeries.",
    category: "Bakery",
    points: 75,
    icon: "ice-cream-outline" as IconName,
  },
  {
    id: "breakfast-club",
    title: "Category Sampler",
    cadence: "MONTHLY",
    summary: "Try three kinds of food spots this month.",
    details: "Check in at spots from three different categories.",
    metric: "categories",
    points: 200,
    icon: "sunny-outline" as IconName,
  },
  {
    id: "plant-powered",
    title: "Ramen Relay",
    cadence: "MONTHLY",
    summary: "Compare bowls at three ramen spots.",
    details: "Check in at three different ramen restaurants this month.",
    category: "Ramen",
    points: 200,
    icon: "restaurant-outline" as IconName,
  },
  {
    id: "pizza-tour",
    title: "Pizza Tour",
    cadence: "MONTHLY",
    summary: "Find your favourite slice across three pizzerias.",
    details: "Check in at three different pizza spots this month.",
    category: "Pizza",
    points: 200,
    icon: "pizza-outline" as IconName,
  },
  {
    id: "lunch-break",
    title: "Neighbourhood Trio",
    cadence: "MONTHLY",
    summary: "Explore three neighbourhoods this month.",
    details: "Check in at spots across three different neighbourhoods.",
    metric: "neighbourhoods",
    points: 200,
    icon: "restaurant-outline" as IconName,
  },
  {
    id: "new-flavours",
    title: "Cuisine Switch-Up",
    cadence: "MONTHLY",
    summary: "Taste four different cuisines this month.",
    details: "Check in at spots serving four different cuisines.",
    metric: "cuisines",
    points: 300,
    icon: "sparkles-outline" as IconName,
  },
  {
    id: "dessert-month",
    title: "Three-Bakery Tour",
    cadence: "MONTHLY",
    summary: "Make a three-stop bakery tour this month.",
    details: "Check in at three different bakeries.",
    category: "Bakery",
    points: 200,
    icon: "nutrition-outline" as IconName,
  },
];
