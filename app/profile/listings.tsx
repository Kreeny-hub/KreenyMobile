import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useTheme } from "../../src/theme";

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function ListingsSkeleton() {
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
  const Box = ({ w, h, r = 8, style }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 18, paddingTop: 70 }}>
      <Box w="50%" h={22} />
      <Box w="30%" h={14} style={{ marginTop: 6 }} />
      {[0, 1, 2].map((i) => (
        <View key={i} style={{ marginTop: 16 }}>
          <Box w="100%" h={140} r={18} />
          <Box w="70%" h={16} style={{ marginTop: 10 }} />
          <Box w="50%" h={12} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════
function EmptyState({ colors, isDark }: { colors: any; isDark: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14, marginTop: -40 }}>
      <View
        style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons name="car-outline" size={26} color={colors.textTertiary} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" }}>
        Aucune annonce
      </Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19 }}>
        Publie ton premier véhicule et commence à recevoir des demandes de réservation.
      </Text>
      <Pressable
        testID="listings-publish-btn"
        onPress={() => router.push("/(tabs)/publish")}
        style={({ pressed }) => ({
          backgroundColor: colors.primary, borderRadius: 14,
          paddingVertical: 12, paddingHorizontal: 24,
          opacity: pressed ? 0.85 : 1, marginTop: 6,
        })}
      >
        <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 14 }}>Publier un véhicule</Text>
      </Pressable>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Listing Card
