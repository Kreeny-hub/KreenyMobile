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

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  requested: { text: "En attente", color: "#F59E0B" },
  accepted_pending_payment: { text: "Paiement en attente", color: "#3B82F6" },
  confirmed: { text: "Confirmée", color: "#10B981" },
  pickup_pending: { text: "Remise en cours", color: "#8B5CF6" },
  in_progress: { text: "En cours", color: "#10B981" },
  dropoff_pending: { text: "Retour en cours", color: "#F97316" },
  completed: { text: "Terminée", color: "#6B7280" },
  cancelled: { text: "Annulée", color: "#EF4444" },
  rejected: { text: "Refusée", color: "#EF4444" },
  disputed: { text: "Litige", color: "#DC2626" },
};

type FilterKey = "all" | "pending" | "active" | "done";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "pending", label: "En attente" },
  { key: "active", label: "En cours" },
  { key: "done", label: "Terminées" },
];
const PENDING_SET = new Set(["requested"]);
const ACTIVE_SET = new Set(["accepted_pending_payment", "confirmed", "pickup_pending", "in_progress", "dropoff_pending", "disputed"]);
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
// MAIN
// ═══════════════════════════════════════════════════════
export default function OwnerReservationsScreen() {
  const { styles: s, colors, isDark } = useStyles();
  const { isAuthenticated, isLoading } = useAuthStatus();
  const [filter, setFilter] = useState<FilterKey>("all");
  const raw = useQuery(api.reservations.listOwnerReservationsWithVehicle, isAuthenticated ? {} : "skip");
  const accept = useMutation(api.reservations.acceptReservation);
  const reject = useMutation(api.reservations.rejectReservation);
  const ownerCancel = useMutation(api.reservations.ownerCancelReservation);

  const filtered = useMemo(() => {
    if (!raw) return [];
    if (filter === "pending") return raw.filter((i: any) => PENDING_SET.has(i.reservation.status));
    if (filter === "active") return raw.filter((i: any) => ACTIVE_SET.has(i.reservation.status));
    if (filter === "done") return raw.filter((i: any) => DONE_SET.has(i.reservation.status));
    return raw;
  }, [raw, filter]);

  const counts = useMemo(() => {
    if (!raw) return { all: 0, pending: 0, active: 0, done: 0 };
    return {
      all: raw.length,
      pending: raw.filter((i: any) => PENDING_SET.has(i.reservation.status)).length,
      active: raw.filter((i: any) => ACTIVE_SET.has(i.reservation.status)).length,
      done: raw.filter((i: any) => DONE_SET.has(i.reservation.status)).length,
    };
  }, [raw]);

  if (isLoading || !raw) return <Skeleton />;

  const handleAccept = (id: string) => {
    Alert.alert("Accepter la demande ?", "Le locataire aura 2h pour effectuer le paiement.", [
      { text: "Non", style: "cancel" },
      { text: "Accepter", onPress: async () => {
        try { haptic.medium(); await accept({ reservationId: id as any }); showSuccessToast("Demande acceptée !"); }
        catch (e) { showErrorToast(e); }
      }},
    ]);
  };

  const handleReject = (id: string) => {
    Alert.alert("Refuser la demande ?", "Le locataire sera notifié. Cette action est irréversible.", [
      { text: "Non", style: "cancel" },
      { text: "Refuser", style: "destructive", onPress: async () => {
        try { await reject({ reservationId: id as any }); showSuccessToast("Demande refusée"); }
        catch (e) { showErrorToast(e); }
      }},
    ]);
  };

  const handleOwnerCancel = (id: string) => {
    Alert.alert("Annuler cette réservation ?", "Le locataire sera remboursé intégralement.", [
      { text: "Non", style: "cancel" },
      { text: "Annuler", style: "destructive", onPress: async () => {
        try { await ownerCancel({ reservationId: id as any }); showSuccessToast("Réservation annulée"); }
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
          <KText variant="label" bold style={{ fontSize: 17 }}>Réservations reçues</KText>
          {counts.pending > 0 && (
            <KText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
              {counts.pending} en attente · {counts.active} active{counts.active > 1 ? "s" : ""}
            </KText>
          )}
        </View>
      </KRow>

      {/* ── Filters ── */}
      {counts.all > 0 && (
        <KRow gap={8} style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const c = counts[f.key];
            return (
              <KPressable key={f.key} onPress={() => { haptic.light(); setFilter(f.key); }}
                style={[s.chip, on && { backgroundColor: colors.primary }]}>
                <KText variant="caption" bold style={{ fontSize: 12, color: on ? "#FFF" : colors.textSecondary }}>{f.label}</KText>
                {c > 0 && (
                  <View style={[s.chipN, on && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                    <KText variant="caption" bold style={{ fontSize: 10, color: on ? "#FFF" : colors.textTertiary }}>{c}</KText>
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
              <Ionicons name="car-outline" size={22} color={colors.textTertiary} />
            </View>
            <KText variant="label" bold center>
              {filter === "all" ? "Aucune réservation reçue" : filter === "pending" ? "Aucune demande en attente" : filter === "active" ? "Rien en cours" : "Aucune terminée"}
            </KText>
            <KText variant="bodySmall" color="textSecondary" center style={{ maxWidth: 260, lineHeight: 20 }}>
              {filter === "all" ? "Publie une annonce pour recevoir tes premières demandes de location." : "Les réservations apparaîtront ici."}
            </KText>
          </KVStack>
        }
        renderItem={({ item }) => {
          const r = item.reservation;
          const v = item.vehicle;
          const days = daysBetween(r.startDate, r.endDate);
          const total = r.totalAmount ?? (v ? days * v.pricePerDay : 0);
          const payout = r.ownerPayout ?? total;
          const st = r.status;
          const stInfo = STATUS_LABEL[st] ?? { text: st, color: "#6B7280" };

          const isPending = st === "requested";
          const canOwnerCancel = st === "confirmed" || st === "accepted_pending_payment";
          const needsCheckin = st === "pickup_pending" && !item.hasCheckinReport;
          const needsCheckout = st === "dropoff_pending" && !item.hasCheckoutReport;
          const showReview = st === "completed" && !item.hasReviewed;
          const isDisputed = st === "disputed";
          const hasActions = isPending || canOwnerCancel || needsCheckin || needsCheckout || showReview || isDisputed;

          const isDeleted = !v;

          return (
            <VehicleCardCompact
              coverUrl={v?.coverUrl}
              title={v ? v.title : "Annonce supprimée"}
              deleted={isDeleted}
              status={st}
              subtitle={`${fmtDate(r.startDate)} → ${fmtDate(r.endDate)} · ${days}j — ${item.renterName}`}
              statusLine={`${stInfo.text} · ${timeAgo(r.createdAt ?? r._creationTime)}`}
              statusLineColor={stInfo.color}
              priceLabel={payout > 0 ? `${payout.toLocaleString("fr-FR")} MAD` : undefined}
              onPress={() => { if (v) router.push(`/reservation/details/${r._id}`); }}
              inlineActions={
                hasActions ? (
                  <KRow gap={8} wrap style={{ alignItems: "center" }}>
                    {isPending && <CardAction label="Accepter" icon="checkmark-circle-outline" variant="primary" onPress={() => handleAccept(r._id)} />}
                    {isPending && <CardAction label="Refuser" icon="close-circle-outline" variant="danger" onPress={() => handleReject(r._id)} />}
                    {needsCheckin && <CardAction label="Constat départ" icon="camera-outline" variant="primary" onPress={() => router.push(`/reservation/${r._id}/report?phase=checkin`)} />}
                    {needsCheckout && <CardAction label="Constat retour" icon="camera-outline" variant="primary" onPress={() => router.push(`/reservation/${r._id}/report?phase=checkout`)} />}
                    {showReview && <CardAction label="Laisser un avis" icon="star-outline" variant="warning" onPress={() => router.push(`/review/${r._id}`)} />}
                    {isDisputed && <CardAction label="Litige en cours" icon="time-outline" variant="secondary" onPress={() => router.push(`/dispute/${r._id}`)} />}
                    {canOwnerCancel && <CardAction label="Annuler" icon="close-circle-outline" variant="danger" onPress={() => handleOwnerCancel(r._id)} />}
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
}));
