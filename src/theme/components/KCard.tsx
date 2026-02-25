import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import { useTheme, radius, shadows } from "../../theme";

interface KCardProps {
  children: React.ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  noPadding?: boolean;
}

export function KCard({ children, onPress, style, noPadding }: KCardProps) {
  const { colors, isDark } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    borderWidth: isDark ? 1 : 0,
    borderColor: colors.cardBorder,
    overflow: "hidden",
    ...(!isDark ? shadows.md : {}),
  };

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          cardStyle,
          !noPadding && { padding: 0 },
          pressed && { opacity: 0.92, transform: [{ scale: 0.985 }] },
          style,
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[cardStyle, !noPadding && { padding: 0 }, style]}>
      {children}
    </View>
  );
}
