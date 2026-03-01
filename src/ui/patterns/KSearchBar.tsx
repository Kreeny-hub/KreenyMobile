import { TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, spacing, radius } from "../../theme";

interface KSearchBarProps extends Omit<TextInputProps, "style"> {
  /** Placeholder (default: "Rechercher…") */
  placeholder?: string;
}

export function KSearchBar({
  placeholder = "Rechercher…",
  ...rest
}: KSearchBarProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        backgroundColor: isDark ? colors.bgTertiary : colors.bgTertiary,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        marginHorizontal: spacing.xl,
      }}
    >
      <Ionicons name="search" size={18} color={colors.textTertiary} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        style={{
          flex: 1,
          fontSize: 15,
          fontWeight: "500",
          color: colors.text,
          paddingVertical: 6,
        }}
        {...rest}
      />
    </View>
  );
}
