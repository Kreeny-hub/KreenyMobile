import { ReactNode } from "react";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KText, KRow, KVStack, KPressable, KImage, createStyles } from "../index";

// ═══════════════════════════════════════════════════════
// Spacing — 8px grid
// ═══════════════════════════════════════════════════════
const S = { xs: 4, sm: 8, md: 16 } as const;

// ── Status config — contrasted for all modes ──
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; darkColor: string; darkBg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  requested:                { label: "En attente",      color: "#92400E", bg: "#FEF3C7", darkColor: "#FBBF24", darkBg: "rgba(251,191,36,0.12)", icon: "time-outline" },
  accepted_pending_payment: { label: "À payer",         color: "#1E40AF", bg: "#DBEAFE", darkColor: "#60A5FA", darkBg: "rgba(96,165,250,0.12)",  icon: "card-outline" },
  confirmed:                { label: "Confirmée",       color: "#1E40AF", bg: "#DBEAFE", darkColor: "#60A5FA", darkBg: "rgba(96,165,250,0.12)",  icon: "checkmark-circle-outline" },
  pickup_pending:           { label: "Constat départ",  color: "#5B21B6", bg: "#EDE9FE", darkColor: "#A78BFA", darkBg: "rgba(167,139,250,0.12)", icon: "camera-outline" },
  in_progress:              { label: "En cours",        color: "#065F46", bg: "#D1FAE5", darkColor: "#34D399", darkBg: "rgba(52,211,153,0.12)",  icon: "car-sport-outline" },
  dropoff_pending:          { label: "Constat retour",  color: "#5B21B6", bg: "#EDE9FE", darkColor: "#A78BFA", darkBg: "rgba(167,139,250,0.12)", icon: "camera-outline" },
  completed:                { label: "Terminée",        color: "#065F46", bg: "#D1FAE5", darkColor: "#34D399", darkBg: "rgba(52,211,153,0.12)",  icon: "checkmark-done-outline" },
  cancelled:                { label: "Annulée",         color: "#991B1B", bg: "#FEE2E2", darkColor: "#F87171", darkBg: "rgba(248,113,113,0.12)", icon: "close-circle-outline" },
  rejected:                 { label: "Refusée",         color: "#991B1B", bg: "#FEE2E2", darkColor: "#F87171", darkBg: "rgba(248,113,113,0.12)", icon: "close-circle-outline" },
};

export interface VehicleCardCompactProps {
  coverUrl?: string | null;
  title: string;
  onPress: () => void;

  // Optional overlays on image
  photoCount?: number;
  inactive?: boolean;

  // Subtitle line (city, dates, etc)
  subtitle?: string;

  // Price
  priceLabel?: string;

  // Status badge (reservation status)
  status?: string;

  // Optional status line (e.g. "Active · en ligne")
  statusLine?: string;
  statusLineColor?: string;

  // Deleted/unavailable vehicle
  deleted?: boolean;

  // Ribbon badges (e.g. "3 demandes", "Désactivée")
  ribbons?: ReactNode;

  // Footer actions (below body, separated)
  actions?: ReactNode;

  // Inline actions (inside body, next to info — preferred for reservations)
  inlineActions?: ReactNode;
}

