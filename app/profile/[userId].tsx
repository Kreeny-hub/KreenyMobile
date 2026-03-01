import { ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import { KText, KVStack, KRow, KPressable, KImage, KStarRating, createStyles } from "../../src/ui";

// ═══════════════════════════════════════════════════════
// Criteria labels
// ═══════════════════════════════════════════════════════
const CRITERIA_LABELS: Record<string, string> = {
  communication: "Communication",
  conformity: "Conformité",
  cleanliness: "Propreté",
  punctuality: "Ponctualité",
  vehicleCare: "Soin du véhicule",
};

// ═══════════════════════════════════════════════════════
// VehicleCard — sub-component qui fetch ses propres stats
// ═══════════════════════════════════════════════════════
function VehicleCard({ vehicle, colors, isDark }: { vehicle: any; colors: any; isDark: boolean }) {
  const { styles } = useVehicleCardStyles();
  const [expanded, setExpanded] = useState(false);
  const vehicleStats = useQuery(api.reviews.getStatsForVehicle, { vehicleId: vehicle._id });

  const criteriaEntries = vehicleStats?.criteria
    ? Object.entries(vehicleStats.criteria).filter(([, v]) => typeof v === "number" && (v as number) > 0)
    : [];
  const hasStats = criteriaEntries.length > 0;

  return (
    <View style={styles.vehicleCard}>
      <KPressable onPress={() => router.push(`/vehicle/${vehicle._id}`)} style={styles.vehicleRow}>
        {vehicle.coverUrl ? (
          <KImage source={{ uri: vehicle.coverUrl }} style={styles.vehicleThumb} />
        ) : (
          <View style={[styles.vehicleThumb, styles.vehicleThumbPlaceholder]}>
            <Ionicons name="car-outline" size={20} color={colors.textTertiary} />
          </View>
        )}
        <KVStack gap={3} flex={1}>
          <KText variant="label" bold numberOfLines={1}>{vehicle.title}</KText>
          <KRow gap={4} align="center">
            <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
            <KText variant="caption" color="textSecondary">{vehicle.city}</KText>
          </KRow>
        </KVStack>
        <KVStack align="flex-end" gap={2}>
          <KText variant="label" bold>{vehicle.pricePerDay} MAD<KText variant="caption" color="textSecondary">/j</KText></KText>
          {vehicle.reviewCount > 0 && (
            <KRow gap={3} align="center">
              <Ionicons name="star" size={11} color="#F59E0B" />
              <KText variant="caption" bold>{vehicle.reviewAverage}</KText>
              <KText variant="caption" color="textTertiary">({vehicle.reviewCount})</KText>
            </KRow>
          )}
        </KVStack>
      </KPressable>

      {/* Notes détaillées par véhicule */}
      {hasStats && (
        <KPressable onPress={() => setExpanded(!expanded)} style={styles.statsToggle}>
          <KRow gap={6} align="center">
            <Ionicons name="bar-chart-outline" size={13} color={colors.primary} />
            <KText variant="caption" bold style={{ color: colors.primary }}>Notes détaillées</KText>
          </KRow>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
        </KPressable>
      )}

      {expanded && hasStats && (
        <View style={styles.criteriaCard}>
          {criteriaEntries.map(([key, val]) => (
            <KRow key={key} gap={8} align="center">
              <KText variant="caption" color="textSecondary" style={styles.criteriaLabel}>
                {CRITERIA_LABELS[key] ?? key}
              </KText>
              <View style={styles.criteriaBarBg}>
                <View style={[styles.criteriaBarFill, { width: `${((val as number) / 5) * 100}%` }]} />
              </View>
              <KText variant="caption" bold style={styles.criteriaValue}>{val as number}</KText>
            </KRow>
          ))}
        </View>
      )}
    </View>
  );
}

const useVehicleCardStyles = createStyles((colors, isDark) => ({
  vehicleCard: {
    borderBottomWidth: 1,
    borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  vehicleRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingVertical: 12,
  },
  vehicleThumb: { width: 64, height: 44, borderRadius: 10, overflow: "hidden" },
  vehicleThumbPlaceholder: {
    backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center",
  },
  statsToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 8, paddingHorizontal: 4,
  },
  criteriaCard: {
    borderRadius: 14, overflow: "hidden",
    backgroundColor: isDark ? colors.bgTertiary : "#F9FAFB",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
    padding: 14, gap: 8, marginBottom: 10,
  },
  criteriaLabel: { width: 100 },
  criteriaBarBg: {
    flex: 1, height: 5, backgroundColor: isDark ? colors.bg : "#E5E7EB",
    borderRadius: 3, overflow: "hidden",
  },
  criteriaBarFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 3 },
  criteriaValue: { width: 22, textAlign: "right" },
}));

