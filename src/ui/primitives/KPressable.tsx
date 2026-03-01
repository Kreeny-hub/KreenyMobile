import { Pressable, type PressableProps, type ViewStyle } from "react-native";

interface KPressableProps extends Omit<PressableProps, "style"> {
  /** Container style */
  style?: ViewStyle | ViewStyle[];
  /** Pressed opacity (default: 0.7) */
  activeOpacity?: number;
  /** Scale on press (default: none) */
  activeScale?: number;
}

export function KPressable({
  children,
  style,
  activeOpacity = 0.7,
  activeScale,
  disabled,
  ...rest
}: KPressableProps) {
  return (
    <Pressable
      style={({ pressed }) => [
        style,
        pressed && !disabled && {
          opacity: activeOpacity,
          ...(activeScale ? { transform: [{ scale: activeScale }] } : {}),
        },
        disabled && { opacity: 0.5 },
      ]}
      disabled={disabled}
      {...rest}
    >
      {children}
    </Pressable>
  );
}
