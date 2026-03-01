import { router } from "expo-router";

export function ensureAuth(isAuthenticated: boolean) {
  if (isAuthenticated) return true;

  // Redirige vers l'inscription (favorise les nouveaux comptes)
  router.push("/signup");
  return false;
}
