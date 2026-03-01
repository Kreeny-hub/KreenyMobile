import { StrictMode, useEffect, useState } from "react";
import { Stack } from "expo-router";
import { ConvexProvider, useAction } from "convex/react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";

import { authClient } from "../src/lib/auth-client";
import { convex } from "../src/shared/config/convex";
import { useTheme } from "../src/theme";
import { ThemePrefsProvider } from "../src/theme/ThemePrefsProvider";
import { ToastProvider } from "../src/presentation/components/Toast";
import { api } from "../convex/_generated/api";

// ── Stripe (optional — install @stripe/stripe-react-native to activate) ──
let StripeProviderComponent: any = null;
try {
  const stripe = require("@stripe/stripe-react-native");
  StripeProviderComponent = stripe.StripeProvider;
} catch {
  // Not installed — DEV mode
}

function ThemedStack() {
  const { colors, isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
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
        <Stack.Screen name="onboarding" options={{ headerShown: false, animation: "none" }} />

        <Stack.Screen
          name="vehicle/[id]"
          options={{
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="reservation/[vehicleId]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="reservation/[reservationId]/report"
          options={{ headerShown: false }}
        />

        <Stack.Screen
          name="profile/reservations"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="profile/listings" options={{ headerShown: false }} />
        <Stack.Screen
          name="messages/[threadId]"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="profile/settings" options={{ headerShown: false }} />
        <Stack.Screen name="profile/avatar" options={{ headerShown: false }} />
        <Stack.Screen name="profile/favorites" options={{ headerShown: false }} />
        <Stack.Screen name="profile/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="profile/[userId]" options={{ headerShown: false }} />
        <Stack.Screen
          name="profile/listings/[vehicleId]"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="vehicle/images" options={{ headerShown: false }} />
        <Stack.Screen name="payment/[reservationId]" options={{ headerShown: false }} />
        <Stack.Screen name="profile/availability/[vehicleId]" options={{ headerShown: false }} />
        <Stack.Screen name="profile/edit-vehicle/[vehicleId]" options={{ headerShown: false }} />

        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false }} />
        <Stack.Screen name="review/[reservationId]" options={{ headerShown: false }} />
        <Stack.Screen name="legal/terms" options={{ headerShown: false }} />
        <Stack.Screen name="legal/privacy" options={{ headerShown: false }} />
        <Stack.Screen name="admin/index" options={{ headerShown: false }} />
        <Stack.Screen name="admin/condition-reports" options={{ headerShown: false }} />
        <Stack.Screen name="report/[targetId]" options={{ headerShown: false, presentation: "modal" }} />
        <Stack.Screen name="dispute/[reservationId]" options={{ headerShown: false, presentation: "modal" }} />
      </Stack>
    </>
  );
}

// ═══════════════════════════════════════════════════════
// Stripe Wrapper — fetches publishable key from backend
// ═══════════════════════════════════════════════════════
function StripeWrapper({ children }: { children: React.ReactNode }) {
  const [publishableKey, setPublishableKey] = useState<string | null>(null);
  const getConfig = useAction(api.stripe.getStripeConfig);

  useEffect(() => {
    if (!StripeProviderComponent) return;
    getConfig({}).then((cfg) => {
      if (cfg.publishableKey) setPublishableKey(cfg.publishableKey);
    }).catch(() => {});
  }, []);

  if (!StripeProviderComponent || !publishableKey) {
    // Stripe not installed or no key → DEV mode, render without provider
    return <>{children}</>;
  }

  return (
    <StripeProviderComponent
      publishableKey={publishableKey}
      merchantIdentifier="merchant.com.kreeny"
      urlScheme="kreeny"
    >
      {children}
    </StripeProviderComponent>
  );
}

export default function RootLayout() {
  return (
    <StrictMode>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <ThemePrefsProvider>
            <ConvexProvider client={convex}>
              <ConvexBetterAuthProvider client={convex} authClient={authClient}>
                <StripeWrapper>
                  <ThemedStack />
                  <ToastProvider />
                </StripeWrapper>
              </ConvexBetterAuthProvider>
            </ConvexProvider>
          </ThemePrefsProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </StrictMode>
  );
}
