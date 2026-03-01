import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { router, Stack } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { KText, KVStack, KRow, KPressable, VehicleCardCompact, CardAction, createStyles } from "../../src/ui";
import { haptic, skeletonPulse } from "../../src/theme";
import { showErrorToast, showSuccessToast } from "../../src/presentation/components/Toast";

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); }
  catch { return iso; }
}
function daysBetween(s: string, e: string) {
  try { return Math.max(1, Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / 86_400_000)); }
  catch { return 1; }
}
function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Il y a 1 jour";
  if (d < 7) return `Il y a ${d} jours`;
  const w = Math.floor(d / 7);
  return w === 1 ? "Il y a 1 sem." : `Il y a ${w} sem.`;
}

type FilterKey = "all" | "active" | "done";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "active", label: "En cours" },
  { key: "done", label: "Terminées" },
];
const ACTIVE_SET = new Set(["requested", "accepted_pending_payment", "confirmed", "pickup_pending", "in_progress", "dropoff_pending", "disputed"]);
const DONE_SET = new Set(["completed", "cancelled", "rejected"]);

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function Skeleton() {
  const { colors } = useSkelStyles();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => { skeletonPulse(p).start(); }, []);
  const op = p.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const B = ({ w, h, r = 10, style: st }: any) => <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity: op }, st]} />;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <KRow gap={8}><B w={40} h={40} r={12} /><B w="50%" h={18} /></KRow>
        <KRow gap={8} style={{ marginTop: 16 }}><B w={80} h={32} r={10} /><B w={80} h={32} r={10} /><B w={80} h={32} r={10} /></KRow>
        {[0, 1, 2].map((i) => (
          <KRow key={i} gap={12} style={{ marginTop: 12, backgroundColor: colors.card, borderRadius: 16, padding: 12 }}>
            <B w={88} h={88} r={12} /><KVStack style={{ flex: 1, gap: 8 }}><B w="60%" h={14} /><B w="45%" h={12} /><B w="50%" h={12} /></KVStack>
          </KRow>
        ))}
      </View>
    </SafeAreaView>
  );
}
const useSkelStyles = createStyles((c) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// Not Authenticated
// ═══════════════════════════════════════════════════════
function NotAuth() {
  const { colors, isDark } = useNAStyles();
  return (
    <KVStack align="center" style={{ paddingTop: 80, paddingHorizontal: 32, gap: 16 }}>
      <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA", alignItems: "center", justifyContent: "center" }}>
        <Ionicons name="person-outline" size={24} color={colors.textTertiary} />
      </View>
      <KText variant="label" bold center>Connecte-toi pour voir tes réservations</KText>
      <KRow gap={8} style={{ marginTop: 8 }}>
        <KPressable onPress={() => router.push("/signup")} style={{ backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14 }}>
          <KText variant="label" bold color="textInverse">Créer un compte</KText>
        </KPressable>
        <KPressable onPress={() => router.push("/login")} style={{ backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14 }}>
          <KText variant="label" bold>Se connecter</KText>
        </KPressable>
      </KRow>
    </KVStack>
  );
}
const useNAStyles = createStyles((c) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function MyReservationsScreen() {
  const { styles: s, colors, isDark } = useStyles();
  const { isAuthenticated, isLoading } = useAuthStatus();
  const [filter, setFilter] = useState<FilterKey>("all");
  const raw = useQuery(api.reservations.listMyReservationsWithVehicle, isAuthenticated ? {} : "skip");
  const cancel = useMutation(api.reservations.cancelReservation);

  const filtered = useMemo(() => {
    if (!raw) return [];
    if (filter === "active") return raw.filter((i: any) => ACTIVE_SET.has(i.reservation.status));
    if (filter === "done") return raw.filter((i: any) => DONE_SET.has(i.reservation.status));
    return raw;
  }, [raw, filter]);

  const counts = useMemo(() => {
    if (!raw) return { all: 0, active: 0, done: 0 };
    return { all: raw.length, active: raw.filter((i: any) => ACTIVE_SET.has(i.reservation.status)).length, done: raw.filter((i: any) => DONE_SET.has(i.reservation.status)).length };
  }, [raw]);

  if (isLoading) return <Skeleton />;
  if (!isAuthenticated) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}><Stack.Screen options={{ headerShown: false }} /><NotAuth /></SafeAreaView>;
  if (!raw) return <Skeleton />;

  const handlePay = (id: string) => { haptic.medium(); router.push(`/payment/${id}`); };
  const handleCancel = (id: string) => {
    Alert.alert("Annuler la réservation ?", "Cette action est irréversible.", [
      { text: "Non", style: "cancel" },
      { text: "Oui, annuler", style: "destructive", onPress: async () => {
        try { await cancel({ reservationId: id as any }); showSuccessToast("Réservation annulée"); }
        catch (e) { showErrorToast(e); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <KRow gap={8} style={s.header}>
        <KPressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <View style={{ flex: 1 }}>
          <KText variant="label" bold style={{ fontSize: 17 }}>Mes réservations</KText>
          {counts.all > 0 && <KText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>{counts.active} active{counts.active > 1 ? "s" : ""}</KText>}
        </View>
      </KRow>

      {/* ── Filters ── */}
      {counts.all > 0 && (
        <KRow gap={8} style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            return (
              <KPressable key={f.key} onPress={() => { haptic.light(); setFilter(f.key); }}
                style={[s.chip, on && { backgroundColor: colors.primary }]}>
                <KText variant="caption" bold style={{ fontSize: 12, color: on ? "#FFF" : colors.textSecondary }}>{f.label}</KText>
                {counts[f.key] > 0 && (
                  <View style={[s.chipN, on && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                    <KText variant="caption" bold style={{ fontSize: 10, color: on ? "#FFF" : colors.textTertiary }}>{counts[f.key]}</KText>
                  </View>
                )}
              </KPressable>
            );
          })}
        </KRow>
      )}

      {/* ── List ── */}
      <FlatList
        data={filtered}
        keyExtractor={(i: any) => i.reservation._id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 12, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <KVStack align="center" style={{ paddingTop: 64, gap: 16 }}>
            <View style={s.emptyIcon}>
              <Ionicons name="calendar-outline" size={22} color={colors.textTertiary} />
            </View>
            <KText variant="label" bold center>{filter === "all" ? "Aucune réservation" : filter === "active" ? "Rien en cours" : "Aucune terminée"}</KText>
            <KText variant="bodySmall" color="textSecondary" center style={{ maxWidth: 240, lineHeight: 20 }}>
              {filter === "all" ? "Trouve le véhicule idéal et lance ta première réservation." : "Les réservations apparaîtront ici."}
            </KText>
            {filter === "all" && (
              <KPressable onPress={() => router.push("/(tabs)/search")} style={s.primaryBtn}>
                <KText variant="label" bold style={{ color: "#FFF" }}>Chercher un véhicule</KText>
              </KPressable>
            )}
          </KVStack>
        }
        renderItem={({ item }) => {
          const r = item.reservation;
          const v = item.vehicle;
          const days = daysBetween(r.startDate, r.endDate);
          const total = v ? days * v.pricePerDay : 0;
          const st = r.status;

          const needsPay = st === "accepted_pending_payment";
          const needsCheckin = st === "pickup_pending" && !item.hasCheckinReport;
          const needsCheckout = st === "dropoff_pending" && !item.hasCheckoutReport;
          const cancellable = st === "requested" || needsPay;
          const showReview = st === "completed" && !item.hasReviewed;
          const canDispute = (st === "dropoff_pending" || st === "completed") && item.hasCheckoutReport;
          const isDisputed = st === "disputed";
          const hasActions = needsPay || needsCheckin || needsCheckout || cancellable || showReview || canDispute || isDisputed;

          const isDeleted = !v;

          return (
            <VehicleCardCompact
              coverUrl={v?.coverUrl}
              title={v ? v.title : "Annonce supprimée"}
              deleted={isDeleted}
              status={st}
              subtitle={`${fmtDate(r.startDate)} → ${fmtDate(r.endDate)} · ${days}j`}
              statusLine={timeAgo(r.createdAt ?? r._creationTime)}
              statusLineColor="#9CA3AF"
              priceLabel={total > 0 ? `${total.toLocaleString("fr-FR")} MAD` : undefined}
              onPress={() => { if (v) router.push(`/vehicle/${r.vehicleId}`); }}
              inlineActions={
                hasActions ? (
                  <KRow gap={8} wrap style={{ alignItems: "center" }}>
                    {needsPay && <CardAction label="Payer" icon="card-outline" variant={isDeleted ? "secondary" : "primary"} onPress={() => handlePay(r._id)} />}
                    {needsCheckin && <CardAction label="Constat départ" icon="camera-outline" variant={isDeleted ? "secondary" : "primary"} onPress={() => router.push(`/reservation/${r._id}/report?phase=checkin`)} />}
                    {needsCheckout && <CardAction label="Constat retour" icon="camera-outline" variant={isDeleted ? "secondary" : "primary"} onPress={() => router.push(`/reservation/${r._id}/report?phase=checkout`)} />}
                    {showReview && <CardAction label="Laisser un avis" icon="star-outline" variant="warning" onPress={() => router.push(`/review/${r._id}`)} />}
                    {canDispute && <CardAction label="Signaler un problème" icon="alert-circle-outline" variant="danger" onPress={() => router.push(`/dispute/${r._id}`)} />}
                    {isDisputed && <CardAction label="Litige en cours" icon="time-outline" variant="secondary" onPress={() => {}} />}
                    {cancellable && <CardAction label="Annuler" icon="close-circle-outline" variant="danger" onPress={() => handleCancel(r._id)} />}
                  </KRow>
                ) : undefined
              }
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  header: { alignItems: "center", paddingHorizontal: 16, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", alignItems: "center", justifyContent: "center" },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", minHeight: 36 },
  chipN: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6, backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)" },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA", alignItems: "center", justifyContent: "center" },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14, marginTop: 8 },
}));
