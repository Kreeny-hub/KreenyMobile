import { View, type ViewStyle } from "react-native";
import { spacing } from "../../theme";

type SpacingKey = keyof typeof spacing;

interface KStackProps {
  children: React.ReactNode;
  /** Direction (default: "vertical") */
  direction?: "vertical" | "horizontal";
  /** Gap between children — spacing token key or number */
  gap?: SpacingKey | number;
  /** Align items */
  align?: ViewStyle["alignItems"];
  /** Justify content */
  justify?: ViewStyle["justifyContent"];
  /** Fill available space */
  flex?: number;
  /** Wrap (for horizontal) */
  wrap?: boolean;
  /** Padding — spacing token key or number */
  padding?: SpacingKey | number;
  /** Horizontal padding */
  px?: SpacingKey | number;
  /** Vertical padding */
  py?: SpacingKey | number;
  /** Extra style */
  style?: ViewStyle | ViewStyle[];
}

function resolve(val: SpacingKey | number | undefined): number | undefined {
  if (val === undefined) return undefined;
  return typeof val === "number" ? val : spacing[val];
}

export function KStack({
  children,
  direction = "vertical",
  gap,
  align,
  justify,
  flex,
  wrap,
  padding,
  px,
  py,
  style,
}: KStackProps) {
  const isRow = direction === "horizontal";

  return (
    <View
      style={[
        {
          flexDirection: isRow ? "row" : "column",
          gap: resolve(gap),
          alignItems: align ?? (isRow ? "center" : undefined),
          justifyContent: justify,
          flex,
          flexWrap: wrap ? "wrap" : undefined,
          padding: resolve(padding),
          paddingHorizontal: resolve(px),
          paddingVertical: resolve(py),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Shorthand: horizontal stack */
export function KRow(props: Omit<KStackProps, "direction">) {
  return <KStack direction="horizontal" {...props} />;
}

/** Shorthand: vertical stack */
export function KVStack(props: Omit<KStackProps, "direction">) {
  return <KStack direction="vertical" {...props} />;
}
