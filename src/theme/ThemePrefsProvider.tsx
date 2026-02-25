import { createContext, useContext, useState, type ReactNode } from "react";

export type ThemeMode = "auto" | "light" | "dark";

interface ThemePrefs {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}

const Ctx = createContext<ThemePrefs>({ mode: "auto", setMode: () => {} });

export function ThemePrefsProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("auto");
  return <Ctx.Provider value={{ mode, setMode }}>{children}</Ctx.Provider>;
}

export function useThemePrefs() {
  return useContext(Ctx);
}
