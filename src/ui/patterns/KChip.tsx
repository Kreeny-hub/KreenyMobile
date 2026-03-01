import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KText } from "../primitives/KText";
import { KPressable } from "../primitives/KPressable";
import { useTheme, spacing, radius } from "../../theme";

interface KChipProps {
  label: string;
  /** Currently selected */
  active?: boolean;
  /** Ionicons icon name */
  icon?: string;
  /** On press handler */
  onPress?: () => void;
}

export function KChip({ label, active, icon, onPress }: KChipProps) {
  const { colors, isDark } = useTheme();

  return (
    <KPressable onPress={onPress}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: spacing.lg,
          paddingVertical: spacing.sm,
          borderRadius: radius.full,
          backgroundColor: active ? colors.text : isDark ? colors.bgTertiary : colors.bgTertiary,
          borderWidth: active ? 0 : 1,
          borderColor: isDark ? colors.border : "rgba(0,0,0,0.1)",
        }}
      >
        {icon && (
          <Ionicons
            name={icon as any}
            size={14}
            color={active ? colors.textInverse : colors.text}
          />
        )}
        <KText
          variant="labelSmall"
          color={active ? colors.textInverse : colors.text}
        >
          {label}
        </KText>
      </View>
    </KPressable>
  );
}
