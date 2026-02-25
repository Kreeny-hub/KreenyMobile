import { useState } from "react";
import { TextInput, View, Text, type TextInputProps } from "react-native";
import { useTheme, typography, radius, spacing } from "../../theme";
import { Ionicons } from "@expo/vector-icons";

interface KInputProps extends Omit<TextInputProps, "style"> {
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  hint?: string;
}

export function KInput({ label, icon, error, hint, ...props }: KInputProps) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
      ? colors.borderFocused
      : colors.inputBorder;

  return (
    <View style={{ gap: spacing.xs }}>
      {label && (
        <Text style={[typography.label, { color: colors.text, marginBottom: 2 }]}>
          {label}
        </Text>
      )}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.inputBg,
          borderWidth: 1.5,
          borderColor,
          borderRadius: radius.md,
          paddingHorizontal: spacing.lg,
          height: 50,
          gap: spacing.sm,
        }}
      >
        {icon && (
          <Ionicons
            name={icon}
            size={18}
            color={focused ? colors.primary : colors.textTertiary}
          />
        )}
        <TextInput
          {...props}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
          placeholderTextColor={colors.inputPlaceholder}
          style={[
            typography.body,
            {
              flex: 1,
              color: colors.inputText,
              paddingVertical: 0,
            },
          ]}
        />
      </View>
      {error && (
        <Text style={[typography.caption, { color: colors.error, marginTop: 2 }]}>
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 2 }]}>
          {hint}
        </Text>
      )}
    </View>
  );
}
