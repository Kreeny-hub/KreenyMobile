import { View } from "react-native";
import { spacing } from "../../theme";

type SpacingKey = keyof typeof spacing;

interface KSpacerProps {
  /** Spacing token key or pixel number */
  size?: SpacingKey | number;
  /** Flex spacer (takes remaining space) */
  flex?: number;
}

export function KSpacer({ size = "lg", flex }: KSpacerProps) {
  const px = flex ? 0 : typeof size === "number" ? size : spacing[size];
  return <View style={{ height: px, width: px, flex }} />;
}
