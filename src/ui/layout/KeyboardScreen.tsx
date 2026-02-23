import { useHeaderHeight } from "@react-navigation/elements";
import { ReactNode } from "react";
import { KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

/**
 * Wrapper global : safe area + comportement clavier stable iOS.
 * À utiliser partout à la place de SafeAreaView + KeyboardAvoidingView.
 */
export function KeyboardScreen({
  children,
  edges = ["top", "bottom"],
}: {
  children: ReactNode;
  edges?: ("top" | "bottom" | "left" | "right")[];
}) {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight?.() ?? 0;

  return (
    <SafeAreaView style={{ flex: 1 }} edges={edges}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        // Pas de “nombre magique” : header + safe top.
        keyboardVerticalOffset={Platform.OS === "ios" ? headerHeight + insets.top : 0}
      >
        {children}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}