import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  Animated,
  Dimensions,
  FlatList,
  ImageBackground,
  RefreshControl,
  ScrollView,
  View,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTheme, shadows, motion, duration, skeletonPulse, staggeredEntrance, fadeUpStyle, pulseOpacity } from "../../src/theme";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { KFavoriteButton } from "../../src/components/KFavoriteButton";
import { getRecentlyViewed } from "../../src/lib/recentlyViewed";

import {
  KScreen,
  KText,
  KRow,
  KVStack,
  KPressable,
  KCard,
  KButton,
  KImage,
  createStyles,
} from "../../src/ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ═══════════════════════════════════════════════════════
// Search Bar (fake -> redirect to Search tab)
// ═══════════════════════════════════════════════════════
function SearchBar() {
  const { styles, colors } = useSearchBarStyles();
  return (
    <KPressable onPress={() => router.push("/search-wizard")} activeOpacity={0.9} style={styles.bar}>
      <View style={styles.iconCircle}>
        <Ionicons name="search" size={16} color="#FFF" />
      </View>
      <KVStack flex={1}>
        <KText variant="label" style={{ fontSize: 14 }}>Trouver une voiture</KText>
        <KText variant="caption" color="textSecondary" style={{ marginTop: 1 }}>Toutes villes • Dates flexibles</KText>
      </KVStack>
      <Ionicons name="options-outline" size={18} color={colors.textTertiary} />
    </KPressable>
  );
}
const useSearchBarStyles = createStyles((colors, isDark) => ({
  bar: {
    marginHorizontal: 18, marginTop: 10, flexDirection: "row", alignItems: "center",
    backgroundColor: isDark ? colors.bgTertiary : colors.card,
    borderRadius: 9999, paddingHorizontal: 16, paddingVertical: 12, gap: 10,
    borderWidth: isDark ? 0 : 1, borderColor: isDark ? "transparent" : colors.borderLight,
    ...(isDark ? {} : shadows.md),
  },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
  },
}));

// ═══════════════════════════════════════════════════════
// Trust Tagline (below search bar)
// ═══════════════════════════════════════════════════════
function TrustTagline() {
  const { colors } = useTheme();
  return (
    <KRow justify="center" gap={14} style={{ marginTop: 28, marginBottom: 8, paddingHorizontal: 18, opacity: 0.5 }}>
      {[
        { icon: "shield-checkmark-outline", label: "Vérifié" },
        { icon: "card-outline", label: "Paiement sécurisé" },
        { icon: "chatbubbles-outline", label: "Support 7j/7" },
      ].map((t) => (
        <KRow key={t.label} gap={4} style={{ alignItems: "center" }}>
          <Ionicons name={t.icon as any} size={11} color={colors.textTertiary} />
          <KText variant="caption" color="textTertiary" style={{ fontSize: 10 }}>{t.label}</KText>
        </KRow>
      ))}
    </KRow>
  );
}

// ═══════════════════════════════════════════════════════
// Active Trip Banner (shows when user has active reservation)
// ═══════════════════════════════════════════════════════
function ActiveTripBanner() {
  const { isAuthenticated } = useAuthStatus();
  const myReservations = useQuery(
    api.reservations.listMyReservations,
    isAuthenticated ? {} : "skip"
  );
  const { styles: bs, colors } = useBannerStyles();

  const activeRes = useMemo(() => {
    if (!myReservations?.length) return null;
    return myReservations.find((r: any) =>
      ["ACCEPTED", "PAID", "ACTIVE", "RETURN_PENDING"].includes(r.status)
    ) || null;
  }, [myReservations]);

  if (!activeRes) return null;

  const STATUS_LABELS: Record<string, { label: string; icon: string }> = {
    ACCEPTED: { label: "En attente de paiement", icon: "card-outline" },
    PAID: { label: "Paiement confirmé — Constat départ à faire", icon: "camera-outline" },
    ACTIVE: { label: "Location en cours", icon: "car-sport" },
    RETURN_PENDING: { label: "Retour en attente — Constat retour à faire", icon: "flag-outline" },
  };
  const info = STATUS_LABELS[activeRes.status] || { label: activeRes.status, icon: "ellipse-outline" };

  return (
    <KPressable onPress={() => router.push("/profile/reservations")} style={bs.banner}>
      <KRow gap={10} style={{ alignItems: "center" }}>
        <View style={bs.iconCircle}>
          <Ionicons name={info.icon as any} size={16} color="#FFF" />
        </View>
        <KVStack flex={1}>
          <KText variant="labelSmall" bold style={{ color: "#FFF" }}>Réservation en cours</KText>
          <KText variant="caption" style={{ color: "rgba(255,255,255,0.85)", marginTop: 1 }}>{info.label}</KText>
        </KVStack>
        <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.7)" />
      </KRow>
    </KPressable>
  );
}
const useBannerStyles = createStyles((colors) => ({
  banner: {
    marginHorizontal: 18, marginTop: 12,
    backgroundColor: colors.primary,
    borderRadius: 14, padding: 12,
  },
  iconCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
}));

