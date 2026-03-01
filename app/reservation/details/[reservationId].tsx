import { ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../../convex/_generated/api";
import { KText, KVStack, KRow, KPressable, KImage, createStyles } from "../../../src/ui";
import { formatDateFR } from "../../../src/shared/utils/formatDateFR";

// ══════════════════════════════════════════════════════════
// Timeline steps
// ══════════════════════════════════════════════════════════
const STEPS = [
  { key: "requested",                label: "Demande envoyée",     icon: "paper-plane" },
  { key: "accepted_pending_payment", label: "Demande acceptée",    icon: "checkmark-circle" },
  { key: "confirmed",                label: "Paiement confirmé",   icon: "card" },
  { key: "pickup_pending",           label: "Constat de départ",   icon: "camera" },
  { key: "in_progress",              label: "Location en cours",   icon: "car-sport" },
  { key: "dropoff_pending",          label: "Constat de retour",   icon: "flag" },
  { key: "completed",                label: "Terminée",            icon: "checkmark-done-circle" },
];

function getStepIndex(status: string) {
  if (status === "cancelled" || status === "rejected") return -1;
  const idx = STEPS.findIndex((s) => s.key === status);
  return idx >= 0 ? idx : 0;
}

// ══════════════════════════════════════════════════════════
// Timeline
// ══════════════════════════════════════════════════════════
function Timeline({ status }: { status: string }) {
  const { styles: s, colors } = useTimelineStyles();
  const currentIdx = getStepIndex(status);
  const isCancelled = status === "cancelled" || status === "rejected";

  return (
    <View style={s.container}>
      {STEPS.map((step, idx) => {
        const isDone = !isCancelled && idx <= currentIdx;
        const isCurrent = !isCancelled && idx === currentIdx;
        const isLast = idx === STEPS.length - 1;
        const dotColor = isDone ? colors.primary : (isCancelled ? "#EF4444" : colors.bgTertiary);
        return (
          <View key={step.key} style={s.row}>
            {/* Dot + Line */}
            <View style={s.dotCol}>
              <View style={[
                s.dot,
                { backgroundColor: dotColor },
                isCurrent && s.dotCurrent,
              ]}>
                <Ionicons
                  name={step.icon as any}
                  size={isCurrent ? 14 : 12}
                  color={isDone ? "#FFF" : colors.textTertiary}
                />
              </View>
              {!isLast && (
                <View style={[s.line, { backgroundColor: isDone && idx < currentIdx ? colors.primary : "#E5E7EB" }]} />
              )}
            </View>
            {/* Label */}
            <KVStack style={s.labelCol}>
              <KText
                variant={isCurrent ? "label" : "bodySmall"}
                bold={isCurrent}
                style={{ color: isDone ? colors.text : colors.textTertiary }}
              >
                {step.label}
              </KText>
            </KVStack>
          </View>
        );
      })}

      {/* Cancelled/rejected overlay */}
      {isCancelled && (
        <View style={s.cancelledBanner}>
          <Ionicons name="close-circle" size={16} color="#EF4444" />
          <KText variant="label" bold style={{ color: "#EF4444" }}>
            {status === "cancelled" ? "Réservation annulée" : "Demande refusée"}
          </KText>
        </View>
      )}
    </View>
  );
}

const useTimelineStyles = createStyles((colors, isDark) => ({
  container: { paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "flex-start" },
  dotCol: { width: 36, alignItems: "center" },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  dotCurrent: {
    width: 32, height: 32, borderRadius: 16,
    shadowColor: colors.primary, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 4,
  },
  line: { width: 2, height: 28, borderRadius: 1, marginVertical: 4 },
  labelCol: { flex: 1, paddingLeft: 12, paddingBottom: 18, justifyContent: "center", minHeight: 28 },
  cancelledBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    marginTop: 12, paddingVertical: 10, paddingHorizontal: 14,
    backgroundColor: "rgba(239,68,68,0.08)", borderRadius: 12,
  },
}));

