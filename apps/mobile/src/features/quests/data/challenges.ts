import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
type IconName = ComponentProps<typeof Ionicons>["name"];
export const challenges = [
  {
    id: "new-restaurants",
    title: "Three New Finds",
    cadence: "WEEKLY",
    summary: "Visit 3 restaurants you’ve never tried in one week.",
    details:
      "Make this week deliciously different. Visit three restaurants that are new to you before the week ends, and keep discovering what your neighbourhood has to offer.",
    points: 100,
    icon: "restaurant-outline" as IconName,
  },
  {
    id: "neighbourhood-explorer",
    title: "Neighbourhood Hopper",
    cadence: "WEEKLY",
    summary: "Try a restaurant in 2 different neighbourhoods.",
    details:
      "Take your taste buds beyond your usual route. Visit one new restaurant in each of two different neighbourhoods this week.",
    points: 75,
    icon: "map-outline" as IconName,
  },
  {
    id: "cuisine-collector",
    title: "Cuisine Collector",
    cadence: "MONTHLY",
    summary: "Taste 5 different cuisines this month.",
    details:
      "Explore five different cuisines over the month. Save the places you visit and build a list of new favourites along the way.",
    points: 250,
    icon: "earth-outline" as IconName,
  },
  {
    id: "local-regular",
    title: "Support Local",
    cadence: "MONTHLY",
    summary: "Discover 4 independent restaurants this month.",
    details:
      "Get to know the independent spots that make the city special. Visit four locally owned restaurants before the month is over.",
    points: 200,
    icon: "heart-outline" as IconName,
  },
  {
    id: "coffee-break",
    title: "Coffee Crawl",
    cadence: "WEEKLY",
    summary: "Visit 3 cafés you haven’t tried before.",
    details:
      "Make room for a little pick-me-up. Visit three new cafés this week and discover your next favourite cup.",
    points: 100,
    icon: "cafe-outline" as IconName,
  },
  {
    id: "sweet-tooth",
    title: "Sweet Tooth",
    cadence: "WEEKLY",
    summary: "Try 2 new bakeries or dessert spots.",
    details:
      "Treat yourself to something new. Visit two bakeries or dessert spots you haven’t tried before this week.",
    points: 75,
    icon: "ice-cream-outline" as IconName,
  },
  {
    id: "breakfast-club",
    title: "Breakfast Club",
    cadence: "WEEKLY",
    summary: "Enjoy breakfast at 2 local restaurants.",
    details:
      "Start the day somewhere different. Have breakfast at two local restaurants during the week.",
    points: 100,
    icon: "sunny-outline" as IconName,
  },
  {
    id: "plant-powered",
    title: "Plant Powered",
    cadence: "MONTHLY",
    summary: "Order a plant-based meal at 4 restaurants.",
    details:
      "Try something green across the city. Order a plant-based meal at four different restaurants this month.",
    points: 250,
    icon: "leaf-outline" as IconName,
  },
  {
    id: "pizza-tour",
    title: "Pizza Passport",
    cadence: "MONTHLY",
    summary: "Compare slices from 3 different pizzerias.",
    details:
      "Find your perfect slice. Visit three different pizzerias this month and see which one earns a spot in your food journal.",
    points: 200,
    icon: "pizza-outline" as IconName,
  },
  {
    id: "lunch-break",
    title: "Lunch Local",
    cadence: "MONTHLY",
    summary: "Have lunch at 5 neighbourhood favourites.",
    details:
      "Make lunch part of the adventure. Visit five restaurants in your neighbourhood for lunch this month.",
    points: 200,
    icon: "restaurant-outline" as IconName,
  },
  {
    id: "new-flavours",
    title: "Try Something New",
    cadence: "MONTHLY",
    summary: "Order a dish you’ve never had at 4 restaurants.",
    details:
      "Be curious with your order. Choose a dish that’s new to you at four different restaurants this month.",
    points: 300,
    icon: "sparkles-outline" as IconName,
  },
  {
    id: "dessert-month",
    title: "Dessert Detour",
    cadence: "MONTHLY",
    summary: "Discover 3 new dessert spots around the city.",
    details:
      "Save a little room for dessert. Visit three dessert spots you haven’t tried before the month ends.",
    points: 200,
    icon: "nutrition-outline" as IconName,
  },
];
