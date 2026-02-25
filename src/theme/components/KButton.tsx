import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme, typography, radius, spacing } from "../../theme";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

type Variant = "primary" | "secondary" | "outline" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg";

interface KButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: "left" | "right";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
}

export function KButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  fullWidth = true,
}: KButtonProps) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const handlePress = () => {
    if (isDisabled) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const sizeStyles = {
    sm: { height: 36, paddingHorizontal: spacing.md, gap: 6 },
    md: { height: 48, paddingHorizontal: spacing.xl, gap: 8 },
    lg: { height: 56, paddingHorizontal: spacing["2xl"], gap: 10 },
  }[size];

  const textSize = {
    sm: { fontSize: 13, fontWeight: "600" as const },
    md: { fontSize: 15, fontWeight: "600" as const },
    lg: { fontSize: 16, fontWeight: "700" as const },
  }[size];

  const iconSize = size === "sm" ? 16 : size === "md" ? 18 : 20;

  // Couleurs selon variant
  const variantStyles = {
    primary: {
      bg: colors.primary,
      bgPressed: colors.primaryDark,
      text: colors.primaryText,
      border: "transparent",
    },
    secondary: {
      bg: colors.primaryLight,
      bgPressed: colors.primaryMuted,
      text: colors.primary,
      border: "transparent",
    },
    outline: {
      bg: "transparent",
      bgPressed: colors.bgTertiary,
      text: colors.text,
      border: colors.border,
    },
    ghost: {
      bg: "transparent",
      bgPressed: colors.bgTertiary,
      text: colors.primary,
      border: "transparent",
    },
    destructive: {
      bg: colors.error,
      bgPressed: colors.error,
      text: "#FFF",
      border: "transparent",
    },
  }[variant];

  return (
    <Pressable
      onPress={handlePress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          height: sizeStyles.height,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          borderRadius: radius.md,
          backgroundColor: pressed ? variantStyles.bgPressed : variantStyles.bg,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: variantStyles.border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: sizeStyles.gap,
          opacity: isDisabled ? 0.5 : 1,
        },
        fullWidth && { width: "100%" as any },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variantStyles.text} size="small" />
      ) : (
        <>
          {icon && iconPosition === "left" && (
            <Ionicons name={icon} size={iconSize} color={variantStyles.text} />
          )}
          <Text style={[textSize, { color: variantStyles.text }]}>{title}</Text>
          {icon && iconPosition === "right" && (
            <Ionicons name={icon} size={iconSize} color={variantStyles.text} />
          )}
        </>
      )}
    </Pressable>
  );
}
