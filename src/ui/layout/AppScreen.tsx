import { useHeaderHeight } from "@react-navigation/elements";
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeyboardVisible } from "../hooks/useKeyboardVisible";

export function AppScreen({
  children,
  withBottomSafeArea = true,
}: {
  children: ReactNode;
  withBottomSafeArea?: boolean;
}) {
  const headerHeight = useHeaderHeight?.() ?? 0;
  const keyboardVisible = useKeyboardVisible();

  // ✅ Quand le clavier est visible : PAS de safe area bottom (sinon gros trou)
  const edges: ("top" | "bottom")[] =
    withBottomSafeArea && !keyboardVisible ? ["top", "bottom"] : ["top"];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={edges}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        // ✅ très important : headerHeight seulement (PAS + insets.top)
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight : 0}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}