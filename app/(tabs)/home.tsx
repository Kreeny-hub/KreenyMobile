import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTheme, typography, spacing, radius, shadows } from "../../src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ═══════════════════════════════════════════════════════
// Collections rapides
// ═══════════════════════════════════════════════════════
const COLLECTIONS = [
  { id: "budget", title: "Petit budget", subtitle: "Les meilleurs prix", icon: "pricetag-outline" },
  { id: "city", title: "En ville", subtitle: "Idéal pour vos trajets", icon: "business-outline" },
  { id: "family", title: "Familiale", subtitle: "Espace & confort", icon: "people-outline" },
  { id: "weekend", title: "Week-end", subtitle: "Escapade rapide", icon: "sunny-outline" },
];

// ═══════════════════════════════════════════════════════
// Search Bar (faux → redirige vers tab Search)
// ═══════════════════════════════════════════════════════
function SearchBar() {
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      onPress={() => router.push("/(tabs)/search")}
      style={({ pressed }) => ({
        marginHorizontal: 18,
        marginTop: 10,
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: isDark ? colors.bgTertiary : colors.card,
        borderRadius: radius.full,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 10,
        opacity: pressed ? 0.9 : 1,
        borderWidth: isDark ? 0 : 1,
        borderColor: isDark ? "transparent" : colors.borderLight,
        ...(!isDark ? shadows.md : {}),
      })}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: colors.primary,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="search" size={16} color="#FFF" />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
          Trouver une voiture
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
          Toutes villes • Dates flexibles
        </Text>
      </View>

      <Ionicons name="options-outline" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Hero Carousel
// ═══════════════════════════════════════════════════════
function HeroCarousel({ vehicles }: { vehicles: any[] }) {
  const { colors, isDark } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(0);

  const cardWidth = Math.min(SCREEN_WIDTH - 36, 380);
  const cardHeight = 220;
  const snapInterval = cardWidth + 14;

  if (vehicles.length === 0) return null;

  return (
    <View style={{ marginTop: 14 }}>
      {/* Section header */}
      <View style={{ paddingHorizontal: 18, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
            À la une
          </Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
            Découvrez une sélection premium
          </Text>
        </View>
        <Pressable onPress={() => router.push("/(tabs)/search")}>
          <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>
            Tout voir
          </Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={vehicles}
        keyExtractor={(item) => item._id}
        snapToInterval={snapInterval}
        decelerationRate="fast"
        contentContainerStyle={{ paddingLeft: 18, paddingRight: 4 }}
        onScroll={(e) => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
          if (idx !== currentIndex) setCurrentIndex(idx);
        }}
        scrollEventThrottle={16}
        renderItem={({ item }) => {
          const hasImage = !!item.coverUrl;

          if (!hasImage) {
            return (
              <Pressable
                onPress={() => router.push(`/vehicle/${item._id}`)}
                style={{
                  width: cardWidth,
                  height: cardHeight,
                  marginRight: 14,
                  borderRadius: 22,
                  overflow: "hidden",
                  backgroundColor: colors.bgTertiary,
                  justifyContent: "flex-end",
                }}
              >
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="car-sport-outline" size={48} color={colors.textTertiary} />
                </View>
                <View style={{ padding: 14 }}>
                  <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
                    {item.title}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                    {item.city || "Toutes villes"}
                  </Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text, marginTop: 6 }}>
                    {item.pricePerDay} MAD{" "}
                    <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary }}>/jour</Text>
                  </Text>
                </View>
              </Pressable>
            );
          }

          return (
            <Pressable
              onPress={() => router.push(`/vehicle/${item._id}`)}
              style={{ width: cardWidth, height: cardHeight, marginRight: 14, borderRadius: 22, overflow: "hidden" }}
            >
              <ImageBackground
                source={{ uri: item.coverUrl }}
                style={{ flex: 1, justifyContent: "flex-end" }}
                imageStyle={{ borderRadius: 22 }}
              >
                {/* Overlay sombre pour lisibilité */}
                <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.22)", borderRadius: 22 }} />

                {/* Badge photos */}
                {item.imageUrls?.length > 1 && (
                  <View style={{
                    position: "absolute", left: 14, bottom: 14,
                    backgroundColor: "rgba(0,0,0,0.45)", borderRadius: 999,
                    paddingHorizontal: 10, paddingVertical: 5,
                    flexDirection: "row", alignItems: "center", gap: 5,
                  }}>
                    <Ionicons name="images-outline" size={13} color="#fff" />
                    <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>
                      {item.imageUrls.length}
                    </Text>
                  </View>
                )}

                {/* Infos */}
                <View style={{ padding: 14 }}>
                  <Text numberOfLines={1} style={{ fontSize: 18, fontWeight: "800", color: "#fff" }}>
                    {item.title}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.9)", fontWeight: "600" }}>
                      {item.city || "Toutes villes"}
                    </Text>
                  </View>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: "#fff", marginTop: 6 }}>
                    {item.pricePerDay} MAD{" "}
                    <Text style={{ fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.85)" }}>/jour</Text>
                  </Text>
                </View>
              </ImageBackground>
            </Pressable>
          );
        }}
      />

      {/* Dots */}
      {vehicles.length > 1 && (
        <View style={{ marginTop: 10, flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {vehicles.map((_, i) => (
            <View
              key={i}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === currentIndex
                  ? (isDark ? colors.primary : "rgba(0,0,0,0.48)")
                  : (isDark ? colors.bgTertiary : "rgba(0,0,0,0.14)"),
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Collections horizontales
// ═══════════════════════════════════════════════════════
function CollectionsRow() {
  const { colors, isDark } = useTheme();

  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ paddingHorizontal: 18, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Explorer</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>Collections rapides</Text>
        </View>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={COLLECTIONS}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ paddingLeft: 18, paddingRight: 4 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push("/(tabs)/search")}
            style={({ pressed }) => ({
              width: 220,
              marginRight: 12,
              backgroundColor: colors.card,
              borderRadius: 18,
              padding: 14,
              flexDirection: "row",
              alignItems: "center",
              gap: 12,
              borderWidth: 1,
              borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
              opacity: pressed ? 0.9 : 1,
            })}
          >
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 16,
                backgroundColor: colors.primaryLight,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Ionicons name={item.icon as any} size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
                {item.title}
              </Text>
              <Text numberOfLines={2} style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
                {item.subtitle}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </Pressable>
        )}
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Section de véhicules (carrousel horizontal)
// ═══════════════════════════════════════════════════════
function VehicleSection({ title, subtitle, vehicles }: { title: string; subtitle: string; vehicles: any[] }) {
  const { colors, isDark } = useTheme();

  if (!vehicles || vehicles.length === 0) return null;

  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ paddingHorizontal: 18, marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{title}</Text>
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{subtitle}</Text>
        </View>
        <Pressable onPress={() => router.push("/(tabs)/search")}>
          <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>Tout voir</Text>
        </Pressable>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={vehicles}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingLeft: 18, paddingRight: 4 }}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/vehicle/${item._id}`)}
            style={({ pressed }) => ({
              width: 260,
              marginRight: 14,
              borderRadius: 18,
              overflow: "hidden",
              backgroundColor: colors.card,
              borderWidth: isDark ? 1 : 0,
              borderColor: colors.cardBorder,
              opacity: pressed ? 0.92 : 1,
              ...(!isDark ? shadows.md : {}),
            })}
          >
            {item.coverUrl ? (
              <Image
                source={{ uri: item.coverUrl }}
                style={{ width: 260, height: 160, backgroundColor: colors.bgTertiary }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: 260,
                  height: 100,
                  backgroundColor: colors.bgTertiary,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Ionicons name="car-outline" size={32} color={colors.textTertiary} />
              </View>
            )}

            <View style={{ padding: 12, gap: 3 }}>
              <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
                {item.title}
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                <Text style={{ fontSize: 12, color: colors.textSecondary }}>{item.city}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginTop: 4 }}>
                {item.pricePerDay} MAD{" "}
                <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textSecondary }}>/jour</Text>
              </Text>
            </View>
          </Pressable>
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
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });

  const Box = ({ w, h, r = 18, style }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />
  );

  return (
    <View style={{ marginTop: 14 }}>
      {/* Hero skeleton */}
      <View style={{ paddingHorizontal: 18, marginBottom: 12 }}>
        <Box w={120} h={20} r={8} />
        <Box w={200} h={14} r={6} style={{ marginTop: 6 }} />
      </View>
      <View style={{ paddingLeft: 18 }}>
        <Box w={Math.min(SCREEN_WIDTH - 36, 380)} h={220} r={22} />
      </View>
      <View style={{ marginTop: 10, alignItems: "center" }}>
        <Box w={46} h={6} r={3} />
      </View>

      {/* Collections skeleton */}
      <View style={{ marginTop: 22, paddingHorizontal: 18, marginBottom: 12 }}>
        <Box w={100} h={20} r={8} />
        <Box w={150} h={14} r={6} style={{ marginTop: 6 }} />
      </View>
      <View style={{ flexDirection: "row", paddingLeft: 18, gap: 12 }}>
        <Box w={220} h={74} r={18} />
        <Box w={220} h={74} r={18} />
      </View>

      {/* Section skeleton */}
      <View style={{ marginTop: 22, paddingHorizontal: 18, marginBottom: 12 }}>
        <Box w={180} h={20} r={8} />
        <Box w={120} h={14} r={6} style={{ marginTop: 6 }} />
      </View>
      <View style={{ flexDirection: "row", paddingLeft: 18, gap: 14 }}>
        <Box w={260} h={250} r={18} />
        <Box w={260} h={250} r={18} />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════
function EmptyState() {
  const { colors, isDark } = useTheme();

  return (
    <View style={{
      marginTop: 18, marginHorizontal: 18,
      backgroundColor: colors.card,
      borderRadius: 18, padding: 16, gap: 6,
      borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder,
    }}>
      <Text style={{ fontWeight: "800", color: colors.text, fontSize: 14 }}>
        Aucune annonce disponible
      </Text>
      <Text style={{ color: colors.textSecondary, lineHeight: 18, fontSize: 13 }}>
        Sois le premier à publier une annonce sur Kreeny, ou reviens plus tard !
      </Text>

      <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
        <Pressable
          onPress={() => router.push("/(tabs)/search")}
          style={({ pressed }) => ({
            flex: 1, backgroundColor: colors.card,
            borderRadius: 14, paddingVertical: 12,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="search" size={16} color={colors.primary} />
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 13 }}>Rechercher</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/(tabs)/publish")}
          style={({ pressed }) => ({
            flex: 1, backgroundColor: colors.primary,
            borderRadius: 14, paddingVertical: 12,
            flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name="add" size={16} color="#FFF" />
          <Text style={{ fontWeight: "800", color: "#FFF", fontSize: 13 }}>Publier</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN HOME SCREEN
// ═══════════════════════════════════════════════════════
export default function Home() {
  const { colors, isDark } = useTheme();
  const vehicles = useQuery(api.vehicles.listVehiclesWithCover);
  const seedVehicles = useMutation(api.vehicles.seedVehicles);
  const [refreshing, setRefreshing] = useState(false);

  const loading = vehicles === undefined;

  // ── Animations ────────────────────
  const skeletonOut = useRef(new Animated.Value(1)).current;
  const contentIn = useRef(new Animated.Value(0)).current;
  const [showSkeleton, setShowSkeleton] = useState(true);

  const heroAnim = useRef(new Animated.Value(0)).current;
  const collectionsAnim = useRef(new Animated.Value(0)).current;
  const recoAnim = useRef(new Animated.Value(0)).current;
  const newAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (loading) {
      setShowSkeleton(true);
      skeletonOut.setValue(1);
      contentIn.setValue(0);
      return;
    }

    Animated.parallel([
      Animated.timing(skeletonOut, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(contentIn, { toValue: 1, duration: 260, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setShowSkeleton(false);
    });

    // Stagger les sections
    Animated.stagger(90, [
      Animated.timing(heroAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(collectionsAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(recoAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(newAnim, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [loading]);

  const fadeUp = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
  });

  // ── Data splits ───────────────────
  const heroPicks = useMemo(() => {
    if (!vehicles?.length) return [];
    // Top 6 = ceux avec photos d'abord, puis par date
    return [...vehicles]
      .sort((a, b) => {
        const aHas = a.coverUrl ? 1 : 0;
        const bHas = b.coverUrl ? 1 : 0;
        if (bHas !== aHas) return bHas - aHas;
        return (b.createdAt || 0) - (a.createdAt || 0);
      })
      .slice(0, 6);
  }, [vehicles]);

  const heroIds = useMemo(() => new Set(heroPicks.map((v) => v._id)), [heroPicks]);

  const recommended = useMemo(() => {
    if (!vehicles?.length) return [];
    return vehicles.filter((v) => !heroIds.has(v._id)).slice(0, 10);
  }, [vehicles, heroIds]);

  const recommendedIds = useMemo(() => new Set(recommended.map((v) => v._id)), [recommended]);

  const newArrivals = useMemo(() => {
    if (!vehicles?.length) return [];
    return [...vehicles]
      .filter((v) => !heroIds.has(v._id) && !recommendedIds.has(v._id))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
      .slice(0, 10);
  }, [vehicles, heroIds, recommendedIds]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <SearchBar />

        {/* DEV seed */}
        {__DEV__ && (
          <Pressable
            onPress={() => seedVehicles({})}
            style={{
              marginTop: 10, marginHorizontal: 18, alignSelf: "flex-start",
              paddingVertical: 6, paddingHorizontal: 12,
              backgroundColor: colors.warningLight, borderRadius: 8,
            }}
          >
            <Text style={{ fontWeight: "700", fontSize: 11, color: colors.warning }}>DEV: Seed véhicules</Text>
          </Pressable>
        )}

        {/* Content with skeleton transition */}
        <View style={{ position: "relative" }}>
          {showSkeleton && (
            <Animated.View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: 0, opacity: skeletonOut, zIndex: 2 }}>
              <HomeSkeleton />
            </Animated.View>
          )}

          <Animated.View
            style={{
              opacity: contentIn,
              transform: [{ translateY: contentIn.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
            }}
          >
            {vehicles && vehicles.length === 0 ? (
              <EmptyState />
            ) : vehicles ? (
              <>
                <Animated.View style={fadeUp(heroAnim)}>
                  <HeroCarousel vehicles={heroPicks} />
                </Animated.View>

                <Animated.View style={fadeUp(collectionsAnim)}>
                  <CollectionsRow />
                </Animated.View>

                <Animated.View style={fadeUp(recoAnim)}>
                  <VehicleSection
                    title="Recommandés"
                    subtitle="Une sélection pour vous"
                    vehicles={recommended}
                  />
                </Animated.View>

                <Animated.View style={fadeUp(newAnim)}>
                  <VehicleSection
                    title="Nouveautés"
                    subtitle="Dernières annonces publiées"
                    vehicles={newArrivals}
                  />
                </Animated.View>
              </>
            ) : null}
          </Animated.View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