export function VehicleCardCompact({
  coverUrl, title, onPress, photoCount, inactive,
  subtitle, priceLabel, status, statusLine, statusLineColor,
  deleted, ribbons, actions, inlineActions,
}: VehicleCardCompactProps) {
  const { styles: s, colors, isDark } = useStyles();

  const stCfg = status ? STATUS_CONFIG[status] : null;
  const stColor = stCfg ? (isDark ? stCfg.darkColor : stCfg.color) : null;
  const stBg = stCfg ? (isDark ? stCfg.darkBg : stCfg.bg) : null;

  return (
    <View style={s.card}>
      {/* ── Ribbons (optional) ── */}
      {ribbons && <View style={s.ribbons}>{ribbons}</View>}

      {/* ── Body: image + info ── */}
      <KPressable onPress={onPress} style={s.body}>
        <View style={s.cover}>
          {coverUrl ? (
            <KImage source={{ uri: coverUrl }} style={[{ width: "100%", height: "100%" }, deleted && { opacity: 0.4 }]} />
          ) : (
            <View style={s.coverEmpty}>
              <Ionicons name={deleted ? "ban-outline" : "car-outline"} size={22} color={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)"} />
            </View>
          )}
          {(photoCount ?? 0) > 0 && !deleted && (
            <View style={s.photoBadge}>
              <Ionicons name="images" size={10} color="#FFF" />
              <KText variant="caption" bold style={{ fontSize: 10, color: "#FFF" }}>{photoCount}</KText>
            </View>
          )}
          {inactive && (
            <View style={s.inactiveDot}><Ionicons name="pause" size={10} color="#FFF" /></View>
          )}
          {deleted && (
            <View style={s.deletedOverlay}><Ionicons name="ban-outline" size={20} color="rgba(255,255,255,0.8)" /></View>
          )}
        </View>

        <KVStack justify="center" gap={S.xs} style={{ flex: 1 }}>
          {/* Title — full width, never truncated by badge */}
          <KText variant="label" bold numberOfLines={1} style={[{ fontSize: 15 }, deleted && { color: colors.textTertiary }]}>{title}</KText>

          {/* Status badge — prominent, own row */}
          {stCfg && stColor && stBg && (
            <View style={[s.statusBadge, { backgroundColor: stBg, alignSelf: "flex-start" }]}>
              <Ionicons name={stCfg.icon} size={11} color={stColor} />
              <KText variant="caption" bold style={{ fontSize: 10, color: stColor, letterSpacing: 0.1 }}>{stCfg.label}</KText>
            </View>
          )}

          {/* Subtitle */}
          {subtitle && (
            <KText variant="caption" color="textSecondary" numberOfLines={1}>{subtitle}</KText>
          )}

          {/* Price */}
          {priceLabel && (
            <KText variant="label" bold style={{ color: deleted ? colors.textTertiary : colors.primary, fontSize: 14, marginTop: 2 }}>{priceLabel}</KText>
          )}

          {/* Status line (e.g. "Active · en ligne") */}
          {statusLine && (
            <KText variant="caption" bold style={{ color: statusLineColor ?? colors.success, fontSize: 11, marginTop: 1 }}>{statusLine}</KText>
          )}

          {/* Inline actions — inside body, visually attached to info */}
          {inlineActions && (
            <View style={{ marginTop: 6 }}>{inlineActions}</View>
          )}
        </KVStack>
      </KPressable>

      {/* ── Footer actions (optional) ── */}
      {actions && <View style={inlineActions ? s.footerLight : s.footer}>{actions}</View>}
    </View>
  );
}

// ── Reusable action button for card footers ──
export function CardAction({ label, icon, variant = "secondary", onPress }: {
  label?: string;
  icon: keyof typeof Ionicons.glyphMap;
  variant?: "primary" | "secondary" | "danger" | "warning";
  onPress: () => void;
}) {
  const { colors, isDark } = useActionStyles();
  const cfg = {
    primary:   { bg: colors.primary, fg: "#FFF" },
    secondary: { bg: isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)", fg: colors.text },
    danger:    { bg: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)", fg: "#EF4444" },
    warning:   { bg: isDark ? "rgba(245,158,11,0.12)" : "#FEF3C7", fg: "#D97706" },
  }[variant];

  return (
    <KPressable onPress={onPress} style={{
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: cfg.bg, paddingHorizontal: label ? 12 : 10, paddingVertical: 8,
      borderRadius: 10, minHeight: 36,
    }}>
      <Ionicons name={icon} size={14} color={cfg.fg} />
      {label && <KText variant="caption" bold style={{ color: cfg.fg }}>{label}</KText>}
    </KPressable>
  );
}
const useActionStyles = createStyles((c, isDark) => ({ _: {} }));

// ── Ribbon pill ──
export function CardRibbon({ label, icon, color, bg }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bg: string;
}) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: bg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
      <Ionicons name={icon} size={12} color={color} />
      <KText variant="caption" bold style={{ fontSize: 11, color }}>{label}</KText>
    </View>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  card: {
    backgroundColor: colors.card, borderRadius: 16, overflow: "hidden",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
    shadowColor: "#000", shadowOpacity: isDark ? 0 : 0.06, shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 }, elevation: isDark ? 0 : 2,
  },
  ribbons: {
    flexDirection: "row", gap: S.sm, paddingHorizontal: S.md - 4, paddingTop: S.sm, flexWrap: "wrap",
  },
  body: {
    flexDirection: "row", gap: S.md - 4, paddingHorizontal: S.md - 4, paddingTop: S.md - 4, paddingBottom: S.sm,
  },
  cover: {
    width: 88, height: 88, borderRadius: 12, overflow: "hidden",
    backgroundColor: isDark ? colors.bgTertiary : "#F0F2F5",
  },
  coverEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  deletedOverlay: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as any),
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  photoBadge: {
    position: "absolute", bottom: 5, right: 5, flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2,
  },
  inactiveDot: {
    position: "absolute", top: 5, left: 5,
    backgroundColor: "rgba(239,68,68,0.85)", borderRadius: 6, padding: 3,
  },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7,
  },
  footer: {
    flexDirection: "row", alignItems: "center", gap: S.sm, flexWrap: "wrap",
    paddingHorizontal: S.md - 4, paddingBottom: 10, paddingTop: 6,
    borderTopWidth: 0.5, borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
  },
  footerLight: {
    flexDirection: "row", alignItems: "center", justifyContent: "flex-end",
    paddingHorizontal: S.md - 4, paddingBottom: 10, paddingTop: 2,
  },
}));
