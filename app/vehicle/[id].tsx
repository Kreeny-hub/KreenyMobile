import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Modal,
  StatusBar,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { trackView } from "../../src/lib/recentlyViewed";
import { ensureAuth } from "../../src/presentation/utils/ensureAuth";
import { useTheme, radius, haptic } from "../../src/theme";
import { KFavoriteButton } from "../../src/components/KFavoriteButton";

// UI Kit
import {
  KText,
  KRow,
  KVStack,
  KSpacer,
  KDivider,
  KPressable,
  KSection,
  KStickyCTA,
  KButton,
  KImage,
  KStarRating,
  createStyles,
} from "../../src/ui";

const { width: SW, height: SH } = Dimensions.get("window");
const HERO_H = SW * 0.72;

// ── Equipment data ──
const EQUIP_MAP: Record<string, { label: string; icon: string }> = {
  rear_camera: { label: "Caméra de recul", icon: "videocam-outline" },
  parking_sensors: { label: "Radar de recul", icon: "radio-outline" },
  blind_spot: { label: "Angles morts", icon: "eye-off-outline" },
  brake_assist: { label: "Freinage assisté", icon: "hand-left-outline" },
  carplay: { label: "Apple CarPlay", icon: "logo-apple" },
  android_auto: { label: "Android Auto", icon: "logo-google" },
  bluetooth: { label: "Bluetooth", icon: "bluetooth-outline" },
  usb_port: { label: "Port USB", icon: "flash-outline" },
  gps: { label: "GPS intégré", icon: "navigate-outline" },
  keyless: { label: "Accès sans clé", icon: "key-outline" },
  heated_seats: { label: "Sièges chauffants", icon: "sunny-outline" },
  pets_ok: { label: "Animaux acceptés", icon: "paw-outline" },
};
const TR: Record<string, string> = { auto: "Auto", manual: "Manuelle" };
const FL: Record<string, string> = { essence: "Essence", diesel: "Diesel", hybrid: "Hybride", electric: "Électrique" };

// ══════════════════════════════════════════════════════════
// Fullscreen Gallery Modal — Clean swipe + counter + haptic
// ══════════════════════════════════════════════════════════
function GalleryModal({ visible, images, initial, onClose }: { visible: boolean; images: string[]; initial: number; onClose: () => void }) {
  const [page, setPage] = useState(initial);
  useEffect(() => { if (visible) setPage(initial); }, [visible, initial]);

  return (
    <Modal visible={visible} animationType="fade" statusBarTranslucent transparent>
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar barStyle="light-content" />

        {/* Close */}
        <KPressable onPress={() => { haptic.light(); onClose(); }} style={galleryStyles.closeBtn}>
          <Ionicons name="close" size={20} color="#FFF" />
        </KPressable>

        {/* Counter */}
        <View style={galleryStyles.counterWrap}>
          <KText variant="label" style={{ color: "rgba(255,255,255,0.7)" }}>{page + 1} / {images.length}</KText>
        </View>

        {/* Swipeable images */}
        <FlatList
          data={images}
          horizontal pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initial}
          getItemLayout={(_, i) => ({ length: SW, offset: SW * i, index: i })}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => (
            <View style={{ width: SW, height: SH, justifyContent: "center", alignItems: "center" }}>
              <KImage source={{ uri: item }} style={{ width: SW, height: SW * 0.75 }} contentFit="contain" noPlaceholder />
            </View>
          )}
          onMomentumScrollEnd={(e) => {
            const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
            if (idx !== page) haptic.light();
            setPage(idx);
          }}
        />
      </View>
    </Modal>
  );
}