// ══════════════════════════════════════════════════════════
// Main Screen
// ══════════════════════════════════════════════════════════
export default function ReservationDetailsScreen() {
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();

  const reservation = useQuery(
    api.reservations.getReservation,
    reservationId ? { id: reservationId as any } : "skip"
  );

  if (!reservation) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <KText variant="body" color="textSecondary">Chargement…</KText>
      </View>
    );
  }

  const days = reservation.startDate && reservation.endDate
    ? Math.max(1, Math.round(
        (new Date(reservation.endDate + "T00:00:00").getTime() - new Date(reservation.startDate + "T00:00:00").getTime()) / 86400000
      ))
    : 0;
  const pricePerDay = reservation.vehicle ? Math.round((reservation.totalAmount ?? 0) / Math.max(days, 1)) : 0;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <KRow gap={12} style={styles.header}>
          <KPressable onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </KPressable>
          <KText variant="label" bold style={styles.headerTitle}>Détails de la réservation</KText>
          <View style={{ width: 36 }} />
        </KRow>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          {/* Vehicle card */}
          {reservation.vehicle && (
            <KPressable
              onPress={() => router.push(`/vehicle/${reservation.vehicleId}`)}
              style={styles.vehicleCard}
            >
              {reservation.vehicle.coverUrl ? (
                <KImage source={{ uri: reservation.vehicle.coverUrl }} style={styles.vehicleCover} />
              ) : (
                <View style={[styles.vehicleCover, styles.vehicleCoverEmpty]}>
                  <Ionicons name="car-outline" size={28} color={colors.textTertiary} />
                </View>
              )}
              <KVStack gap={4} style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
                <KText variant="label" bold style={{ fontSize: 16 }}>{reservation.vehicle.title}</KText>
                <KRow gap={4} align="center">
                  <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                  <KText variant="bodySmall" color="textSecondary">{reservation.vehicle.city}</KText>
                </KRow>
              </KVStack>
            </KPressable>
          )}

          {/* Dates */}
          <View style={styles.section}>
            <KText variant="label" bold style={styles.sectionTitle}>Dates</KText>
            <KRow gap={12} style={styles.datesRow}>
              <KVStack flex={1} gap={2} style={styles.dateBox}>
                <KText variant="caption" color="textSecondary">Début</KText>
                <KText variant="label" bold>{reservation.startDate ? formatDateFR(reservation.startDate) : "—"}</KText>
              </KVStack>
              <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
              <KVStack flex={1} gap={2} style={styles.dateBox}>
                <KText variant="caption" color="textSecondary">Fin</KText>
                <KText variant="label" bold>{reservation.endDate ? formatDateFR(reservation.endDate) : "—"}</KText>
              </KVStack>
              <KVStack gap={2} align="center" style={styles.dateBox}>
                <KText variant="caption" color="textSecondary">Durée</KText>
                <KText variant="label" bold>{days} jour{days > 1 ? "s" : ""}</KText>
              </KVStack>
            </KRow>
          </View>

          {/* Timeline */}
          <View style={styles.section}>
            <KText variant="label" bold style={styles.sectionTitle}>Suivi de la réservation</KText>
            <Timeline status={reservation.status} />
          </View>

          {/* Price breakdown */}
          <View style={styles.section}>
            <KText variant="label" bold style={styles.sectionTitle}>Récapitulatif</KText>
            <View style={styles.priceCard}>
              <KRow style={styles.priceLine}>
                <KText variant="bodySmall" color="textSecondary">
                  {pricePerDay > 0 ? `${pricePerDay} MAD × ${days} jour${days > 1 ? "s" : ""}` : "Sous-total"}
                </KText>
                <KText variant="bodySmall">{reservation.totalAmount ? `${reservation.totalAmount} MAD` : "—"}</KText>
              </KRow>
              {reservation.commissionAmount ? (
                <KRow style={styles.priceLine}>
                  <KText variant="bodySmall" color="textSecondary">Frais de service</KText>
                  <KText variant="bodySmall">{reservation.commissionAmount} MAD</KText>
                </KRow>
              ) : null}
              {reservation.depositAmount ? (
                <KRow style={styles.priceLine}>
                  <KText variant="bodySmall" color="textSecondary">Caution</KText>
                  <KText variant="bodySmall">{reservation.depositAmount} MAD</KText>
                </KRow>
              ) : null}
              <View style={styles.priceDivider} />
              <KRow style={styles.priceLine}>
                <KText variant="label" bold>Total</KText>
                <KText variant="label" bold style={{ color: colors.primary }}>
                  {reservation.totalAmount ? `${reservation.totalAmount} MAD` : "—"}
                </KText>
              </KRow>
              {/* Payment status */}
              {reservation.paymentStatus && reservation.paymentStatus !== "unpaid" && (
                <KRow gap={6} style={styles.paymentStatus}>
                  <Ionicons
                    name={reservation.paymentStatus === "captured" ? "checkmark-circle" : "time-outline"}
                    size={14}
                    color={reservation.paymentStatus === "captured" ? "#10B981" : "#F59E0B"}
                  />
                  <KText variant="caption" style={{
                    color: reservation.paymentStatus === "captured" ? "#10B981" : "#F59E0B",
                  }}>
                    {reservation.paymentStatus === "captured" ? "Paiement validé" :
                     reservation.paymentStatus === "processing" ? "Paiement en cours" :
                     reservation.paymentStatus === "requires_action" ? "Action requise" :
                     reservation.paymentStatus === "failed" ? "Paiement échoué" : ""}
                  </KText>
                </KRow>
              )}
            </View>
          </View>

          {/* Reservation ID */}
          <View style={styles.section}>
            <KRow gap={6} align="center" style={{ opacity: 0.5 }}>
              <Ionicons name="receipt-outline" size={13} color={colors.textTertiary} />
              <KText variant="caption" color="textTertiary">Réf: {String(reservation._id).slice(-8).toUpperCase()}</KText>
            </KRow>
          </View>
        </ScrollView>
      </View>
    </>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg },
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: 16, paddingVertical: 10, alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "center" },
  scrollContent: { paddingBottom: 40 },

  // Vehicle
  vehicleCard: {
    margin: 16, borderRadius: 16, overflow: "hidden",
    backgroundColor: isDark ? colors.bgTertiary : "#FFF",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  vehicleCover: { width: "100%", height: 160, backgroundColor: colors.bgTertiary },
  vehicleCoverEmpty: { alignItems: "center", justifyContent: "center" },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: { marginBottom: 12 },

  // Dates
  datesRow: { alignItems: "center" },
  dateBox: {
    paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12,
    backgroundColor: isDark ? colors.bgTertiary : "#F9FAFB",
  },

  // Price
  priceCard: {
    borderRadius: 16, padding: 16,
    backgroundColor: isDark ? colors.bgTertiary : "#F9FAFB",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
    gap: 10,
  },
  priceLine: { justifyContent: "space-between", alignItems: "center" },
  priceDivider: {
    height: 1, backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
    marginVertical: 4,
  },
  paymentStatus: {
    alignItems: "center", paddingTop: 4,
  },
}));
