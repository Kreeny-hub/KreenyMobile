import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KText } from "../primitives/KText";
import { KPressable } from "../primitives/KPressable";
import { useTheme, spacing } from "../../theme";

interface KListItemProps {
  /** Ionicons icon name */
  icon?: string;
  /** Icon color override */
  iconColor?: string;
  /** Main label */
  label: string;
  /** Subtitle / value under label */
  subtitle?: string;
  /** Right-side value text */
  value?: string;
  /** Show chevron (default: true if onPress) */
  chevron?: boolean;
  /** Right-side custom element */
  right?: React.ReactNode;
  /** Danger / destructive style */
  danger?: boolean;
  /** On press handler */
  onPress?: () => void;
  /** Disabled */
  disabled?: boolean;
}

export function KListItem({
  icon,
  iconColor,
  label,
  subtitle,
  value,
  chevron,
  right,
  danger,
  onPress,
  disabled,
}: KListItemProps) {
  const { colors, isDark } = useTheme();
  const showChevron = chevron ?? !!onPress;
  const textColor = danger ? colors.error : colors.text;

  const content = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: spacing.lg,
        paddingHorizontal: spacing.xl,
      }}
    >
      {icon && (
        <Ionicons
          name={icon as any}
          size={22}
          color={iconColor ?? textColor}
        />
      )}

      <View style={{ flex: 1 }}>
        <KText
          variant="label"
          color={danger ? "error" : "text"}
          style={{ fontSize: 15 }}
        >
          {label}
        </KText>
        {subtitle && (
          <KText variant="caption" color="textTertiary" style={{ marginTop: 2 }}>
            {subtitle}
          </KText>
        )}
      </View>

      {value && (
        <KText variant="bodySmall" color="textTertiary">
          {value}
        </KText>
      )}

      {right}

      {showChevron && (
        <Ionicons
          name="chevron-forward"
          size={17}
          color={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}
        />
      )}
    </View>
  );

  if (!onPress) return content;

  return (
    <KPressable onPress={onPress} disabled={disabled}>
      {content}
    </KPressable>
  );
}