// ═══════════════════════════════════════════════════════
function ListingCard({
  item,
  deactivate,
  reactivate,
  colors,
  isDark,
}: {
  item: any;
  deactivate: (id: any) => void;
  reactivate: (id: any) => void;
  colors: any;
  isDark: boolean;
}) {
  const v = item.vehicle;
  const photoCount = v.imageUrls?.length ?? 0;
  const isActive = v.isActive !== false;
  const requestCount = item.requestCount ?? 0;

  const onDeactivate = () => {
    Alert.alert(
      "Désactiver l'annonce",
      "L'annonce ne sera plus visible par les locataires. Tu pourras la réactiver à tout moment.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Désactiver",
          style: "destructive",
          onPress: async () => {
            try {
              await deactivate({ vehicleId: v._id });
            } catch (e: any) {
              const msg = e?.message || "";
              if (msg.includes("HasActiveReservations")) {
                Alert.alert("Impossible", "Tu as des réservations en cours sur ce véhicule.");
              } else {
                Alert.alert("Erreur", "Impossible de désactiver l'annonce.");
              }
            }
          },
        },
      ]
    );
  };

  const onReactivate = async () => {
    try {
      await reactivate({ vehicleId: v._id });
    } catch {
      Alert.alert("Erreur", "Impossible de réactiver l'annonce.");
    }
  };

  return (
    <Pressable
      testID={`listing-card-${String(v._id)}`}
      onPress={() => router.push(`/profile/listings/${String(v._id)}`)}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: 20,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
        marginBottom: 14,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      {/* Image / Placeholder */}
      {photoCount > 0 ? (
        <View
          style={{
            width: "100%", height: 150,
            backgroundColor: colors.primaryLight,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="images-outline" size={28} color={colors.primary} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary, marginTop: 4 }}>
            {photoCount} photo{photoCount > 1 ? "s" : ""}
          </Text>
        </View>
      ) : (
        <View
          style={{
            width: "100%", height: 120,
            backgroundColor: isDark ? colors.bgTertiary : "#F5F6F8",
            alignItems: "center", justifyContent: "center", gap: 6,
          }}
        >
          <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textTertiary }}>
            Aucune photo
          </Text>
        </View>
      )}

      {/* Status pills overlay */}
      <View style={{ position: "absolute", top: 10, left: 10, flexDirection: "row", gap: 6 }}>
        {!isActive && (
          <View
            style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              paddingHorizontal: 10, paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.1)",
            }}
          >
            <Ionicons name="pause-circle-outline" size={12} color="#EF4444" />
            <Text style={{ fontSize: 11, fontWeight: "800", color: "#EF4444" }}>Désactivée</Text>
          </View>
        )}
        {requestCount > 0 && (
          <View
            style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              paddingHorizontal: 10, paddingVertical: 5,
              borderRadius: 999,
              backgroundColor: isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.12)",
            }}
          >
            <Ionicons name="mail-unread" size={12} color={colors.primary} />
            <Text style={{ fontSize: 11, fontWeight: "800", color: colors.primary }}>
              {requestCount} demande{requestCount > 1 ? "s" : ""}
            </Text>
          </View>
        )}
      </View>

      {/* Meta */}
      <View style={{ padding: 14, gap: 10 }}>
        <View>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
            {v.title || "Annonce"}
          </Text>
          <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
            {v.city || "—"} • {v.pricePerDay} MAD/jour
          </Text>
        </View>

        {/* Actions row */}
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {/* Gérer photos */}
          <Pressable
            testID={`listing-photos-${String(v._id)}`}
            onPress={() => router.push(`/vehicle/images?vehicleId=${String(v._id)}`)}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingVertical: 9, paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: photoCount === 0
                ? (isDark ? "rgba(245,158,11,0.12)" : "#FEF3C7")
                : (isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)"),
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons
              name="camera-outline"
              size={15}
              color={photoCount === 0 ? "#F59E0B" : colors.primary}
            />
            <Text
              style={{
                fontSize: 12, fontWeight: "800",
                color: photoCount === 0 ? "#F59E0B" : colors.primary,
              }}
            >
              {photoCount > 0 ? "Gérer photos" : "Ajouter photos"}
            </Text>
          </Pressable>

          {/* Voir détails */}
          <Pressable
            testID={`listing-details-${String(v._id)}`}
            onPress={() => router.push(`/vehicle/${String(v._id)}`)}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center", gap: 6,
              paddingVertical: 9, paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)",
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons name="eye-outline" size={15} color={colors.text} />
            <Text style={{ fontSize: 12, fontWeight: "800", color: colors.text }}>Voir</Text>
          </Pressable>

          {/* Désactiver / Réactiver */}
          {isActive ? (
            <Pressable
              testID={`listing-deactivate-${String(v._id)}`}
              onPress={onDeactivate}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingVertical: 9, paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "rgba(239,68,68,0.06)",
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="pause-outline" size={15} color="#EF4444" />
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#EF4444" }}>Désactiver</Text>
            </Pressable>
          ) : (
            <Pressable
              testID={`listing-reactivate-${String(v._id)}`}
              onPress={onReactivate}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", gap: 6,
                paddingVertical: 9, paddingHorizontal: 12,
                borderRadius: 12,
                backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#ECFDF5",
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Ionicons name="play-outline" size={15} color="#10B981" />
              <Text style={{ fontSize: 12, fontWeight: "800", color: "#10B981" }}>Réactiver</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function MyListings() {
  const { colors, isDark } = useTheme();
  const data = useQuery(api.vehicles.listMyListingsWithRequestCount, {});
  const deactivate = useMutation(api.vehicles.deactivateVehicle);
  const reactivate = useMutation(api.vehicles.reactivateVehicle);

  const countText = useMemo(() => {
    if (!data) return "";
    const n = data.length;
    return `${n} annonce${n > 1 ? "s" : ""}`;
  }, [data?.length]);

  if (data === undefined) return <ListingsSkeleton />;

  return (
    <SafeAreaView
      testID="listings-screen"
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 12,
          paddingHorizontal: 14,
          height: 56,
        }}
      >
        <Pressable
          testID="listings-back-btn"
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <View
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </View>
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>
            Mes annonces
          </Text>
          {countText ? (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
              {countText}
            </Text>
          ) : null}
        </View>

        {/* Add button */}
        <Pressable
          testID="listings-add-btn"
          onPress={() => router.push("/(tabs)/publish")}
          style={({ pressed }) => ({
            width: 40, height: 40, borderRadius: 12,
            backgroundColor: colors.primaryLight,
            alignItems: "center", justifyContent: "center",
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Ionicons name="add" size={22} color={colors.primary} />
        </Pressable>
      </View>

      {data.length === 0 ? (
        <EmptyState colors={colors} isDark={isDark} />
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item: any) => String(item.vehicle._id)}
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 28 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }: any) => (
            <ListingCard
              item={item}
              deactivate={deactivate}
              reactivate={reactivate}
              colors={colors}
              isDark={isDark}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}