// ═══════════════════════════════════════════════════════
// Section Header
// ═══════════════════════════════════════════════════════
function SectionHeader({ title, subtitle, showAll }: { title: string; subtitle: string; showAll?: boolean }) {
  return (
    <KRow px="lg" style={{ marginBottom: 12 }} justify="space-between" align="flex-end">
      <KVStack>
        <KText variant="h2" bold>{title}</KText>
        <KText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>{subtitle}</KText>
      </KVStack>
      {showAll && (
        <KPressable onPress={() => router.push("/(tabs)/search")}>
          <KText variant="labelSmall" color="primary" bold>Tout voir</KText>
        </KPressable>
      )}
    </KRow>
  );
}

// ═══════════════════════════════════════════════════════
// Hero Carousel
// ═══════════════════════════════════════════════════════
function HeroCarousel({ vehicles }: { vehicles: any[] }) {
  const { styles, colors, isDark } = useHeroStyles();
  const [currentIndex, setCurrentIndex] = useState(0);
  const cardWidth = Math.min(SCREEN_WIDTH - 36, 380);
  const cardHeight = 220;
  const snapInterval = cardWidth + 14;

  if (vehicles.length === 0) return null;

  return (
    <View style={{ marginTop: 14 }}>
      <SectionHeader title="À la une" subtitle="Découvrez une sélection premium" showAll />

      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={vehicles} keyExtractor={(item) => item._id}
        snapToInterval={snapInterval} decelerationRate="fast"
        contentContainerStyle={{ paddingLeft: 18, paddingRight: 4 }}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
          if (idx !== currentIndex) setCurrentIndex(idx);
        }}
        scrollEventThrottle={16}
        renderItem={({ item }) => {
          if (!item.coverUrl) {
            return (
              <KPressable onPress={() => router.push(`/vehicle/${item._id}`)}
                style={[styles.heroCard, { width: cardWidth, height: cardHeight, backgroundColor: colors.bgTertiary, justifyContent: "flex-end" }]}>
                <KVStack align="center" justify="center" style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
                  <Ionicons name="car-sport-outline" size={48} color={colors.textTertiary} />
                </KVStack>
                <View style={{ padding: 14 }}>
                  <KText variant="h2" bold numberOfLines={1}>{item.title}</KText>
                  <KText variant="caption" color="textSecondary" style={{ marginTop: 4 }}>{item.city || "Toutes villes"}</KText>
                  <KText variant="h2" bold style={{ marginTop: 6 }}>
                    {item.pricePerDay} MAD <KText variant="caption" color="textSecondary">/jour</KText>
                  </KText>
                </View>
              </KPressable>
            );
          }

          return (
            <KPressable onPress={() => router.push(`/vehicle/${item._id}`)}
              style={[styles.heroCard, { width: cardWidth, height: cardHeight }]}>
              <ImageBackground source={{ uri: item.coverUrl }} style={{ flex: 1, justifyContent: "flex-end" }} imageStyle={{ borderRadius: 22 }}>
                <View style={styles.heroOverlay} />
                {item.reviewCount > 0 && (
                  <KRow gap={4} align="center" style={styles.ratingBadge}>
                    <Ionicons name="star" size={12} color="#F59E0B" />
                    <KText variant="caption" bold color="#fff">{item.reviewAverage}</KText>
                  </KRow>
                )}
                {item.imageUrls?.length > 1 && (
                  <KRow gap={5} style={styles.photoBadge}>
                    <Ionicons name="images-outline" size={13} color="#fff" />
                    <KText variant="labelSmall" color="#fff">{item.imageUrls.length}</KText>
                  </KRow>
                )}
                <View style={{ padding: 14 }}>
                  <KText variant="h2" bold color="#fff" numberOfLines={1}>{item.title}</KText>
                  <KRow justify="space-between" align="center" style={{ marginTop: 4 }}>
                    <KText variant="caption" color="rgba(255,255,255,0.9)" bold>{item.city || "Toutes villes"}</KText>
                  </KRow>
                  <KText variant="h2" bold color="#fff" style={{ marginTop: 6 }}>
                    {item.pricePerDay} MAD <KText variant="caption" color="rgba(255,255,255,0.85)">/jour</KText>
                  </KText>
                </View>
              </ImageBackground>
            </KPressable>
          );
        }}
      />

      {vehicles.length > 1 && (
        <KRow justify="center" gap={6} style={{ marginTop: 10 }}>
          {vehicles.map((_, i) => (
            <View key={i} style={[styles.dot, i === currentIndex && (isDark ? styles.dotActiveDark : styles.dotActiveLight)]} />
          ))}
        </KRow>
      )}
    </View>
  );
}
const useHeroStyles = createStyles((colors, isDark) => ({
  heroCard: { marginRight: 14, borderRadius: 22, overflow: "hidden" },
  heroOverlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 22 },
  photoBadge: {
    position: "absolute", right: 14, bottom: 14,
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 5, alignItems: "center",
  },
  ratingBadge: {
    position: "absolute", top: 14, right: 14,
    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 10,
    paddingHorizontal: 9, paddingVertical: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.14)" },
  dotActiveDark: { backgroundColor: colors.primary },
  dotActiveLight: { backgroundColor: "rgba(0,0,0,0.48)" },
}));

