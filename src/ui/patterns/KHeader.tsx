import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { KText } from "../primitives/KText";
import { KPressable } from "../primitives/KPressable";
import { useTheme, spacing } from "../../theme";

interface KHeaderProps {
  /** Title text */
  title?: string;
  /** Show back button (default: true) */
  back?: boolean;
  /** Custom back action */
  onBack?: () => void;
  /** Right-side element */
  right?: React.ReactNode;
}

export function KHeader({ title, back = true, onBack, right }: KHeaderProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: spacing.xl,
        paddingVertical: spacing.md,
        minHeight: 52,
      }}
    >
      {back && (
        <KPressable
          onPress={onBack ?? (() => router.back())}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: colors.bgTertiary,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
      )}

      {title && (
        <KText variant="h2" bold style={{ flex: 1, marginLeft: back ? 12 : 0 }}>
          {title}
        </KText>
      )}

      {!title && <View style={{ flex: 1 }} />}

      {right}
    </View>
  );
}
