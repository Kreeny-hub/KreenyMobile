import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, FlatList, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { KText, KVStack, KRow, KPressable, KImage, createStyles } from "../../../src/ui";
import { skeletonPulse, haptic } from "../../../src/theme";
import { showErrorToast } from "../../../src/presentation/components/Toast";

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" }); } catch { return iso; }
}
function daysBetween(s: string, e: string) {
  try { return Math.max(1, Math.ceil((new Date(e).getTime() - new Date(s).getTime()) / 86_400_000)); } catch { return 1; }
}
function timeAgo(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d === 1) return "Hier";
  if (d < 7) return `Il y a ${d}j`;
  return `Il y a ${Math.floor(d / 7)} sem`;
}

type StatusType = "requested" | "accepted_pending_payment" | "confirmed" | "pickup_pending" | "in_progress" | "dropoff_pending" | "completed" | "cancelled" | "rejected";
const ACTIVE_STATUSES = new Set(["requested", "accepted_pending_payment", "confirmed", "pickup_pending", "in_progress", "dropoff_pending"]);

const STATUS_DISPLAY: Record<string, { label: string; color: string; darkColor: string; bg: string; darkBg: string }> = {
  requested:                { label: "En attente",      color: "#92400E", darkColor: "#FBBF24", bg: "#FEF3C7", darkBg: "rgba(251,191,36,0.12)" },
  accepted_pending_payment: { label: "À payer",         color: "#1E40AF", darkColor: "#60A5FA", bg: "#DBEAFE", darkBg: "rgba(96,165,250,0.12)" },
  confirmed:                { label: "Confirmée",       color: "#1E40AF", darkColor: "#60A5FA", bg: "#DBEAFE", darkBg: "rgba(96,165,250,0.12)" },
  pickup_pending:           { label: "Constat départ",  color: "#5B21B6", darkColor: "#A78BFA", bg: "#EDE9FE", darkBg: "rgba(167,139,250,0.12)" },
  in_progress:              { label: "En cours",        color: "#065F46", darkColor: "#34D399", bg: "#D1FAE5", darkBg: "rgba(52,211,153,0.12)" },
  dropoff_pending:          { label: "Constat retour",  color: "#5B21B6", darkColor: "#A78BFA", bg: "#EDE9FE", darkBg: "rgba(167,139,250,0.12)" },
  completed:                { label: "Terminée",        color: "#065F46", darkColor: "#34D399", bg: "#D1FAE5", darkBg: "rgba(52,211,153,0.12)" },
  cancelled:                { label: "Annulée",         color: "#991B1B", darkColor: "#F87171", bg: "#FEE2E2", darkBg: "rgba(248,113,113,0.12)" },
  rejected:                 { label: "Refusée",         color: "#991B1B", darkColor: "#F87171", bg: "#FEE2E2", darkBg: "rgba(248,113,113,0.12)" },
};

