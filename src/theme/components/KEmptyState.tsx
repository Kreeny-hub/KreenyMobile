import { View, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, typography, spacing } from "../../theme";
import { KButton } from "./KButton";

interface KEmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function KEmptyState({
  icon,
  title,
  description,
  actionTitle,
  onAction,
}: KEmptyStateProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: spacing["3xl"],
        paddingVertical: spacing["5xl"],
        gap: spacing.lg,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: colors.primaryLight,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: spacing.sm,
        }}
      >
        <Ionicons name={icon} size={32} color={colors.primary} />
      </View>
      <Text
        style={[
          typography.h2,
          { color: colors.text, textAlign: "center" },
        ]}
      >
        {title}
      </Text>
      {description && (
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: "center", lineHeight: 22 },
          ]}
        >
          {description}
        </Text>
      )}
      {actionTitle && onAction && (
        <View style={{ marginTop: spacing.sm, width: "100%", maxWidth: 240 }}>
          <KButton title={actionTitle} onPress={onAction} variant="secondary" />
        </View>
      )}
    </View>
  );
}