// ═══════════════════════════════════════════════════════
// Popular Cities Row (dynamic from data)
// ═══════════════════════════════════════════════════════
function PopularCities({ cities }: { cities: { city: string; count: number; coverUrl: string | null }[] }) {
  const { styles, colors, isDark } = useCityStyles();

  if (!cities?.length) return null;

  return (
    <View style={{ marginTop: 22 }}>
      <SectionHeader title="Villes populaires" subtitle="Là où ça roule" />
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={cities} keyExtractor={(c) => c.city}
        contentContainerStyle={{ paddingLeft: 18, paddingRight: 4 }}
        renderItem={({ item }) => (
          <KPressable
            onPress={() => router.push({ pathname: "/(tabs)/search", params: { city: item.city } })}
            activeOpacity={0.9}
            style={styles.card}
          >
            {item.coverUrl ? (
              <KImage source={{ uri: item.coverUrl }} style={styles.cityImg} />
            ) : (
              <View style={[styles.cityImg, styles.cityPlaceholder]}>
                <Ionicons name="business-outline" size={20} color={colors.textTertiary} />
              </View>
            )}
            <View style={styles.cityOverlay} />
            <View style={styles.cityContent}>
              <KText style={{ color: "#FFF", fontSize: 15, fontWeight: "700" }}>{item.city}</KText>
              <KText style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, marginTop: 1 }}>
                {item.count} annonce{item.count > 1 ? "s" : ""}
              </KText>
            </View>
          </KPressable>
        )}
      />
    </View>
  );
}
const useCityStyles = createStyles((colors, isDark) => ({
  card: {
    width: 140, height: 100, marginRight: 12, borderRadius: 16, overflow: "hidden",
  },
  cityImg: { width: 140, height: 100, position: "absolute" as const },
  cityPlaceholder: {
    backgroundColor: colors.bgTertiary,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  cityOverlay: {
    ...({ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 } as const),
    backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 16,
  },
  cityContent: {
    flex: 1, justifyContent: "flex-end" as const, padding: 10,
  },
}));

// ═══════════════════════════════════════════════════════
// Vehicle Section (horizontal carousel)
// ═══════════════════════════════════════════════════════
function VehicleSection({ title, subtitle, vehicles }: { title: string; subtitle: string; vehicles: any[] }) {
  const { styles, colors, isDark } = useVehicleSectionStyles();

  if (!vehicles || vehicles.length === 0) return null;

  return (
    <View style={{ marginTop: 22 }}>
      <SectionHeader title={title} subtitle={subtitle} showAll />
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={vehicles} keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingLeft: 18, paddingRight: 4 }}
        renderItem={({ item }) => (
          <KPressable onPress={() => router.push(`/vehicle/${item._id}`)} activeScale={0.985} style={styles.card}>
            <View style={styles.cardImageWrap}>
              {item.coverUrl ? (
                <KImage source={{ uri: item.coverUrl }} style={styles.cardImage} />
              ) : (
                <KVStack align="center" justify="center" style={styles.cardNoImage}>
                  <Ionicons name="car-outline" size={32} color={colors.textTertiary} />
                </KVStack>
              )}
              <View style={styles.cardHeart}>
                <KFavoriteButton vehicleId={item._id} size={16} variant="overlay" />
              </View>
            </View>
            <KVStack gap={3} padding="md">
              <KText variant="label" numberOfLines={1}>{item.title}</KText>
              <KRow gap={4} align="center">
                <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                <KText variant="caption" color="textSecondary">{item.city}</KText>
              </KRow>
              <KRow justify="space-between" align="center" style={{ marginTop: 4 }}>
                <KText variant="h3" bold>
                  {item.pricePerDay} MAD <KText variant="caption" color="textSecondary">/jour</KText>
                </KText>
                {item.reviewCount > 0 && (
                  <KRow gap={3} align="center">
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <KText variant="caption" bold>{item.reviewAverage}</KText>
                    <KText variant="caption" color="textTertiary">({item.reviewCount})</KText>
                  </KRow>
                )}
              </KRow>
            </KVStack>
          </KPressable>
        )}
      />
    </View>
  );
}
const useVehicleSectionStyles = createStyles((colors, isDark) => ({
  card: {
    width: 260, marginRight: 14, borderRadius: 18, overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder,
    ...(isDark ? {} : shadows.md),
  },
  cardImageWrap: { position: "relative" },
  cardImage: { width: 260, height: 160, backgroundColor: colors.bgTertiary },
  cardNoImage: { width: 260, height: 100, backgroundColor: colors.bgTertiary },
  cardHeart: { position: "absolute", top: 8, right: 8 },
}));

