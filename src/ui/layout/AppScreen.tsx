import { useHeaderHeight } from "@react-navigation/elements";
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/**
 * Pattern stable Expo Router (header iOS gère déjà le TOP safe area)
 * => on garde seulement le BOTTOM safe area
 * => KeyboardAvoidingView pousse correctement l’UI au-dessus du clavier
 */
export function AppScreen({ children }: { children: ReactNode }) {
  const headerHeight = useHeaderHeight?.() ?? 0;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        // ✅ offset = header seulement (pas de insets.top)
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}