type FilterKey = "all" | "active" | "completed" | "cancelled";
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Tout" }, { key: "active", label: "En cours" },
  { key: "completed", label: "Terminées" }, { key: "cancelled", label: "Annulées" },
];

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function ScreenSkeleton() {
  const { colors } = useSkelStyles();
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => { skeletonPulse(p).start(); }, []);
  const op = p.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const B = ({ w, h, r = 10, style: st }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity: op }, st]} />
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ paddingHorizontal: 16, paddingTop: 16, gap: 16 }}>
        <KRow gap={8}><B w={40} h={40} r={12} /><B w="55%" h={18} /></KRow>
        <KRow gap={12}><B w={56} h={56} r={12} /><KVStack style={{ flex: 1, gap: 6 }}><B w="70%" h={14} /><B w="40%" h={12} /></KVStack></KRow>
        <KRow gap={10}><B w="48%" h={72} r={14} /><B w="48%" h={72} r={14} /></KRow>
        {[0, 1].map((i) => <B key={i} w="100%" h={110} r={16} />)}
      </View>
    </SafeAreaView>
  );
}
const useSkelStyles = createStyles((c) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// Stat Card
// ═══════════════════════════════════════════════════════
function StatCard({ label, value, icon, accent }: { label: string; value: string; icon: keyof typeof Ionicons.glyphMap; accent?: string }) {
  const { styles: ss, colors, isDark } = useStatStyles();
  return (
    <View style={ss.stat}>
      <View style={[ss.statIcon, accent ? { backgroundColor: isDark ? `${accent}1A` : `${accent}14` } : {}]}>
        <Ionicons name={icon} size={14} color={accent ?? colors.primary} />
      </View>
      <KText variant="label" bold style={{ fontSize: 16 }}>{value}</KText>
      <KText variant="caption" color="textSecondary" style={{ marginTop: 1 }}>{label}</KText>
    </View>
  );
}
const useStatStyles = createStyles((colors, isDark) => ({
  stat: {
    flex: 1, backgroundColor: colors.card, borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  statIcon: {
    width: 28, height: 28, borderRadius: 8, marginBottom: 6,
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center", justifyContent: "center",
  },
}));

// ═══════════════════════════════════════════════════════
// Reservation Card (redesigned)
// ═══════════════════════════════════════════════════════
function ReservationCard({ reservation, vehicle, isActive, accept, reject, markDropoff }: {
  reservation: any; vehicle: any; isActive: boolean; accept: any; reject: any; markDropoff: any;
}) {
  const { styles: cs, colors, isDark } = useCardStyles();
  const r = reservation;
  const status = r.status as StatusType;
  const days = daysBetween(r.startDate, r.endDate);
  const total = r.totalAmount ?? (vehicle?.pricePerDay ? vehicle.pricePerDay * days : null);
  const stDisplay = STATUS_DISPLAY[status];
  const stColor = isDark ? stDisplay?.darkColor : stDisplay?.color;
  const stBg = isDark ? stDisplay?.darkBg : stDisplay?.bg;

  const onAccept = () => Alert.alert("Accepter cette demande ?", "Le paiement sera ensuite requis.", [
    { text: "Annuler", style: "cancel" },
    { text: "Accepter", onPress: async () => { haptic.medium(); try { await accept({ reservationId: r._id }); } catch (e) { showErrorToast(e); } } },
  ]);
  const onReject = () => Alert.alert("Refuser cette demande ?", "Les dates seront libérées.", [
    { text: "Annuler", style: "cancel" },
    { text: "Refuser", style: "destructive", onPress: async () => { haptic.medium(); try { await reject({ reservationId: r._id }); } catch (e) { showErrorToast(e); } } },
  ]);
  const onMarkDropoff = () => Alert.alert("Déclarer le retour ?", "Un constat retour sera requis.", [
    { text: "Annuler", style: "cancel" },
    { text: "Confirmer", onPress: async () => { haptic.medium(); try { await markDropoff({ reservationId: r._id }); } catch (e) { showErrorToast(e); } } },
  ]);

  const hasAction = ["requested", "pickup_pending", "confirmed", "in_progress", "dropoff_pending"].includes(status);

  return (
    <View style={[cs.card, isActive && cs.cardActive]}>
      {/* Row 1: badge + timeAgo */}
      <KRow gap={8} style={{ alignItems: "center" }}>
        <View style={[cs.badge, { backgroundColor: stBg }]}>
          <KText variant="caption" bold style={{ fontSize: 10, color: stColor }}>{stDisplay?.label}</KText>
        </View>
        <KText variant="caption" color="textTertiary">{timeAgo(r.createdAt ?? r._creationTime)}</KText>
      </KRow>

      {/* Row 2: dates + amount */}
      <KRow justify="space-between" style={{ alignItems: "baseline", marginTop: 8 }}>
        <View style={{ flex: 1 }}>
          <KText variant="bodySmall">
            {fmtDate(r.startDate)} → {fmtDate(r.endDate)}
            <KText variant="caption" color="textSecondary"> · {days} jour{days > 1 ? "s" : ""}</KText>
          </KText>
        </View>
        {total != null && (
          <KText variant="label" bold style={{ fontSize: 15 }}>{total.toLocaleString("fr-FR")} MAD</KText>
        )}
      </KRow>

      {/* Row 3: payment status (if applicable) */}
      {r.paymentStatus && ["captured", "processing", "requires_action"].includes(r.paymentStatus) && (
        <KRow gap={5} style={{ alignItems: "center", marginTop: 8 }}>
          <Ionicons
            name={r.paymentStatus === "captured" ? "checkmark-circle" : "time-outline"}
            size={13}
            color={r.paymentStatus === "captured" ? "#10B981" : "#F59E0B"}
          />
          <KText variant="caption" color="textSecondary" style={{ fontSize: 12 }}>
            {r.paymentStatus === "captured" ? "Paiement reçu" : r.paymentStatus === "processing" ? "Paiement en cours" : "En attente de paiement"}
          </KText>
        </KRow>
      )}

      {/* Row 4: actions (compact, less dominant) */}
      {hasAction && (
        <KRow gap={8} style={{ marginTop: 10 }}>
          {status === "requested" && (
            <>
              <KPressable onPress={onAccept} style={[cs.actionBtn, cs.actionSuccess]}>
                <Ionicons name="checkmark" size={14} color="#059669" />
                <KText variant="caption" bold style={{ color: "#059669" }}>Accepter</KText>
              </KPressable>
              <KPressable onPress={onReject} style={[cs.actionBtn, cs.actionDanger]}>
                <Ionicons name="close" size={14} color="#DC2626" />
                <KText variant="caption" bold style={{ color: "#DC2626" }}>Refuser</KText>
              </KPressable>
            </>
          )}
          {(status === "pickup_pending" || status === "confirmed") && (
            <KPressable onPress={() => router.push(`/reservation/${r._id}/report?phase=checkin&role=owner`)} style={[cs.actionBtn, cs.actionPrimary]}>
              <Ionicons name="camera-outline" size={14} color={colors.primary} />
              <KText variant="caption" bold style={{ color: colors.primary }}>Constat départ</KText>
            </KPressable>
          )}
          {status === "in_progress" && (
            <KPressable onPress={onMarkDropoff} style={[cs.actionBtn, cs.actionPrimary]}>
              <Ionicons name="swap-horizontal-outline" size={14} color={colors.primary} />
              <KText variant="caption" bold style={{ color: colors.primary }}>Déclarer le retour</KText>
            </KPressable>
          )}
          {status === "dropoff_pending" && (
            <KPressable onPress={() => router.push(`/reservation/${r._id}/report?phase=checkout&role=owner`)} style={[cs.actionBtn, cs.actionPrimary]}>
              <Ionicons name="camera-outline" size={14} color={colors.primary} />
              <KText variant="caption" bold style={{ color: colors.primary }}>Constat retour</KText>
            </KPressable>
          )}
        </KRow>
      )}
    </View>
  );
}

const useCardStyles = createStyles((colors, isDark) => ({
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 14,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  cardActive: {
    borderColor: isDark ? "rgba(59,130,246,0.3)" : "rgba(59,130,246,0.15)",
    backgroundColor: isDark ? "rgba(59,130,246,0.04)" : "#FAFBFF",
  },
  badge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8,
  },
  actionPrimary: {
    backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.06)",
  },
  actionSuccess: {
    backgroundColor: isDark ? "rgba(5,150,105,0.1)" : "rgba(5,150,105,0.06)",
  },
  actionDanger: {
    backgroundColor: isDark ? "rgba(220,38,38,0.1)" : "rgba(220,38,38,0.06)",
  },
}));

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function OwnerVehicleReservations() {
  const { styles: s, colors, isDark } = useStyles();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const [filter, setFilter] = useState<FilterKey>("all");

  const vehicle = useQuery(api.vehicles.getVehicleById, vehicleId ? { id: vehicleId as any } : "skip");
  const reservations = useQuery(api.reservations.listReservationsForOwnerVehicle, vehicleId ? { vehicleId: vehicleId as any } : "skip");
  const accept = useMutation(api.reservations.acceptReservation);
  const reject = useMutation(api.reservations.rejectReservation);
  const markDropoff = useMutation(api.reservations.markDropoffPending);

  const counts = useMemo(() => {
    if (!reservations) return { all: 0, active: 0, completed: 0, cancelled: 0 };
    return {
      all: reservations.length,
      active: reservations.filter((r: any) => ACTIVE_STATUSES.has(r.status)).length,
      completed: reservations.filter((r: any) => r.status === "completed").length,
      cancelled: reservations.filter((r: any) => r.status === "cancelled" || r.status === "rejected").length,
    };
  }, [reservations]);

  const totalRevenue = useMemo(() => {
    if (!reservations || !vehicle) return 0;
    return reservations
      .filter((r: any) => r.status === "completed" || ACTIVE_STATUSES.has(r.status))
      .reduce((sum: number, r: any) => {
        const days = daysBetween(r.startDate, r.endDate);
        return sum + (r.totalAmount ?? vehicle.pricePerDay * days);
      }, 0);
  }, [reservations, vehicle]);

  const filtered = useMemo(() => {
    if (!reservations) return [];
    if (filter === "all") return reservations;
    if (filter === "active") return reservations.filter((r: any) => ACTIVE_STATUSES.has(r.status));
    if (filter === "completed") return reservations.filter((r: any) => r.status === "completed");
    return reservations.filter((r: any) => r.status === "cancelled" || r.status === "rejected");
  }, [reservations, filter]);

  if (!vehicleId) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
      <KText color="textSecondary">Véhicule introuvable</KText>
    </SafeAreaView>
  );
  if (reservations === undefined) return <ScreenSkeleton />;

  // Vehicle deleted
  if (vehicle === null) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KRow gap={8} style={s.header}>
        <KPressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <KText variant="label" bold style={{ fontSize: 17 }}>Annonce supprimée</KText>
      </KRow>
      <KVStack align="center" justify="center" style={{ flex: 1, padding: 32, gap: 12 }}>
        <View style={s.emptyCircle}>
          <Ionicons name="trash-outline" size={28} color="#EF4444" />
        </View>
        <KText variant="label" bold center>Cette annonce a été supprimée</KText>
        <KText variant="bodySmall" color="textSecondary" center style={{ lineHeight: 20, maxWidth: 280 }}>
          Les réservations liées ne sont plus accessibles.
        </KText>
        <KPressable onPress={() => router.back()} style={s.primaryBtn}>
          <KText variant="label" bold style={{ color: "#FFF" }}>Retour</KText>
        </KPressable>
      </KVStack>
    </SafeAreaView>
  );

  // ── Header data for FlatList ──
  const headerData = () => (
    <View style={{ gap: 14, paddingBottom: 12 }}>
      {/* ── Mini hero ── */}
      <KRow gap={12} style={{ alignItems: "center" }}>
        <View style={s.heroImage}>
          {vehicle?.coverUrl ? (
            <KImage source={{ uri: vehicle.coverUrl }} style={{ width: "100%", height: "100%" }} />
          ) : (
            <Ionicons name="car-outline" size={22} color={colors.textTertiary} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <KText variant="label" bold numberOfLines={1} style={{ fontSize: 16 }}>{vehicle?.title}</KText>
          <KRow gap={6} style={{ alignItems: "center", marginTop: 3 }}>
            <View style={[s.statusDot, { backgroundColor: vehicle?.isActive !== false ? "#10B981" : "#EF4444" }]} />
            <KText variant="caption" color="textSecondary">
              {vehicle?.isActive !== false ? "Active · en ligne" : "Désactivée"} · {vehicle?.city}
            </KText>
          </KRow>
        </View>
        <KPressable onPress={() => router.push(`/profile/availability/${vehicleId}`)} style={s.calendarBtn}>
          <Ionicons name="calendar" size={18} color={colors.primary} />
        </KPressable>
      </KRow>

      {/* ── Stats ── */}
      <KRow gap={10}>
        <StatCard label="Revenus" value={`${totalRevenue.toLocaleString("fr-FR")} MAD`} icon="wallet-outline" accent="#10B981" />
        <StatCard label="Réservations" value={String(counts.all)} icon="calendar-outline" />
      </KRow>

      {/* ── Filters ── */}
      {reservations && reservations.length > 0 && (
        <KRow gap={6}>
          {FILTERS.map((f) => {
            const on = filter === f.key;
            const c = counts[f.key];
            return (
              <KPressable key={f.key} onPress={() => { haptic.light(); setFilter(f.key); }}
                style={[s.chip, on && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                <KText variant="caption" bold style={{ fontSize: 12, color: on ? "#FFF" : colors.textSecondary }}>{f.label}</KText>
                {c > 0 && (
                  <View style={[s.chipCount, on && { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                    <KText variant="caption" bold style={{ fontSize: 10, color: on ? "#FFF" : colors.textTertiary }}>{c}</KText>
                  </View>
                )}
              </KPressable>
            );
          })}
        </KRow>
      )}
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Back button ── */}
      <KRow gap={8} style={s.header}>
        <KPressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <KText variant="label" bold style={{ fontSize: 17, flex: 1 }}>Gestion</KText>
      </KRow>

      {reservations.length === 0 ? (
        <View style={{ paddingHorizontal: 16 }}>
          {headerData()}
          <KVStack align="center" style={{ paddingTop: 40, gap: 12 }}>
            <View style={s.emptyCircle}><Ionicons name="calendar-outline" size={24} color={colors.textTertiary} /></View>
            <KText variant="label" bold center>Aucune réservation</KText>
            <KText variant="bodySmall" color="textSecondary" center style={{ lineHeight: 19, maxWidth: 260 }}>
              Ce véhicule n'a pas encore reçu de demandes.
            </KText>
          </KVStack>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item: any) => String(item._id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 10 }}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={headerData}
          ListEmptyComponent={
            <KVStack align="center" style={{ paddingTop: 32 }}>
              <KText variant="bodySmall" color="textSecondary" center>Aucune réservation dans cette catégorie.</KText>
            </KVStack>
          }
          renderItem={({ item }: any) => (
            <ReservationCard
              reservation={item}
              vehicle={vehicle}
              isActive={ACTIVE_STATUSES.has(item.status)}
              accept={accept}
              reject={reject}
              markDropoff={markDropoff}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  header: { alignItems: "center", paddingHorizontal: 16, height: 52 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", alignItems: "center", justifyContent: "center" },
  heroImage: {
    width: 56, height: 56, borderRadius: 14, overflow: "hidden",
    backgroundColor: isDark ? colors.bgTertiary : "#F0F2F5",
    alignItems: "center", justifyContent: "center",
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  calendarBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "#EFF6FF", alignItems: "center", justifyContent: "center" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    borderWidth: 1, borderColor: "transparent",
  },
  chipCount: {
    minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 4,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
    alignItems: "center", justifyContent: "center",
  },
  emptyCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA", alignItems: "center", justifyContent: "center" },
  primaryBtn: { backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14, marginTop: 8 },
}));