const galleryStyles = {
  closeBtn: { position: "absolute" as const, top: 54, left: 16, zIndex: 20, width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center" as const, justifyContent: "center" as const },
  counterWrap: { position: "absolute" as const, top: 58, right: 0, left: 0, zIndex: 20, alignItems: "center" as const },
};

// ══════════════════════════════════════════════════════════
// Tariff Row
// ══════════════════════════════════════════════════════════
function TariffRow({ label, value }: { label: string; value: string }) {
  return (
    <KRow justify="space-between" style={{ marginBottom: 12 }}>
      <KText variant="body" color="textSecondary">{label}</KText>
      <KText variant="body" bold>{value}</KText>
    </KRow>
  );
}

// ══════════════════════════════════════════════════════════
// Info Row (À savoir / Comment ça marche)
// ══════════════════════════════════════════════════════════
function InfoRow({ icon, title, desc, badge }: { icon: string; title: string; desc: string; badge?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <KRow gap={14} align="flex-start" style={{ marginBottom: 18 }}>
      {badge || <Ionicons name={icon as any} size={22} color={colors.text} style={{ marginTop: 1 }} />}
      <KVStack flex={1}>
        <KText variant="label">{title}</KText>
        <KText variant="bodySmall" color="textSecondary" style={{ marginTop: 2, lineHeight: 18 }}>{desc}</KText>
      </KVStack>
    </KRow>
  );
}

// ══════════════════════════════════════════════════════════
// Trust Bar (confiance visuelle — subtle inline)
// ══════════════════════════════════════════════════════════
function TrustBar() {
  const { styles: ts, colors } = useTrustStyles();
  return (
    <View style={ts.trustWrap}>
      {[
        { icon: "shield-checkmark-outline", label: "Identité vérifiée" },
        { icon: "umbrella-outline", label: "Assurance incluse" },
        { icon: "refresh-outline", label: "Annulation flexible" },
      ].map((t, i) => (
        <KRow key={t.label} gap={8} style={[ts.trustItem, i > 0 && ts.trustItemBorder]}>
          <Ionicons name={t.icon as any} size={15} color={colors.primary} />
          <KText variant="bodySmall" style={{ color: colors.textSecondary }}>{t.label}</KText>
        </KRow>
      ))}
    </View>
  );
}

const useTrustStyles = createStyles((colors, isDark) => ({
  trustWrap: {
    paddingVertical: 4,
  },
  trustItem: {
    alignItems: "center", paddingVertical: 8,
  },
  trustItemBorder: {
    borderTopWidth: 1,
    borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
}));

// ══════════════════════════════════════════════════════════
// Owner Section (with verified badge + response info)
// ══════════════════════════════════════════════════════════
function OwnerSection({ ownerUserId }: { ownerUserId?: string }) {
  const { styles, colors, isDark } = useOwnerStyles();
  const profile = useQuery(api.userProfiles.getProfileByUserId, ownerUserId ? { userId: ownerUserId } : "skip");
  const avatarUrl = useQuery(api.files.getUrl, profile?.avatarStorageId ? { storageId: profile.avatarStorageId } : "skip");
  const ownerStats = useQuery(api.reviews.getStatsForUser, ownerUserId ? { userId: ownerUserId } : "skip");

  if (!ownerUserId || profile === undefined) return null;

  const firstName = (profile?.displayName || "").split(" ")[0] || "Votre hôte";
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
    : null;

  const goToProfile = () => router.push({ pathname: "/profile/[userId]", params: { userId: ownerUserId } });

  return (
    <KVStack gap={14}>
      <KRow gap={14}>
        {/* Avatar + verified badge */}
        <KPressable onPress={goToProfile} style={styles.avatarWrap}>
          {avatarUrl ? (
            <KImage source={{ uri: avatarUrl }} style={styles.ownerAvatar} />
          ) : (
            <View style={[styles.ownerAvatar, styles.ownerAvatarPlaceholder]}>
              <Ionicons name="person" size={22} color={isDark ? colors.textTertiary : "#94A3B8"} />
            </View>
          )}
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark" size={10} color="#FFF" />
          </View>
        </KPressable>

        <KVStack flex={1}>
          <KPressable onPress={goToProfile}>
            <KText variant="h3" bold>{firstName}</KText>
          </KPressable>
          {memberSince && <KText variant="bodySmall" color="textSecondary" style={styles.memberSince}>Membre depuis {memberSince}</KText>}
        </KVStack>
        <KPressable style={styles.chatBtn}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.text} />
        </KPressable>
      </KRow>

      {/* Owner trust metrics — fully dynamic */}
      <KPressable onPress={goToProfile} style={styles.ownerMetrics}>
        {ownerStats && ownerStats.count > 0 ? (
          <KRow gap={6} align="center">
            <Ionicons name="star" size={14} color="#F59E0B" />
            <KText variant="labelSmall" bold>{ownerStats.average}</KText>
            <KText variant="caption" color="textTertiary">({ownerStats.count} avis)</KText>
          </KRow>
        ) : (
          <KRow gap={6} align="center">
            <Ionicons name="star-outline" size={14} color={colors.textTertiary} />
            <KText variant="caption" color="textTertiary">Pas encore d'avis</KText>
          </KRow>
        )}
      </KPressable>
    </KVStack>
  );
}

const useOwnerStyles = createStyles((colors, isDark) => ({
  ownerAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.bgTertiary },
  ownerAvatarPlaceholder: {
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center", justifyContent: "center",
  },
  avatarWrap: { position: "relative" },
  verifiedBadge: {
    position: "absolute", bottom: -1, right: -1,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#10B981",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: isDark ? colors.bg : "#FFF",
  },
  memberSince: { marginTop: 2 },
  chatBtn: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1.5, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  ownerMetrics: {
    flexDirection: "row",
    paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: isDark ? colors.bgTertiary : "#F8F9FB",
    borderRadius: 12, alignItems: "center",
  },
}));

