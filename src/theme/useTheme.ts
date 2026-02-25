import { useColorScheme } from "react-native";
import { lightTheme, darkTheme, type Theme } from "./tokens";
import { useThemePrefs } from "./ThemePrefsProvider";

/**
 * Hook principal pour accéder au thème courant.
 * Respecte la préférence utilisateur (auto / light / dark).
 */
export function useTheme(): { colors: Theme; isDark: boolean } {
  const systemScheme = useColorScheme();

  let prefs: { mode: string } = { mode: "auto" };
  try {
    prefs = useThemePrefs();
  } catch {
    // Provider pas encore monté → fallback auto
  }

  const isDark =
    prefs.mode === "dark" ? true :
    prefs.mode === "light" ? false :
    systemScheme === "dark";

  return {
    colors: isDark ? darkTheme : lightTheme,
    isDark,
  };
}
