import { type ReactNode } from "react";
import { ScrollView, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "../../theme";

interface KScreenProps {
  children: ReactNode;
  /** Use a ScrollView wrapper (default: true) */
  scroll?: boolean;
  /** SafeAreaView edges (default: ["top"]) */
  edges?: Edge[];
  /** Extra padding at bottom for CTA / tab bar */
  bottomInset?: number;
  /** Override container style */
  style?: ViewStyle;
  /** Disable horizontal padding (default: false) */
  noPadding?: boolean;
}

export function KScreen({
  children,
  scroll = true,
  edges = ["top"],
  bottomInset = 0,
  style,
  noPadding = false,
}: KScreenProps) {
  const { colors } = useTheme();

  const inner = scroll ? (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: noPadding ? 0 : 20,
        paddingBottom: bottomInset || 40,
      }}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1, paddingHorizontal: noPadding ? 0 : 20 }}>
      {children}
    </View>
  );

  return (
    <SafeAreaView edges={edges} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {inner}
    </SafeAreaView>
  );
}
