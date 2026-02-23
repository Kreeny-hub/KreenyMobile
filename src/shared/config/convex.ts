import { ConvexReactClient } from "convex/react";

const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;

if (!convexUrl) {
  throw new Error("EXPO_PUBLIC_CONVEX_URL is missing (check .env.local).");
}

export const convex = new ConvexReactClient(convexUrl, {
  expectAuth: true,
  unsavedChangesWarning: false,
});