// ══════════════════════════════════════════════════════════
// Loading Skeleton
// ══════════════════════════════════════════════════════════
function DetailSkeleton() {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
    ])).start();
    return () => pulse.stopAnimation();
  }, []);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const B = ({ w, h, r = 8, style }: any) => <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <B w={SW} h={HERO_H} r={0} />
      <View style={{ padding: 20, gap: 14 }}>
        <B w="70%" h={26} /><B w="40%" h={20} /><B w="55%" h={16} />
        <B w="100%" h={1} style={{ marginVertical: 8 }} />
        <KRow gap="md">{[0,1,2,3].map(i => <B key={i} w={(SW-64)/4} h={60} r={12} />)}</KRow>
        <B w="100%" h={1} style={{ marginVertical: 8 }} />
        <B w="100%" h={80} r={14} />
      </View>
    </View>
  );
}

// ══════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════
export default function VehicleDetails() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isAuthenticated, session } = useAuthStatus();

  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [photoPage, setPhotoPage] = useState(0);
  const [descExpanded, setDescExpanded] = useState(false);
  const [equipExpanded, setEquipExpanded] = useState(false);

  const vehicle = useQuery(api.vehicles.getVehicleWithImages, id ? { id: id as any } : "skip");
  const vehicleReviews = useQuery(api.reviews.getForVehicle, id ? { vehicleId: id as any } : "skip");
  const reviewStats = useQuery(api.reviews.getStatsForVehicle, id ? { vehicleId: id as any } : "skip");

  // Track recently viewed
  useEffect(() => {
    if (id && vehicle) trackView(id);
  }, [id, vehicle]);

  // ── Empty / Loading states ──
  if (!id) return (
    <View style={styles.centered}>
      <Stack.Screen options={{ headerShown: false }} />
      <KText color="textSecondary">Véhicule introuvable</KText>
    </View>
  );

  if (vehicle === undefined) return <><Stack.Screen options={{ headerShown: false }} /><DetailSkeleton /></>;

  if (vehicle === null) return (
    <View style={[styles.centered, { gap: 12 }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
      <KText variant="h3" bold>Annonce introuvable</KText>
      <KPressable onPress={() => router.back()}>
        <KText variant="label" color="primary">Retour</KText>
      </KPressable>
    </View>
  );

  // ── Data ──
  const images = vehicle.resolvedImageUrls;
  const price = vehicle.pricePerDay;
  const deposit = vehicle.depositSelected || 0;
  const brand = vehicle.brand || "";
  const model = vehicle.model || "";
  const year = vehicle.year ? String(vehicle.year) : "";
  const transmission = vehicle.transmission || "";
  const fuel = vehicle.fuel || "";
  const seats = vehicle.seats || 0;
  const description = (vehicle.description || "").trim();
  const allEquipKeys = [...(vehicle.featuresSafety || []), ...(vehicle.featuresConnect || []), ...(vehicle.featuresAmenities || [])];
  const deliveryEnabled = Boolean(vehicle.delivery);
  const deliveryRadius = vehicle.deliveryRadiusKm ?? null;
  const deliveryPrice = vehicle.deliveryPrice ?? null;
  const displayTitle = vehicle.title || [brand, model, year].filter(Boolean).join(" ") || "Véhicule";

  const stats = [
    year ? { icon: "calendar-outline", val: year, lbl: "Année" } : null,
    transmission ? { icon: "swap-horizontal-outline", val: TR[transmission] || transmission, lbl: "Transmission" } : null,
    fuel ? { icon: "flash-outline", val: FL[fuel] || fuel, lbl: "Carburant" } : null,
    seats > 0 ? { icon: "people-outline", val: `${seats}`, lbl: "Places" } : null,
  ].filter(Boolean) as { icon: string; val: string; lbl: string }[];

  const onReserve = () => {
    haptic.medium();
    if (!ensureAuth(isAuthenticated)) return;
    router.push(`/reservation/${id}`);
  };

  const isOwner = !!(vehicle as any).isOwner;
  const onEdit = () => {
    haptic.medium();
    router.push(`/profile/edit-vehicle/${id}`);
  };

  const onReport = () => {
    if (!ensureAuth(isAuthenticated)) return;
    const label = `${brand} ${model}${year ? ` ${year}` : ""}`.trim();
    router.push({ pathname: "/report/[targetId]", params: { targetId: id!, targetType: "vehicle", targetLabel: label } });
  };

  const openGallery = (idx: number) => { setGalleryIdx(idx); setGalleryOpen(true); };

  const DESC_LIMIT = 120;
  const needsExpand = description.length > DESC_LIMIT;
  const shownDesc = descExpanded || !needsExpand ? description : description.slice(0, DESC_LIMIT) + "…";

  const bottomPad = Math.max(insets.bottom, 12) + 90;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      <FlatList
        data={[1]}
        renderItem={() => null}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        ListHeaderComponent={
          <>
            {/* ════════════════════════════════════ */}
            {/* HERO PHOTOS                         */}
            {/* ════════════════════════════════════ */}
            <View style={{ position: "relative" }}>
              {images.length > 0 ? (
                <FlatList
                  data={images}
                  horizontal pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  keyExtractor={(_, i) => String(i)}
                  renderItem={({ item, index }) => (
                    <KPressable onPress={() => openGallery(index)} activeOpacity={0.9}>
                      <KImage source={{ uri: item }} style={{ width: SW, height: HERO_H, backgroundColor: colors.bgTertiary }} />
                    </KPressable>
                  )}
                  onMomentumScrollEnd={(e) => {
                    const idx = Math.round(e.nativeEvent.contentOffset.x / SW);
                    if (idx !== photoPage) haptic.light();
                    setPhotoPage(idx);
                  }}
                />
              ) : (
                <KVStack align="center" justify="center" gap="sm" style={styles.noPhotos}>
                  <Ionicons name="camera-outline" size={32} color={isDark ? colors.textTertiary : "#94A3B8"} />
                  <KText variant="label" color={isDark ? "textTertiary" : "#94A3B8"}>Photos bientôt disponibles</KText>
                </KVStack>
              )}

              {/* Overlay: back */}
              <KPressable onPress={() => router.back()} style={[styles.overlayBtn, { top: insets.top + 8, left: 14 }]}>
                <Ionicons name="chevron-back" size={20} color="#222" />
              </KPressable>

              {/* Overlay: heart */}
              {id && (
                <View style={{ position: "absolute", top: insets.top + 8, right: 14 }}>
                  <KFavoriteButton vehicleId={id} size={18} variant="overlay" />
                </View>
              )}

              {/* Pagination: dots only (≤5) or counter only (>5) */}
              {images.length > 1 && (
                images.length <= 5 ? (
                  <KRow justify="center" gap={5} style={{ position: "absolute", bottom: 14, left: 0, right: 0 }}>
                    {images.map((_, i) => (
                      <View key={i} style={[styles.dot, i === photoPage && styles.dotActive]} />
                    ))}
                  </KRow>
                ) : (
                  <View style={styles.photoCounter}>
                    <KText variant="labelSmall" color="#FFF">{photoPage + 1} / {images.length}</KText>
                  </View>
                )
              )}
            </View>

            {/* ════════════════════════════════════ */}
            {/* CONTENT                             */}
            {/* ════════════════════════════════════ */}
            <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

              {/* ── Title + city ── */}
              <KText variant="displayMedium" style={{ lineHeight: 30, letterSpacing: -0.4 }}>
                {displayTitle}
              </KText>
              <KRow gap={6} style={{ marginTop: 8 }}>
                <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                <KText variant="label" color="textSecondary" style={{ fontSize: 14 }}>{vehicle.city || "—"}</KText>
                {reviewStats && reviewStats.count > 0 && (
                  <>
                    <KText variant="caption" color="textTertiary">•</KText>
                    <Ionicons name="star" size={13} color="#F59E0B" />
                    <KText variant="label" bold style={{ fontSize: 13 }}>{reviewStats.average}</KText>
                    <KText variant="caption" color="textTertiary">({reviewStats.count} avis)</KText>
                  </>
                )}
              </KRow>

              {/* ── Horizontal stats ── */}
              {stats.length > 0 && (
                <>
                  <KDivider style={{ marginVertical: 22 }} />
                  <KRow style={styles.statsRow}>
                    {stats.map((s, i) => (
                      <KVStack key={s.lbl} align="center" py="md" style={[
                        { flex: 1 },
                        i < stats.length - 1 && styles.statCell,
                      ]}>
                        <Ionicons name={s.icon as any} size={18} color={colors.primary} />
                        <KText variant="labelSmall" bold style={{ marginTop: 6 }} numberOfLines={1}>{s.val}</KText>
                        <KText variant="caption" color="textTertiary" style={{ marginTop: 2, fontSize: 10 }}>{s.lbl}</KText>
                      </KVStack>
                    ))}
                  </KRow>
                </>
              )}

              {/* ── Owner (high in hierarchy = trust first) ── */}
              <KDivider style={{ marginVertical: 22 }} />
              <OwnerSection ownerUserId={vehicle.ownerUserId} />

              {/* ── Description (right after owner = context) ── */}
              {description.length > 0 && (
                <>
                  <KDivider style={{ marginVertical: 22 }} />
                  <KText variant="body" style={{ lineHeight: 23 }}>{shownDesc}</KText>
                  {needsExpand && (
                    <KPressable onPress={() => setDescExpanded(!descExpanded)} style={{ marginTop: 10 }}>
                      <KText variant="label" style={{ textDecorationLine: "underline" }}>
                        {descExpanded ? "Afficher moins" : "Lire la suite"}
                      </KText>
                    </KPressable>
                  )}
                </>
              )}

              {/* ── Trust (subtle inline) ── */}
              <KDivider style={{ marginVertical: 22 }} />
              <TrustBar />

              {/* ── Équipements (max 4 + voir plus) ── */}
              {allEquipKeys.length > 0 && (
                <>
                  <KDivider style={{ marginVertical: 22 }} />
                  <KText variant="h2" bold style={{ marginBottom: 14 }}>Ce que propose ce véhicule</KText>

                  <KVStack gap={2}>
                    {(equipExpanded ? allEquipKeys : allEquipKeys.slice(0, 4)).map((key: string) => {
                      const info = EQUIP_MAP[key];
                      if (!info) return null;
                      return (
                        <KRow key={key} gap={14} py="md" style={styles.equipRow}>
                          <Ionicons name={info.icon as any} size={22} color={colors.text} />
                          <KText variant="body">{info.label}</KText>
                        </KRow>
                      );
                    })}
                  </KVStack>

                  {allEquipKeys.length > 4 && !equipExpanded && (
                    <KPressable onPress={() => setEquipExpanded(true)} style={{ marginTop: 12 }}>
                      <KText variant="label" bold style={{ textDecorationLine: "underline" }}>
                        Voir les {allEquipKeys.length} équipements
                      </KText>
                    </KPressable>
                  )}
                </>
              )}

              {/* ── Avis ── */}
              {vehicleReviews && vehicleReviews.length > 0 && (
                <>
                  <KDivider style={{ marginVertical: 22 }} />
                  <KText variant="h2" bold style={{ marginBottom: 16 }}>Avis</KText>

                  {/* Summary card with criteria bars */}
                  {reviewStats && reviewStats.count > 0 && (
                    <View style={styles.reviewSummary}>
                      <KRow gap={16} align="center">
                        <KVStack align="center" gap={2}>
                          <KText style={{ fontSize: 34, lineHeight: 42, fontWeight: "900", color: colors.text }}>{reviewStats.average}</KText>
                          <KStarRating rating={reviewStats.average} size={14} />
                          <KText variant="caption" color="textTertiary" style={{ marginTop: 2 }}>{reviewStats.count} avis</KText>
                        </KVStack>
                        <KVStack gap={8} style={{ flex: 1 }}>
                          {[
                            { key: "communication", label: "Communication" },
                            { key: "conformity", label: "Conformité" },
                            { key: "cleanliness", label: "Propreté" },
                            { key: "punctuality", label: "Ponctualité" },
                          ].map((c) => {
                            const val = reviewStats.criteria?.[c.key] ?? 0;
                            return (
                              <KRow key={c.key} gap={8} align="center">
                                <KText variant="caption" color="textSecondary" style={{ width: 90 }}>{c.label}</KText>
                                <View style={styles.criteriaBarBg}>
                                  <View style={[styles.criteriaBarFill, { width: `${(val / 5) * 100}%` }]} />
                                </View>
                                <KText variant="caption" bold style={{ width: 22, textAlign: "right" }}>{val || "–"}</KText>
                              </KRow>
                            );
                          })}
                        </KVStack>
                      </KRow>
                    </View>
                  )}

                  {/* Review cards */}
                  {vehicleReviews.slice(0, 3).map((review: any) => (
                    <View key={review._id} style={styles.reviewCard}>
                      <KRow gap={10} align="center" style={{ marginBottom: 8 }}>
                        {review.authorAvatarUrl ? (
                          <KImage source={{ uri: review.authorAvatarUrl }} style={styles.reviewAvatar} />
                        ) : (
                          <View style={[styles.reviewAvatar, { backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center" }]}>
                            <Ionicons name="person" size={14} color={colors.textTertiary} />
                          </View>
                        )}
                        <KVStack style={{ flex: 1 }}>
                          <KText variant="label" bold>{review.authorName}</KText>
                          <KRow gap={6} align="center">
                            <KStarRating rating={review.averageRating} size={12} />
                            <KText variant="caption" color="textTertiary">
                              {new Date(review.createdAt).toLocaleDateString("fr-FR", { month: "short", year: "numeric" })}
                            </KText>
                          </KRow>
                        </KVStack>
                      </KRow>
                      {review.comment && (
                        <KText variant="body" style={{ lineHeight: 20 }}>{review.comment}</KText>
                      )}
                    </View>
                  ))}
                  {vehicleReviews.length > 3 && (
                    <KPressable style={{ marginTop: 8, alignSelf: "flex-start" }}>
                      <KText variant="bodySmall" bold style={{ color: colors.primary, textDecorationLine: "underline" }}>
                        Voir les {vehicleReviews.length} avis
                      </KText>
                    </KPressable>
                  )}
                </>
              )}

              {/* ── Tarif / Caution ── */}
              {deposit > 0 && (
                <>
                  <KDivider style={{ marginVertical: 22 }} />
                  <View style={styles.depositCard}>
                    <KRow gap={12} align="flex-start">
                      <View style={styles.depositIcon}>
                        <Ionicons name="shield-checkmark" size={18} color="#10B981" />
                      </View>
                      <KVStack flex={1} gap={4}>
                        <KText variant="label" bold>Caution de {deposit.toLocaleString("fr-FR")} MAD</KText>
                        <KText variant="bodySmall" color="textSecondary" style={{ lineHeight: 19 }}>
                          Simple empreinte bancaire, jamais débitée. Libérée automatiquement après restitution du véhicule.
                        </KText>
                        {vehicle.depositMin && vehicle.depositMax && vehicle.depositMin !== vehicle.depositMax && (
                          <KText variant="caption" color="textTertiary" style={{ marginTop: 2 }}>
                            Peut varier de {vehicle.depositMin.toLocaleString("fr-FR")} à {vehicle.depositMax.toLocaleString("fr-FR")} MAD selon les options
                          </KText>
                        )}
                      </KVStack>
                    </KRow>
                  </View>
                </>
              )}

              {/* ── Livraison ── */}
              <KDivider style={{ marginVertical: 22 }} />
              <KText variant="h2" bold style={{ marginBottom: 14 }}>Livraison</KText>

              {deliveryEnabled ? (
                <KVStack gap="sm">
                  <KRow gap="sm">
                    <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    <KText variant="label">Livraison disponible</KText>
                  </KRow>
                  {deliveryRadius != null && deliveryRadius > 0 && (
                    <TariffRow label="Rayon" value={`${deliveryRadius} km`} />
                  )}
                  {deliveryPrice != null && deliveryPrice > 0 && (
                    <TariffRow label="Frais de livraison" value={`${deliveryPrice} MAD`} />
                  )}
                </KVStack>
              ) : (
                <KRow gap="sm">
                  <Ionicons name="close-circle-outline" size={20} color={colors.textTertiary} />
                  <KText variant="body" color="textSecondary">Le véhicule doit être récupéré sur place</KText>
                </KRow>
              )}

              {/* ── Politique d'annulation ── */}
              <KDivider style={{ marginVertical: 22 }} />
              <KText variant="h2" bold style={{ marginBottom: 14 }}>Annulation</KText>
              {(() => {
                const POLICY_MAP: Record<string, { label: string; icon: string; color: string; rules: string[] }> = {
                  flexible: { label: "Flexible", icon: "shield-checkmark-outline", color: "#10B981", rules: ["Gratuit jusqu'à 24h avant le départ", "Moins de 24h : remboursement de 50%"] },
                  moderate: { label: "Modérée", icon: "shield-half-outline", color: "#F59E0B", rules: ["Gratuit jusqu'à 3 jours avant", "3j → 24h : remboursement de 50%", "Moins de 24h : aucun remboursement"] },
                  strict: { label: "Stricte", icon: "lock-closed-outline", color: "#EF4444", rules: ["Gratuit jusqu'à 7 jours avant", "7j → 3j : remboursement de 50%", "Moins de 3 jours : aucun remboursement"] },
                };
                const pol = POLICY_MAP[(vehicle as any).cancellationPolicy ?? "moderate"] ?? POLICY_MAP.moderate;
                return (
                  <View style={[styles.depositCard, { borderLeftWidth: 3, borderLeftColor: pol.color }]}>
                    <KRow gap="sm" style={{ alignItems: "center", marginBottom: 10 }}>
                      <Ionicons name={pol.icon as any} size={18} color={pol.color} />
                      <KText variant="label" bold>Politique {pol.label}</KText>
                    </KRow>
                    <KVStack gap={6}>
                      {pol.rules.map((rule: string, i: number) => (
                        <KRow key={i} gap={8} style={{ alignItems: "flex-start" }}>
                          <KText variant="caption" color="textTertiary" style={{ marginTop: 1 }}>•</KText>
                          <KText variant="bodySmall" color="textSecondary" style={{ flex: 1 }}>{rule}</KText>
                        </KRow>
                      ))}
                    </KVStack>
                  </View>
                );
              })()}

              {/* ── À savoir ── */}
              <KDivider style={{ marginVertical: 22 }} />
              <KText variant="h2" bold style={{ marginBottom: 14 }}>À savoir</KText>

              <InfoRow icon="sparkles-outline" title="Propreté" desc="Rendre le véhicule propre à la restitution" />
              <InfoRow icon="water-outline" title="Carburant" desc="Même niveau de carburant qu'au départ" />
              <InfoRow icon="time-outline" title="Ponctualité" desc="Prévenir en cas de retard" />
              <InfoRow icon="ban-outline" title="Sous-location" desc="Interdite — usage personnel uniquement" />

              {/* ── Comment ça marche ── */}
              <KDivider style={{ marginVertical: 22 }} />
              <KText variant="h2" bold style={{ marginBottom: 14 }}>Comment ça marche</KText>

              {[
                { n: "1", title: "Réservez", desc: "Choisissez vos dates et envoyez une demande" },
                { n: "2", title: "Payez en ligne", desc: "Paiement sécurisé, caution non débitée" },
                { n: "3", title: "Constat départ", desc: "Photos du véhicule validées par les 2 parties" },
                { n: "4", title: "Profitez !", desc: "Le véhicule est à vous pour la durée convenue" },
              ].map((s) => (
                <InfoRow key={s.n} icon="" title={s.title} desc={s.desc} badge={
                  <View style={styles.stepBadge}>
                    <KText variant="labelSmall" bold color="primary">{s.n}</KText>
                  </View>
                } />
              ))}

              {/* ── Footer hint ── */}
              <KRow gap="sm" style={{ marginTop: 6 }}>
                <Ionicons name="shield-checkmark-outline" size={16} color={colors.textTertiary} />
                <KText variant="caption" color="textTertiary" style={{ flex: 1, lineHeight: 17 }}>
                  Échangez via la messagerie intégrée et effectuez le paiement via la plateforme pour être protégé.
                </KText>
              </KRow>

              {/* ── Report link ── */}
              {!isOwner && (
                <KPressable onPress={onReport} style={{
                  marginTop: 20,
                  flexDirection: "row", alignItems: "center", gap: 10,
                  paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
                  backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "#F9FAFB",
                  borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
                }}>
                  <Ionicons name="flag-outline" size={18} color={colors.textTertiary} />
                  <KVStack flex={1} gap={1}>
                    <KText variant="bodySmall" color="textSecondary">Un problème avec cette annonce ?</KText>
                    <KText variant="caption" color="textTertiary">Signaler un contenu inapproprié</KText>
                  </KVStack>
                  <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
                </KPressable>
              )}
            </View>
          </>
        }
      />

      {/* ════════════════════════════════════ */}
      {/* STICKY BOOKING BAR                  */}
      {/* ════════════════════════════════════ */}
      <KStickyCTA>
        <KRow gap="lg" align="center">
          <KVStack flex={1}>
            <KText variant="priceSmall">
              {price} MAD <KText variant="bodySmall" color="textSecondary">/ jour</KText>
            </KText>
            <KRow gap={4} style={{ alignItems: "center", marginTop: 3 }}>
              <Ionicons name="shield-checkmark" size={10} color="#10B981" />
              <KText variant="caption" color="textTertiary" style={{ fontSize: 10 }}>
                {isOwner ? "Annulation modérée • Caution auto" : "Paiement sécurisé • Annulation modérée"}
              </KText>
            </KRow>
          </KVStack>
          <KButton title={isOwner ? "Modifier" : "Réserver"} onPress={isOwner ? onEdit : onReserve} fullWidth={false} size="md" />
        </KRow>
      </KStickyCTA>

      {/* ════════════════════════════════════ */}
      {/* FULLSCREEN GALLERY                  */}
      {/* ════════════════════════════════════ */}
      <GalleryModal visible={galleryOpen} images={images} initial={galleryIdx} onClose={() => setGalleryOpen(false)} />
    </View>
  );
}

// ══════════════════════════════════════════════════════════
// STYLES
// ══════════════════════════════════════════════════════════
const useStyles = createStyles((colors, isDark) => ({
  centered: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: "center", justifyContent: "center",
  },
  noPhotos: {
    width: SW, height: HERO_H * 0.65,
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
  },
  overlayBtn: {
    position: "absolute", zIndex: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center", justifyContent: "center",
    ...(isDark ? {} : {
      shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08, shadowRadius: 4,
    }),
  },
  photoCounter: {
    position: "absolute", bottom: 14, right: 16,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.4)" },
  dotActive: { backgroundColor: "#FFF" },
  statsRow: {
    borderRadius: 16, overflow: "hidden",
    backgroundColor: isDark ? colors.bgTertiary : "#F8F9FB",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  statCell: {
    borderRightWidth: 1,
    borderRightColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  equipRow: {
    borderBottomWidth: 1,
    borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  depositCard: {
    marginTop: 12, borderRadius: 16, padding: 16,
    backgroundColor: isDark ? "rgba(16,185,129,0.06)" : "#F0FDF4",
    borderWidth: 1, borderColor: isDark ? "rgba(16,185,129,0.12)" : "rgba(16,185,129,0.1)",
  },
  depositIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#DCFCE7",
    alignItems: "center", justifyContent: "center",
  },
  stepBadge: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center", justifyContent: "center",
  },
  reviewSummary: {
    backgroundColor: isDark ? colors.bgTertiary : "#F9FAFB",
    borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  criteriaBarBg: {
    flex: 1, height: 5, borderRadius: 3,
    backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
  },
  criteriaBarFill: {
    height: "100%", borderRadius: 3, backgroundColor: "#F59E0B",
  },
  reviewCard: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
  },
  reviewAvatar: {
    width: 32, height: 32, borderRadius: 16,
  },
}));
