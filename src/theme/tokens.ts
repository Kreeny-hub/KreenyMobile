/**
 * KREENY DESIGN SYSTEM
 * Style: Moderne/clean (Airbnb, Uber)
 * Couleur: Bleu confiance
 * Mode: Light + Dark auto
 */

// ─── Color Palette ────────────────────────────────────
const palette = {
  // Blue — Principal (confiance, sécurité)
  blue50: "#EFF6FF",
  blue100: "#DBEAFE",
  blue200: "#BFDBFE",
  blue300: "#93C5FD",
  blue400: "#60A5FA",
  blue500: "#3B82F6",
  blue600: "#2563EB",
  blue700: "#1D4ED8",
  blue800: "#1E40AF",
  blue900: "#1E3A8A",

  // Neutrals
  white: "#FFFFFF",
  gray50: "#F9FAFB",
  gray100: "#F3F4F6",
  gray150: "#EBEDF0",
  gray200: "#E5E7EB",
  gray300: "#D1D5DB",
  gray400: "#9CA3AF",
  gray500: "#6B7280",
  gray600: "#4B5563",
  gray700: "#374151",
  gray800: "#1F2937",
  gray900: "#111827",
  gray950: "#0A0F1A",
  black: "#000000",

  // Semantic
  green500: "#22C55E",
  green600: "#16A34A",
  green50: "#F0FDF4",
  red500: "#EF4444",
  red600: "#DC2626",
  red50: "#FEF2F2",
  amber500: "#F59E0B",
  amber50: "#FFFBEB",
} as const;

// ─── Theme Definitions ────────────────────────────────
export const lightTheme = {
  // Backgrounds
  bg: palette.white,
  bgSecondary: palette.gray50,
  bgTertiary: palette.gray100,
  bgElevated: palette.white,

  // Text
  text: palette.gray900,
  textSecondary: palette.gray500,
  textTertiary: palette.gray400,
  textInverse: palette.white,

  // Primary (Dodger Blue — #3B82F6)
  primary: palette.blue500,
  primaryLight: palette.blue50,
  primaryMuted: palette.blue100,
  primaryDark: palette.blue600,
  primaryText: palette.white,

  // Borders & Dividers
  border: palette.gray200,
  borderLight: palette.gray100,
  borderFocused: palette.blue400,

  // Cards & Surfaces
  card: palette.white,
  cardBorder: palette.gray150,
  cardShadow: "rgba(0, 0, 0, 0.06)",

  // Status
  success: palette.green600,
  successLight: palette.green50,
  error: palette.red600,
  errorLight: palette.red50,
  warning: palette.amber500,
  warningLight: palette.amber50,

  // Misc
  skeleton: palette.gray200,
  overlay: "rgba(0, 0, 0, 0.4)",
  tabBar: palette.white,
  tabBarBorder: palette.gray200,
  tabBarActive: palette.blue500,
  tabBarInactive: palette.gray400,

  // Input
  inputBg: palette.gray50,
  inputBorder: palette.gray200,
  inputText: palette.gray900,
  inputPlaceholder: palette.gray400,
} as const;

export const darkTheme: typeof lightTheme = {
  // Backgrounds
  bg: palette.gray950,
  bgSecondary: palette.gray900,
  bgTertiary: palette.gray800,
  bgElevated: palette.gray800,

  // Text
  text: palette.gray50,
  textSecondary: palette.gray400,
  textTertiary: palette.gray500,
  textInverse: palette.gray900,

  // Primary (Dodger Blue — plus lumineux en dark pour contraste)
  primary: palette.blue400,
  primaryLight: "rgba(96, 165, 250, 0.15)",
  primaryMuted: "rgba(96, 165, 250, 0.25)",
  primaryDark: palette.blue300,
  primaryText: palette.white,

  // Borders & Dividers
  border: palette.gray700,
  borderLight: palette.gray800,
  borderFocused: palette.blue400,

  // Cards & Surfaces
  card: palette.gray900,
  cardBorder: palette.gray700,
  cardShadow: "rgba(0, 0, 0, 0.3)",

  // Status
  success: palette.green500,
  successLight: "rgba(34, 197, 94, 0.15)",
  error: palette.red500,
  errorLight: "rgba(239, 68, 68, 0.15)",
  warning: palette.amber500,
  warningLight: "rgba(245, 158, 11, 0.15)",

  // Misc
  skeleton: palette.gray700,
  overlay: "rgba(0, 0, 0, 0.6)",
  tabBar: palette.gray900,
  tabBarBorder: palette.gray800,
  tabBarActive: palette.blue400,
  tabBarInactive: palette.gray500,

  // Input
  inputBg: palette.gray800,
  inputBorder: palette.gray700,
  inputText: palette.gray50,
  inputPlaceholder: palette.gray500,
};

export type Theme = typeof lightTheme;

// ─── Typography ───────────────────────────────────────
export const typography = {
  // Display — titres de page
  displayLarge: { fontSize: 28, fontWeight: "800" as const, letterSpacing: -0.5 },
  displayMedium: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.3 },

  // Headings
  h1: { fontSize: 22, fontWeight: "700" as const, letterSpacing: -0.2 },
  h2: { fontSize: 18, fontWeight: "700" as const },
  h3: { fontSize: 16, fontWeight: "600" as const },

  // Body
  bodyLarge: { fontSize: 16, fontWeight: "400" as const, lineHeight: 24 },
  body: { fontSize: 15, fontWeight: "400" as const, lineHeight: 22 },
  bodySmall: { fontSize: 13, fontWeight: "400" as const, lineHeight: 18 },

  // Labels & UI
  label: { fontSize: 14, fontWeight: "600" as const },
  labelSmall: { fontSize: 12, fontWeight: "600" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },

  // Price
  price: { fontSize: 20, fontWeight: "800" as const },
  priceSmall: { fontSize: 17, fontWeight: "700" as const },
} as const;

// ─── Spacing ──────────────────────────────────────────
export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

// ─── Radius ───────────────────────────────────────────
export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

// ─── Shadows (light mode) ─────────────────────────────
export const shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;
