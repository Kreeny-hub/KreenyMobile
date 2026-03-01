import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from "react-native";
import { useTheme } from "../../theme";
import type { Theme } from "../../theme";

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

/**
 * createStyles — factory de StyleSheet avec accès au thème.
 *
 * Usage :
 * ```ts
 * const useStyles = createStyles((colors, isDark) => ({
 *   container: { backgroundColor: colors.bg, padding: 20 },
 *   title: { color: colors.text, fontSize: 18 },
 * }));
 *
 * // Dans le composant :
 * const { styles, colors, isDark } = useStyles();
 * ```
 */
export function createStyles<T extends NamedStyles<T>>(
  factory: (colors: Theme, isDark: boolean) => T
) {
  return function useStyles() {
    const { colors, isDark } = useTheme();
    const styles = StyleSheet.create(factory(colors, isDark));
    return { styles, colors, isDark };
  };
}
