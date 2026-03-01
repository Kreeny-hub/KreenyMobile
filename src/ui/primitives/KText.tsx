import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme, typography } from "../../theme";

type Variant = keyof typeof typography;
type ColorKey = "text" | "textSecondary" | "textTertiary" | "textInverse" | "primary" | "error" | "success" | "warning";

interface KTextProps extends TextProps {
  /** Typography variant (default: "body") */
  variant?: Variant;
  /** Semantic color key or raw color string */
  color?: ColorKey | (string & {});
  /** Center text */
  center?: boolean;
  /** Bold override */
  bold?: boolean;
  /** Extra style */
  style?: TextStyle | TextStyle[];
}

export function KText({
  variant = "body",
  color,
  center,
  bold,
  style,
  children,
  ...rest
}: KTextProps) {
  const { colors } = useTheme();

  // Resolve color: theme key → token value, raw string → passthrough
  const resolvedColor = color
    ? (colors as any)[color] ?? color
    : colors.text;

  return (
    <Text
      style={[
        typography[variant],
        { color: resolvedColor },
        center && { textAlign: "center" },
        bold && { fontWeight: "700" },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
