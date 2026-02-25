import { useEffect, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { formatDateFR } from "../../src/shared/utils/formatDateFR";
import { useTheme } from "../../src/theme";

// ═══════════════════════════════════════════════════════
// Status config
// ═══════════════════════════════════════════════════════
type StatusConfig = { label: string; icon: string; color: string; bgColor: string };

function getStatusConfig(status: string, isDark: boolean): StatusConfig {
  const configs: Record<string, StatusConfig> = {
    requested:                { label: "En attente",        icon: "time-outline",              color: "#F59E0B", bgColor: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7" },
    accepted_pending_payment: { label: "À payer",           icon: "card-outline",              color: "#F59E0B", bgColor: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7" },
    confirmed:                { label: "Confirmée",         icon: "checkmark-circle-outline",  color: "#10B981", bgColor: isDark ? "rgba(16,185,129,0.15)" : "#ECFDF5" },
    pickup_pending:           { label: "Constat départ",    icon: "camera-outline",            color: "#3B82F6", bgColor: isDark ? "rgba(59,130,246,0.15)" : "#EFF6FF" },
    in_progress:              { label: "En cours",          icon: "car-outline",               color: "#3B82F6", bgColor: isDark ? "rgba(59,130,246,0.15)" : "#EFF6FF" },
    dropoff_pending:          { label: "Constat retour",    icon: "camera-reverse-outline",    color: "#8B5CF6", bgColor: isDark ? "rgba(139,92,246,0.15)" : "#F5F3FF" },
    completed:                { label: "Terminée",          icon: "flag-outline",              color: "#6B7280", bgColor: isDark ? "rgba(107,114,128,0.15)" : "#F3F4F6" },
    cancelled:                { label: "Annulée",           icon: "close-circle-outline",      color: "#EF4444", bgColor: isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2" },
    rejected:                 { label: "Refusée",           icon: "close-circle-outline",      color: "#EF4444", bgColor: isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2" },
  };
  return configs[status] ?? { label: status, icon: "help-circle-outline", color: "#6B7280", bgColor: "#F3F4F6" };
}

// ═══════════════════════════════════════════════════════
// Status Badge
// ═══════════════════════════════════════════════════════
function StatusBadge({ status, isDark }: { status: string; isDark: boolean }) {
  const config = getStatusConfig(status, isDark);
  return (
    <View style={{
      flexDirection: "row", alignItems: "center", gap: 5,
      backgroundColor: config.bgColor,
      paddingHorizontal: 10, paddingVertical: 5,
      borderRadius: 999, alignSelf: "flex-start",
    }}>
      <Ionicons name={config.icon as any} size={13} color={config.color} />
      <Text style={{ fontSize: 12, fontWeight: "700", color: config.color }}>{config.label}</Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Reservation Card
// ═══════════════════════════════════════════════════════
function ReservationCard({ item, colors, isDark }: any) {
  const { reservation, vehicle } = item;
  const coverUrl = vehicle?.coverUrl ?? null;
  const title = vehicle ? vehicle.title : "Véhicule supprimé";
  const city = vehicle?.city ?? "";

  // Action buttons
  const showPay = reservation.status === "accepted_pending_payment";
  const showCheckin = reservation.status === "confirmed" || reservation.status === "pickup_pending";
  const showCheckout = reservation.status === "dropoff_pending";
  const showChat = ["requested", "accepted_pending_payment", "confirmed", "pickup_pending", "in_progress", "dropoff_pending"].includes(reservation.status);

  return (
    <Pressable
      onPress={() => router.push(`/vehicle/${reservation.vehicleId}`)}
      style={({ pressed }) => ({
        backgroundColor: colors.card,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
        overflow: "hidden",
        marginBottom: 12,
        opacity: pressed ? 0.95 : 1,
      })}
    >
      {/* Top: image + info */}
      <View style={{ flexDirection: "row", padding: 14, gap: 14 }}>
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{ width: 80, height: 64, borderRadius: 12, backgroundColor: colors.bgTertiary }}
            resizeMode="cover"
          />
        ) : (
          <View style={{
            width: 80, height: 64, borderRadius: 12,
            backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="car-sport-outline" size={22} color={colors.textTertiary} />
          </View>
        )}

        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
            {title}
          </Text>
          {city ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
              <Ionicons name="location-outline" size={12} color={colors.textTertiary} />
              <Text style={{ fontSize: 12, color: colors.textSecondary }}>{city}</Text>
            </View>
          ) : null}
          <StatusBadge status={reservation.status} isDark={isDark} />
        </View>
      </View>

      {/* Dates */}
      <View style={{
        flexDirection: "row", alignItems: "center", gap: 8,
        paddingHorizontal: 14, paddingBottom: 12,
      }}>
        <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
        <Text style={{ fontSize: 13, color: colors.textSecondary }}>
          {formatDateFR(reservation.startDate)} → {formatDateFR(reservation.endDate)}
        </Text>
      </View>

      {/* Action buttons */}
      {(showPay || showCheckin || showCheckout || showChat) && (
        <View style={{
          flexDirection: "row", gap: 8, flexWrap: "wrap",
          paddingHorizontal: 14, paddingBottom: 14,
        }}>
          {showPay && (
            <ActionButton
              icon="card-outline"
              label="Payer"
              color="#F59E0B"
              bgColor={isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7"}
              onPress={() => {/* TODO: payment flow */}}
            />
          )}

          {showCheckin && (
            <ActionButton
              icon="camera-outline"
              label="Constat départ"
              color="#3B82F6"
              bgColor={isDark ? "rgba(59,130,246,0.15)" : "#EFF6FF"}
              onPress={() => router.push(`/reservation/${reservation._id}/report?phase=checkin&role=renter`)}
            />
          )}

          {showCheckout && (
            <ActionButton
              icon="camera-reverse-outline"
              label="Constat retour"
              color="#8B5CF6"
              bgColor={isDark ? "rgba(139,92,246,0.15)" : "#F5F3FF"}
              onPress={() => router.push(`/reservation/${reservation._id}/report?phase=checkout&role=renter`)}
            />
          )}

          {showChat && (
            <ActionButton
              icon="chatbubble-outline"
              label="Discussion"
              color={colors.primary}
              bgColor={isDark ? colors.primaryMuted : colors.primaryLight}
              onPress={() => router.push(`/chat/${reservation._id}`)}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Action Button
// ═══════════════════════════════════════════════════════
function ActionButton({ icon, label, color, bgColor, onPress }: any) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 6,
        backgroundColor: bgColor,
        paddingHorizontal: 12, paddingVertical: 8,
        borderRadius: 12,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      <Ionicons name={icon} size={14} color={color} />
      <Text style={{ fontSize: 12, fontWeight: "700", color }}>{label}</Text>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════
function EmptyState({ colors, isDark }: any) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="car-sport-outline" size={30} color={colors.textTertiary} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" }}>
        Pas encore de réservation
      </Text>
      <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
        Explore les annonces et réserve un véhicule pour ton prochain trajet.
      </Text>
      <Pressable
        onPress={() => router.push("/(tabs)/search")}
        style={({ pressed }) => ({
          backgroundColor: colors.primary, borderRadius: 14,
          paddingHorizontal: 24, paddingVertical: 12,
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 14 }}>Explorer</Text>
      </Pressable>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Not authenticated
// ═══════════════════════════════════════════════════════
function NotAuthenticated({ colors, isDark }: any) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
      <View style={{
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name="lock-closed-outline" size={28} color={colors.textTertiary} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" }}>
        Connecte-toi pour voir tes réservations
      </Text>
      <View style={{ gap: 10, width: "100%" }}>
        <Pressable
          onPress={() => router.push("/login")}
          style={({ pressed }) => ({
            backgroundColor: colors.primary, borderRadius: 14,
            paddingVertical: 14, alignItems: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Se connecter</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push("/signup")}
          style={({ pressed }) => ({
            backgroundColor: colors.card, borderRadius: 14,
            paddingVertical: 14, alignItems: "center",
            borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>Créer un compte</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function ReservationsSkeleton({ colors }: any) {
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
    <View style={{ padding: 18, gap: 12 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ borderRadius: 18, overflow: "hidden", backgroundColor: colors.card, padding: 14, gap: 10 }}>
          <View style={{ flexDirection: "row", gap: 14 }}>
            <Box w={80} h={64} r={12} />
            <View style={{ flex: 1, gap: 8 }}>
              <Box w="70%" h={16} />
              <Box w="40%" h={14} />
              <Box w="30%" h={22} r={999} />
            </View>
          </View>
          <Box w="60%" h={14} />
        </View>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function ReservationsScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, isLoading: authLoading } = useAuthStatus();

  // Use Convex query directly for real-time updates
  const data = useQuery(
    api.reservations.listMyReservationsWithVehicle,
    isAuthenticated ? {} : "skip"
  );

  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = () => {
    setRefreshing(true);
    // Convex queries are reactive, just fake the refresh UI
    setTimeout(() => setRefreshing(false), 600);
  };

  if (authLoading) return <ReservationsSkeleton colors={colors} />;

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={[]}>
        <NotAuthenticated colors={colors} isDark={isDark} />
      </SafeAreaView>
    );
  }

  if (data === undefined) return <ReservationsSkeleton colors={colors} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        data={data}
        keyExtractor={(item: any) => item.reservation._id}
        contentContainerStyle={{ padding: 18, paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        ListEmptyComponent={<EmptyState colors={colors} isDark={isDark} />}
        renderItem={({ item }) => (
          <ReservationCard item={item} colors={colors} isDark={isDark} />
        )}
      />
    </View>
  );
}