// ═══════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════
export default function PublicProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();

  const profile = useQuery(api.userProfiles.getPublicProfile, userId ? { userId } : "skip");
  const stats = useQuery(api.reviews.getStatsForUser, userId ? { userId } : "skip");
  const reviews = useQuery(api.reviews.getForUser, userId ? { userId } : "skip");
  const vehicles = useQuery(api.vehicles.listVehiclesByOwner, userId ? { ownerUserId: userId } : "skip");

  // ⚠️ ALL hooks BEFORE any early return
  const [expandedReview, setExpandedReview] = useState<string | null>(null);

  const onReport = () => {
    if (!userId) return;
    const name = profile?.displayName ?? "Utilisateur";
    router.push({ pathname: "/report/[targetId]", params: { targetId: userId, targetType: "user", targetLabel: name } });
  };

  if (!profile) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <KText variant="body" color="textSecondary">Chargement...</KText>
      </View>
    );
  }

  const hasReviews = stats && stats.count > 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.safeTop, { paddingTop: insets.top }]}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <KPressable onPress={() => router.back()} style={styles.backBtn}>
              <Ionicons name="chevron-back" size={22} color={colors.text} />
            </KPressable>
            <KText variant="label" bold style={styles.headerTitle}>Profil</KText>
            <View style={styles.headerSpacer} />
          </View>

          {/* ── Avatar + Name ── */}
          <KVStack align="center" gap={12} style={styles.profileSection}>
            {profile.avatarUrl ? (
              <KImage source={{ uri: profile.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarPlaceholder]}>
                <Ionicons name="person" size={40} color={colors.textTertiary} />
              </View>
            )}
            <KVStack align="center" gap={4}>
              <KRow gap={6} align="center">
                <KText variant="displaySmall" bold>{profile.displayName}</KText>
                {profile.kycStatus === "verified" && (
                  <Ionicons name="shield-checkmark" size={18} color="#3B82F6" />
                )}
              </KRow>
              <KText variant="bodySmall" color="textSecondary">Membre depuis {profile.memberSince}</KText>
            </KVStack>

            {/* Quick stats */}
            <KRow gap={24} style={styles.statsRow}>
              <KVStack align="center" gap={2}>
                <KText variant="h2" bold>{stats?.count ?? 0}</KText>
                <KText variant="caption" color="textSecondary">Avis reçus</KText>
              </KVStack>
              <View style={styles.statDivider} />
              <KVStack align="center" gap={2}>
                <KRow gap={4} align="center">
                  <Ionicons name="star" size={16} color="#F59E0B" />
                  <KText variant="h2" bold>{hasReviews ? stats.average : "–"}</KText>
                </KRow>
                <KText variant="caption" color="textSecondary">Note moyenne</KText>
              </KVStack>
              <View style={styles.statDivider} />
              <KVStack align="center" gap={2}>
                <KText variant="h2" bold>{vehicles?.length ?? 0}</KText>
                <KText variant="caption" color="textSecondary">Véhicules</KText>
              </KVStack>
            </KRow>
          </KVStack>

          {/* ── Vehicles avec notes détaillées PAR véhicule ── */}
          {vehicles && vehicles.length > 0 && (
            <View style={styles.section}>
              <KText variant="label" bold style={styles.sectionTitle}>
                {vehicles.length === 1 ? "1 véhicule" : `${vehicles.length} véhicules`}
              </KText>
              {vehicles.map((v) => (
                <VehicleCard key={v._id} vehicle={v} colors={colors} isDark={isDark} />
              ))}
            </View>
          )}

          {/* ── Reviews ── */}
          {reviews && reviews.length > 0 && (
            <View style={styles.section}>
              <KText variant="label" bold style={styles.sectionTitle}>
                {reviews.length === 1 ? "1 avis" : `${reviews.length} avis`}
              </KText>
              {reviews.map((r: any) => {
                const isExpanded = expandedReview === r._id;
                const reviewRatings = r.ratings ? Object.entries(r.ratings).filter(([, v]) => typeof v === "number" && (v as number) > 0) : [];
                return (
                  <KPressable key={r._id} onPress={() => setExpandedReview(isExpanded ? null : r._id)} style={styles.reviewCard}>
                    <KRow gap={10} align="center" style={styles.reviewHeader}>
                      {r.authorAvatarUrl ? (
                        <KImage source={{ uri: r.authorAvatarUrl }} style={styles.reviewAvatar} />
                      ) : (
                        <View style={[styles.reviewAvatar, styles.reviewAvatarPlaceholder]}>
                          <Ionicons name="person" size={13} color={colors.textTertiary} />
                        </View>
                      )}
                      <KVStack flex={1}>
                        <KText variant="label" bold>{r.authorName}</KText>
                        <KRow gap={6} align="center">
                          <KStarRating rating={r.averageRating} size={12} />
                          <KText variant="caption" color="textTertiary">
                            {new Date(r.createdAt).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                          </KText>
                        </KRow>
                      </KVStack>
                      <Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={16} color={colors.textTertiary} />
                    </KRow>

                    {r.vehicleTitle && (
                      <KRow gap={4} align="center" style={styles.reviewVehicleTag}>
                        <Ionicons name="car-outline" size={12} color={colors.textTertiary} />
                        <KText variant="caption" color="textTertiary">{r.vehicleTitle}</KText>
                      </KRow>
                    )}

                    {r.comment && (
                      <KText variant="body" style={styles.reviewComment}>{r.comment}</KText>
                    )}

                    {/* ── Détails des 4 catégories ── */}
                    {isExpanded && reviewRatings.length > 0 && (
                      <View style={styles.expandedRatings}>
                        {reviewRatings.map(([key, val]) => (
                          <KRow key={key} gap={8} align="center" style={{ paddingVertical: 4 }}>
                            <KText variant="caption" color="textSecondary" style={{ width: 100 }}>
                              {CRITERIA_LABELS[key] ?? key}
                            </KText>
                            <KStarRating rating={val as number} size={11} />
                            <KText variant="caption" bold>{val as number}/5</KText>
                          </KRow>
                        ))}
                      </View>
                    )}
                  </KPressable>
                );
              })}
            </View>
          )}

          {/* Empty state */}
          {(!reviews || reviews.length === 0) && (!vehicles || vehicles.length === 0) && (
            <KVStack align="center" gap={8} style={styles.emptyState}>
              <KText style={styles.emptyEmoji}>👋</KText>
              <KText variant="bodySmall" color="textSecondary" center>
                Ce membre n'a pas encore d'activité visible.
              </KText>
            </KVStack>
          )}

          {/* ── Report link ── */}
          <KPressable onPress={onReport} style={{
            marginTop: 24,
            flexDirection: "row", alignItems: "center", gap: 10,
            paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
            backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
            borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
          }}>
            <Ionicons name="flag-outline" size={18} color={colors.textTertiary} />
            <KVStack flex={1} gap={1}>
              <KText variant="bodySmall" color="textSecondary">Un problème avec ce profil ?</KText>
              <KText variant="caption" color="textTertiary">Signaler un comportement inapproprié</KText>
            </KVStack>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </KPressable>

        </View>
      </ScrollView>
    </>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  scroll: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingBottom: 60 },
  safeTop: {},

  // Header
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "center" },
  headerSpacer: { width: 36 },

  // Profile hero
  profileSection: { paddingTop: 12, paddingBottom: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44, overflow: "hidden" },
  avatarPlaceholder: {
    backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center",
  },
  statsRow: { marginTop: 8 },
  statDivider: { width: 1, height: 30, backgroundColor: colors.cardBorder },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 24 },
  sectionTitle: { marginBottom: 14 },

  // Reviews
  reviewCard: {
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  reviewHeader: { marginBottom: 8 },
  reviewAvatar: { width: 32, height: 32, borderRadius: 16, overflow: "hidden" },
  reviewAvatarPlaceholder: {
    backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center",
  },
  reviewVehicleTag: { marginBottom: 6 },
  reviewComment: { lineHeight: 20 },
  expandedRatings: {
    marginTop: 10, paddingTop: 10, paddingHorizontal: 4,
    borderTopWidth: 1, borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },

  // Empty
  emptyState: { paddingVertical: 40 },
  emptyEmoji: { fontSize: 36 },
}));
