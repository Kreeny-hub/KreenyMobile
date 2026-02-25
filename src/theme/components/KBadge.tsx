import { View, Text } from "react-native";
import { useTheme, typography, radius, spacing } from "../../theme";

type BadgeVariant = "info" | "success" | "warning" | "error" | "neutral";

interface KBadgeProps {
  text: string;
  variant?: BadgeVariant;
  size?: "sm" | "md";
}

export function KBadge({ text, variant = "info", size = "md" }: KBadgeProps) {
  const { colors } = useTheme();

  const variantColors = {
    info: { bg: colors.primaryLight, text: colors.primary },
    success: { bg: colors.successLight, text: colors.success },
    warning: { bg: colors.warningLight, text: colors.warning },
    error: { bg: colors.errorLight, text: colors.error },
    neutral: { bg: colors.bgTertiary, text: colors.textSecondary },
  }[variant];

  const isSmall = size === "sm";

  return (
    <View
      style={{
        backgroundColor: variantColors.bg,
        borderRadius: radius.full,
        paddingHorizontal: isSmall ? spacing.sm : spacing.md,
        paddingVertical: isSmall ? 2 : spacing.xs,
        alignSelf: "flex-start",
      }}
    >
      <Text
        style={[
          isSmall ? typography.caption : typography.labelSmall,
          { color: variantColors.text },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}