// ═══════════════════════════════════════════════════════
// Recently Viewed
// ═══════════════════════════════════════════════════════
function RecentlyViewed() {
  const { styles, colors, isDark } = useVehicleSectionStyles();
  const [ids, setIds] = useState<string[]>([]);

  // Re-load IDs every time home screen focuses
  useFocusEffect(
    useCallback(() => {
      getRecentlyViewed().then(setIds).catch(() => {});
    }, [])
  );

  const vehicles = useQuery(
    api.home.getVehiclesByIds,
    ids.length > 0 ? { ids: ids.slice(0, 10) } : "skip"
  );

  if (!vehicles || vehicles.length === 0) return null;

  return (
    <View style={{ marginTop: 22 }}>
      <SectionHeader title="Récemment vus" subtitle="Reprends là où tu en étais" />
      <FlatList
        horizontal showsHorizontalScrollIndicator={false}
        data={vehicles} keyExtractor={(item: any) => item._id}
        contentContainerStyle={{ paddingLeft: 18, paddingRight: 4 }}
        renderItem={({ item }: { item: any }) => (
          <KPressable onPress={() => router.push(`/vehicle/${item._id}`)} activeScale={0.985} style={styles.card}>
            <View style={styles.cardImageWrap}>
              {item.coverUrl ? (
                <KImage source={{ uri: item.coverUrl }} style={styles.cardImage} />
              ) : (
                <KVStack align="center" justify="center" style={styles.cardNoImage}>
                  <Ionicons name="car-outline" size={32} color={colors.textTertiary} />
                </KVStack>
              )}
              <View style={styles.cardHeart}>
                <KFavoriteButton vehicleId={item._id} size={16} variant="overlay" />
              </View>
            </View>
            <KVStack gap={3} padding="md">
              <KText variant="label" numberOfLines={1}>{item.title}</KText>
              <KRow gap={4} align="center">
                <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                <KText variant="caption" color="textSecondary">{item.city}</KText>
              </KRow>
              <KRow justify="space-between" align="center" style={{ marginTop: 4 }}>
                <KText variant="h3" bold>
                  {item.pricePerDay} MAD <KText variant="caption" color="textSecondary">/jour</KText>
                </KText>
                {item.reviewCount > 0 && (
                  <KRow gap={3} align="center">
                    <Ionicons name="star" size={11} color="#F59E0B" />
                    <KText variant="caption" bold>{item.reviewAverage}</KText>
                  </KRow>
                )}
              </KRow>
            </KVStack>
          </KPressable>
        )}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function HomeSkeleton() {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = skeletonPulse(pulse);
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const Box = ({ w, h, r = 18, style }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />
  );

  return (
    <View style={{ marginTop: 14 }}>
      <View style={{ paddingHorizontal: 18, marginBottom: 12 }}>
        <Box w={120} h={20} r={8} />
        <Box w={200} h={14} r={6} style={{ marginTop: 6 }} />
      </View>
      <View style={{ paddingLeft: 18 }}>
        <Box w={Math.min(SCREEN_WIDTH - 36, 380)} h={220} r={22} />
      </View>
      <View style={{ marginTop: 10, alignItems: "center" }}><Box w={46} h={6} r={3} /></View>

      <View style={{ marginTop: 22, paddingHorizontal: 18, marginBottom: 12 }}>
        <Box w={100} h={20} r={8} />
        <Box w={150} h={14} r={6} style={{ marginTop: 6 }} />
      </View>
      <KRow gap="md" style={{ paddingLeft: 18 }}>
        <Box w={220} h={74} r={18} />
        <Box w={220} h={74} r={18} />
      </KRow>

      <View style={{ marginTop: 22, paddingHorizontal: 18, marginBottom: 12 }}>
        <Box w={180} h={20} r={8} />
        <Box w={120} h={14} r={6} style={{ marginTop: 6 }} />
      </View>
      <KRow gap="md" style={{ paddingLeft: 18 }}>
        <Box w={260} h={250} r={18} />
        <Box w={260} h={250} r={18} />
      </KRow>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════
function EmptyState() {
  const { styles, colors, isDark } = useEmptyStyles();
  return (
    <KCard style={styles.card}>
      <KText variant="label" bold>Aucune annonce disponible</KText>
      <KText variant="bodySmall" color="textSecondary" style={{ lineHeight: 18 }}>
        Sois le premier à publier une annonce sur Kreeny, ou reviens plus tard !
      </KText>
      <KRow gap="sm" style={{ marginTop: 12 }}>
        <KPressable onPress={() => router.push("/(tabs)/search")} style={styles.btnOutline}>
          <Ionicons name="search" size={16} color={colors.primary} />
          <KText variant="labelSmall" bold>Rechercher</KText>
        </KPressable>
        <KPressable onPress={() => router.push("/(tabs)/publish")} style={styles.btnPrimary}>
          <Ionicons name="add" size={16} color="#FFF" />
          <KText variant="labelSmall" bold color="textInverse">Publier</KText>
        </KPressable>
      </KRow>
    </KCard>
  );
}
const useEmptyStyles = createStyles((colors, isDark) => ({
  card: {
    marginTop: 18, marginHorizontal: 18, padding: 16, gap: 6,
    borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder,
  },
  btnOutline: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
  },
  btnPrimary: {
    flex: 1, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
}));

// ═══════════════════════════════════════════════════════
// MAIN HOME SCREEN
// ═══════════════════════════════════════════════════════
export default function Home() {
  const feed = useQuery(api.home.getFeed);
  const [refreshing, setRefreshing] = useState(false);

  const loading = feed === undefined;

  // Animations
  const skeletonOut = useRef(new Animated.Value(1)).current;
  const contentIn = useRef(new Animated.Value(0)).current;
  const [showSkeleton, setShowSkeleton] = useState(true);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const citiesAnim = useRef(new Animated.Value(0)).current;
  const dealsAnim = useRef(new Animated.Value(0)).current;
  const topAnim = useRef(new Animated.Value(0)).current;
  const newAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      setShowSkeleton(true);
      skeletonOut.setValue(1);
      contentIn.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(skeletonOut, motion.fadeOut),
      Animated.timing(contentIn, motion.fadeIn),
    ]).start(({ finished }) => { if (finished) setShowSkeleton(false); });

    staggeredEntrance([heroAnim, citiesAnim, dealsAnim, topAnim, newAnim]).start();
  }, [loading]);

  const fadeUp = (anim: Animated.Value) => fadeUpStyle(anim);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <KScreen scroll edges={["top"]} noPadding bottomInset={32}>
      <SearchBar />
      <ActiveTripBanner />

      <View style={{ position: "relative" }}>
        {showSkeleton && (
          <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: skeletonOut, zIndex: 2 }}>
            <HomeSkeleton />
          </Animated.View>
        )}

        <Animated.View style={{
          opacity: contentIn,
          transform: [{ translateY: contentIn.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
        }}>
          {feed && feed.totalVehicles === 0 ? (
            <EmptyState />
          ) : feed ? (
            <>
              <Animated.View style={fadeUp(heroAnim)}>
                <HeroCarousel vehicles={feed.featured} />
              </Animated.View>
              <Animated.View style={fadeUp(citiesAnim)}>
                <PopularCities cities={feed.popularCities} />
              </Animated.View>
              <RecentlyViewed />
              <Animated.View style={fadeUp(dealsAnim)}>
                <VehicleSection title="Petits prix" subtitle="Les meilleures affaires" vehicles={feed.bestDeals} />
              </Animated.View>
              <Animated.View style={fadeUp(topAnim)}>
                <VehicleSection title="Les mieux notés" subtitle="Approuvés par la communauté" vehicles={feed.topRated} />
              </Animated.View>
              <Animated.View style={fadeUp(newAnim)}>
                <VehicleSection title="Nouveautés" subtitle="Dernières annonces publiées" vehicles={feed.newest} />
              </Animated.View>
              <TrustTagline />
            </>
          ) : null}
        </Animated.View>
      </View>
    </KScreen>
  );
}
