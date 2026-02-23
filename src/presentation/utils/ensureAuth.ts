import { router } from "expo-router";

export function ensureAuth(isAuthenticated: boolean) {
  if (isAuthenticated) return true;

  // On passe par une route "alias" simple pour éviter les erreurs de typing Expo Router
  router.push("/login");
  return false;
}
