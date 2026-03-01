import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { KText, KRow, KVStack, KPressable, KImage, createStyles } from "../index";
import { KFavoriteButton } from "../../components/KFavoriteButton";

// ═══════════════════════════════════════════════════════
// Spacing constants — 8px grid
// ═══════════════════════════════════════════════════════
const S = { xs: 4, sm: 8, md: 16, lg: 24 } as const;

export interface VehicleCardLargeProps {
  vehicleId: string;
  coverUrl?: string | null;
  title: string;
  city: string;
  pricePerDay: number;
  reviewAverage?: number | null;
  reviewCount?: number;
  showHeart?: boolean;
  onPress: () => void;
}

export function VehicleCardLarge({
  vehicleId, coverUrl, title, city, pricePerDay,
  reviewAverage, reviewCount = 0, showHeart = true, onPress,
}: VehicleCardLargeProps) {
  const { styles: s, colors, isDark } = useStyles();

  return (
    <KPressable onPress={onPress} activeScale={0.985} style={s.card}>
      {/* ── Image ── */}
      <View style={s.imageWrap}>
        {coverUrl ? (
          <KImage source={{ uri: coverUrl }} style={{ width: "100%", height: "100%" }} />
        ) : (
          <View style={s.noImage}>
            <Ionicons name="car-outline" size={32} color={isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)"} />
          </View>
        )}
        {showHeart && (
          <View style={s.heart}>
            <KFavoriteButton vehicleId={vehicleId} size={16} variant="overlay" />
          </View>
        )}
      </View>

      {/* ── Info ── */}
      <VehicleInfo
        title={title} city={city} pricePerDay={pricePerDay}
        reviewAverage={reviewAverage} reviewCount={reviewCount}
      />
    </KPressable>
  );
}

// ── Shared info block (reused in Compact too) ──
function VehicleInfo({ title, city, pricePerDay, reviewAverage, reviewCount }: {
  title: string; city: string; pricePerDay: number; reviewAverage?: number | null; reviewCount?: number;
}) {
  const { styles: s, colors } = useStyles();
  return (
    <KVStack gap={S.xs} style={s.info}>
      {/* Row 1: Title + rating */}
      <KRow justify="space-between" style={{ alignItems: "center" }}>
        <KText variant="label" bold numberOfLines={1} style={{ flex: 1, fontSize: 15 }}>{title}</KText>
        {(reviewCount ?? 0) > 0 && reviewAverage && (
          <KRow gap={3} style={{ alignItems: "center", marginLeft: S.sm }}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <KText variant="caption" bold>{reviewAverage.toFixed(1)}</KText>
            <KText variant="caption" color="textTertiary">({reviewCount})</KText>
          </KRow>
        )}
      </KRow>

      {/* Row 2: Location inline */}
      <KText variant="caption" color="textSecondary" numberOfLines={1}>{city}</KText>

      {/* Row 3: Price */}
      <KRow justify="space-between" style={{ alignItems: "center", marginTop: S.xs }}>
        <KRow gap={S.xs} style={{ alignItems: "center" }}>
          <Ionicons name="shield-checkmark" size={13} color={colors.primary} />
          <KText variant="caption" style={{ color: colors.primary }}>Vérifié</KText>
        </KRow>
        <KRow gap={2} style={{ alignItems: "baseline" }}>
          <KText variant="label" bold style={{ fontSize: 16 }}>{pricePerDay}</KText>
          <KText variant="caption" color="textSecondary"> MAD/j</KText>
        </KRow>
      </KRow>
    </KVStack>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  card: {
    borderRadius: 16, overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: isDark ? 1 : 0, borderColor: isDark ? colors.cardBorder : "transparent",
    shadowColor: "#000", shadowOpacity: isDark ? 0 : 0.07, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: isDark ? 0 : 3,
  },
  imageWrap: {
    width: "100%", height: 180, position: "relative",
    backgroundColor: isDark ? colors.bgTertiary : "#F0F2F5",
  },
  noImage: { flex: 1, alignItems: "center", justifyContent: "center" },
  heart: { position: "absolute", top: S.sm + 2, right: S.sm + 2 },
  info: { padding: S.md - 4 },
}));
