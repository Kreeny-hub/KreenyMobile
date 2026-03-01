import { View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme, spacing, shadows } from "../../theme";

interface KStickyCTAProps {
  children: React.ReactNode;
  /** Extra style */
  style?: ViewStyle;
  /** Show top border (default: true) */
  border?: boolean;
}

/**
 * Sticky bottom bar for CTAs.
 * Handles safe area inset automatically.
 */
export function KStickyCTA({ children, style, border = true }: KStickyCTAProps) {
  const { colors, isDark } = useTheme();
  const { bottom } = useSafeAreaInsets();

  return (
    <View
      style={[
        {
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.md,
          paddingBottom: Math.max(bottom, spacing.lg),
          backgroundColor: colors.bg,
          ...(border
            ? { borderTopWidth: 1, borderTopColor: isDark ? colors.border : "rgba(0,0,0,0.06)" }
            : {}),
          ...(!isDark ? shadows.sm : {}),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
