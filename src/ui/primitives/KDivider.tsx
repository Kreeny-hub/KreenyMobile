import { View, type ViewStyle } from "react-native";
import { useTheme } from "../../theme";

interface KDividerProps {
  /** Horizontal margin (default: 0) */
  mx?: number;
  /** Indent from left only */
  indent?: number;
  /** Extra style */
  style?: ViewStyle;
}

export function KDivider({ mx = 0, indent, style }: KDividerProps) {
  const { colors, isDark } = useTheme();

  return (
    <View
      style={[
        {
          height: 1,
          backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
          marginHorizontal: mx,
          marginLeft: indent,
        },
        style,
      ]}
    />
  );
}
