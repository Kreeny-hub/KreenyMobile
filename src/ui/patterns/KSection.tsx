import { View, type ViewStyle } from "react-native";
import { KText } from "../primitives/KText";
import { KDivider } from "../primitives/KDivider";
import { spacing } from "../../theme";

interface KSectionProps {
  children: React.ReactNode;
  /** Section title */
  title?: string;
  /** Show divider above section (default: false) */
  dividerTop?: boolean;
  /** Show divider below section (default: false) */
  dividerBottom?: boolean;
  /** Horizontal padding (default: 20) */
  px?: number;
  /** Extra style */
  style?: ViewStyle;
}

export function KSection({
  children,
  title,
  dividerTop = false,
  dividerBottom = false,
  px = 20,
  style,
}: KSectionProps) {
  return (
    <View style={style}>
      {dividerTop && <KDivider mx={px} />}

      {title && (
        <KText
          variant="h2"
          bold
          style={{
            marginTop: spacing["3xl"],
            marginBottom: spacing.lg,
            paddingHorizontal: px,
            letterSpacing: -0.2,
          }}
        >
          {title}
        </KText>
      )}

      {children}

      {dividerBottom && <KDivider mx={px} />}
    </View>
  );
}
