import { StrictMode } from "react";
import { Stack } from "expo-router";
import { ConvexProvider } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

import { authClient } from "../src/lib/auth-client";
import { convex } from "../src/shared/config/convex";
import { useTheme } from "../src/theme";
import { ThemePrefsProvider } from "../src/theme/ThemePrefsProvider";

function ThemedStack() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: true,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.primary,
          headerTitleStyle: {
            color: colors.text,
            fontWeight: "600",
            fontSize: 17,
          },
          headerShadowVisible: false,
          headerBackTitleVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

        <Stack.Screen
          name="vehicle/[id]"
          options={{
            title: "Annonce",
            headerBackTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="reservation/[vehicleId]"
          options={{
            title: "Réservation",
            headerBackTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen
          name="reservation/[reservationId]/report"
          options={{ title: "Constat" }}
        />

        <Stack.Screen
          name="profile/reservations"
          options={{
            title: "Mes réservations",
            headerBackTitle: "",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="profile/listings" options={{ title: "Mes annonces" }} />
        <Stack.Screen name="profile/settings" options={{ title: "Paramètres" }} />
        <Stack.Screen name="profile/avatar" options={{ title: "Photo de profil" }} />
        <Stack.Screen name="profile/dashboard" options={{ title: "Tableau de bord" }} />
        <Stack.Screen
          name="profile/listings/[vehicleId]"
          options={{ title: "Réservations" }}
        />
        <Stack.Screen name="vehicle/images" options={{ title: "Photos" }} />

        <Stack.Screen name="login" options={{ title: "Connexion" }} />
        <Stack.Screen name="signup" options={{ title: "Créer un compte" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <StrictMode>
      <SafeAreaProvider>
        <ThemePrefsProvider>
          <ConvexProvider client={convex}>
            <ConvexBetterAuthProvider client={convex} authClient={authClient}>
              <ThemedStack />
            </ConvexBetterAuthProvider>
          </ConvexProvider>
        </ThemePrefsProvider>
      </SafeAreaProvider>
    </StrictMode>
  );
}
