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

function statusLabel(status: string) {
  switch (status) {
    case "requested":
      return "Demande envoyée";
    case "accepted_pending_payment":
      return "Acceptée — paiement requis";
    case "pickup_pending":
      return "Départ — preuves à faire";
    case "in_progress":
      return "En cours";
    case "dropoff_pending":
      return "Retour — preuves à faire";
    case "completed":
      return "Terminée";
    case "rejected":
      return "Refusée";
    case "cancelled":
      return "Annulée";
    default:
      return status;
  }
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

function canDoCheckin(status: string) {
  return status === "pickup_pending";
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

export default function ReservationsScreen() {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const { items, loading, error } = useMyReservations();
  const markPaid = useMutation(api.reservations.markReservationPaid);
  const markDropoff = useMutation(api.reservations.markDropoffPending);
  const initPayment = useMutation(api.reservations.initPayment);

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
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Mes réservations</Text>

      {(loading || !items) && <Text>Loading...</Text>}
      {error && <Text>Error: {error}</Text>}

      {!loading &&
        !error &&
        items.map(({ reservation, vehicle }) => {
          const title = vehicle ? `${vehicle.title} — ${vehicle.city}` : "Véhicule supprimé";

          return (
            <Pressable
              key={reservation._id}
              style={{ paddingVertical: 12, borderBottomWidth: 1 }}
              onPress={() => router.push(`/reservation/${reservation.vehicleId}`)}
            >
              <Text style={{ fontWeight: "700" }}>{title}</Text>

              <Text style={{ marginTop: 4 }}>
                {formatDateFR(reservation.startDate)} → {formatDateFR(reservation.endDate)} •{" "}
                {statusLabel(reservation.status)}
              </Text>

              {/* Actions contextuelles */}
              <View style={{ marginTop: 10, gap: 8 }}>
                {canPay(reservation.status) && (
                  <View style={{ gap: 8 }}>
                    <Button
                      title="Payer maintenant"
                      onPress={() => {
                        Alert.alert("Payer maintenant ?", "Le paiement sera initialisé.", [
                          { text: "Annuler", style: "cancel" },
                          {
                            text: "Payer",
                            onPress: async () => {
                              try {
                                await initPayment({ reservationId: reservation._id as any });
                                Alert.alert(
                                  "Paiement",
                                  "Paiement initialisé. (Stripe bientôt) \n\nDEV: utilise le bouton ci-dessous pour simuler le paiement."
                                );
                              } catch (e) {
                                Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
                              }
                            },
                          },
                        ]);
                      }}
                    />

                    {/* ✅ DEV ONLY : simulation paiement */}
                    <Button
                      title="Simuler paiement réussi (DEV)"
                      onPress={async () => {
                        try {
                          await markPaid({ reservationId: reservation._id as any });
                          Alert.alert("Paiement validé", "Tu peux maintenant faire le constat départ.");
                        } catch (e) {
                          Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
                        }
                      }}
                    />
                  </View>
                )}

                {/* ✅ NOUVEAU : Constat départ */}
                {canDoCheckin(reservation.status) && (
                  <Button
                    title="Faire le constat départ"
                    onPress={() =>
                      router.push(
                        `/reservation/${reservation._id}/report?phase=checkin&role=renter`
                      )
                    }
                  />
                )}

                {/* ✅ Constat retour */}
                {canDoCheckout(reservation.status) && (
                  <Button
                    title="Faire le constat retour"
                    onPress={() =>
                      router.push(
                        `/reservation/${reservation._id}/report?phase=checkout&role=renter`
                      )
                    }
                  />
                )}
              </View>
            </Pressable>
          );
        })}
    </SafeAreaView>
  );
}
