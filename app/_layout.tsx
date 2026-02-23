import { StrictMode } from "react";
import { Stack } from "expo-router";
import { ConvexProvider } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { authClient } from "../src/lib/auth-client";
import { convex } from "../src/shared/config/convex";

export default function RootLayout() {
  return (
    <StrictMode>
      <SafeAreaProvider>
        <ConvexProvider client={convex}>
          <ConvexBetterAuthProvider client={convex} authClient={authClient}>
            <Stack
              screenOptions={{
                headerShown: true, // ✅ header + flèche retour par défaut
              }}
            >
              {/* ✅ Pas de header sur les tabs (Home/Explorer/Publier/Messages/Profil) */}
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

              {/* ✅ Pages où un back est logique */}
              <Stack.Screen name="vehicle/[id]" options={{ title: "Annonce" }} />
              <Stack.Screen name="reservation/[vehicleId]" options={{ title: "Réservation" }} />
              <Stack.Screen
                name="reservation/[reservationId]/report"
                options={{ title: "Constat" }}
              />

              {/* Sous-pages profil */}
              <Stack.Screen name="profile/reservations" options={{ title: "Mes réservations" }} />
              <Stack.Screen name="profile/listings" options={{ title: "Mes annonces" }} />
              <Stack.Screen name="profile/settings" options={{ title: "Paramètres" }} />

              {/* Auth : flèche retour utile */}
              <Stack.Screen name="login" options={{ title: "Connexion" }} />
              <Stack.Screen name="signup" options={{ title: "Créer un compte" }} />
            </Stack>
          </ConvexBetterAuthProvider>
        </ConvexProvider>
      </SafeAreaProvider>
    </StrictMode>
  );
}