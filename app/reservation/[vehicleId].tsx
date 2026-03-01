import { useEffect, useRef, useState } from "react";
import { Animated, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { ensureAuth } from "../../src/presentation/utils/ensureAuth";
import { container } from "../../src/shared/config/container";
import { formatDateFR } from "../../src/shared/utils/formatDateFR";
import CalendarModal from "../../src/presentation/components/CalendarModal";
import { useUnavailableRanges } from "../../src/presentation/hooks/useUnavailableRanges";
import { KText, KVStack, KRow, KPressable, KImage, createStyles } from "../../src/ui";
import { haptic } from "../../src/theme";
import { SafeAreaView } from "react-native-safe-area-context";
import { showErrorToast } from "../../src/presentation/components/Toast";

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function computeDays(start: string, end: string) {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const diff = new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
  return diff > 0 ? Math.round(diff / 86400000) : 0;
}
function moneyMAD(n: number) { return `${Math.round(n)} MAD`; }

// ═══════════════════════════════════════════════════════
// Card wrapper
// ═══════════════════════════════════════════════════════
function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  const { styles: s } = useCardWrapStyles();
  return <View style={[s.card, style]}>{children}</View>;
}
const useCardWrapStyles = createStyles((colors, isDark) => ({
  card: { backgroundColor: colors.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)" },
}));

// ═══════════════════════════════════════════════════════
// Vehicle Summary
// ═══════════════════════════════════════════════════════
function VehicleSummary({ vehicle, coverUrl }: { vehicle: any; coverUrl: string | null }) {
  const { styles, colors } = useSummaryStyles();
  return (
    <Card>
      <KRow gap="md">
        {coverUrl ? (
          <KImage source={{ uri: coverUrl }} style={styles.thumb} />
        ) : (
          <View style={styles.thumbEmpty}><Ionicons name="car-sport-outline" size={24} color={colors.textTertiary} /></View>
        )}
        <KVStack justify="center" style={{ flex: 1 }}>
          <KText variant="label" bold numberOfLines={1}>{vehicle.title}</KText>
          <KRow gap={4} style={{ alignItems: "center", marginTop: 4 }}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <KText variant="bodySmall" color="textSecondary">{vehicle.city}</KText>
          </KRow>
          <KText variant="label" bold style={{ color: colors.primary, marginTop: 4 }}>
            {vehicle.pricePerDay} MAD <KText variant="caption" color="textSecondary">/ jour</KText>
          </KText>
        </KVStack>
      </KRow>
    </Card>
  );
}
const useSummaryStyles = createStyles((colors, isDark) => ({
  thumb: { width: 90, height: 70, borderRadius: 12, backgroundColor: colors.bgTertiary },
  thumbEmpty: { width: 90, height: 70, borderRadius: 12, backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA", alignItems: "center", justifyContent: "center" },
}));

// ═══════════════════════════════════════════════════════
// Date Selector Card
// ═══════════════════════════════════════════════════════
function DateSelector({ startDate, endDate, startTime, endTime, days, onPress }: any) {
  const { styles, colors, isDark } = useDateStyles();
  const hasSelection = startDate && endDate && days > 0;
  return (
    <KPressable onPress={onPress}>
      <Card>
        <KRow justify="space-between" style={{ alignItems: "center", marginBottom: 14 }}>
          <KText variant="label" bold>Dates de location</KText>
          <View style={styles.daysBadge}>
            <KText variant="caption" bold style={{ color: colors.primary }}>{hasSelection ? `${days} jour${days > 1 ? "s" : ""}` : "Choisir"}</KText>
          </View>
        </KRow>
        <KRow gap="sm">
          <KVStack gap={4} style={styles.dateBox}>
            <KText variant="caption" color="textTertiary" bold style={{ fontSize: 11 }}>DÉPART</KText>
            <KText variant="label" bold>{startDate ? formatDateFR(startDate) : "Sélectionner"}</KText>
            <KText variant="caption" color="textSecondary">{startTime}</KText>
          </KVStack>
          <View style={{ justifyContent: "center" }}><Ionicons name="arrow-forward" size={18} color={colors.textTertiary} /></View>
          <KVStack gap={4} style={styles.dateBox}>
            <KText variant="caption" color="textTertiary" bold style={{ fontSize: 11 }}>RETOUR</KText>
            <KText variant="label" bold>{endDate ? formatDateFR(endDate) : "Sélectionner"}</KText>
            <KText variant="caption" color="textSecondary">{endTime}</KText>
          </KVStack>
        </KRow>
        <KRow gap={6} style={{ marginTop: 12, alignItems: "center" }}>
          <Ionicons name="calendar-outline" size={14} color={colors.primary} />
          <KText variant="caption" bold style={{ color: colors.primary }}>Appuyer pour modifier les dates</KText>
        </KRow>
      </Card>
    </KPressable>
  );
}
const useDateStyles = createStyles((colors, isDark) => ({
  daysBadge: { backgroundColor: colors.primaryLight, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  dateBox: { flex: 1, padding: 12, borderRadius: 14, backgroundColor: isDark ? colors.bgTertiary : "#F7F8FA" },
}));

// ═══════════════════════════════════════════════════════
// Pricing Breakdown
// ═══════════════════════════════════════════════════════
function PricingBreakdown({ days, pricePerDay, deposit }: { days: number; pricePerDay: number; deposit: number }) {
  const { styles, colors } = usePricingStyles();
  const subtotal = days > 0 ? days * pricePerDay : 0;
  const serviceFee = Math.round(subtotal * 0.08); // 8% — synced with config.ts
  const total = subtotal + serviceFee;
  return (
    <Card>
      <KText variant="label" bold style={{ marginBottom: 14 }}>Récapitulatif</KText>
      <KRow justify="space-between" style={{ marginBottom: 10 }}>
        <KText variant="body" color="textSecondary">{days > 0 ? `${days} jour${days > 1 ? "s" : ""} × ${moneyMAD(pricePerDay)}` : "Sélectionne tes dates"}</KText>
        <KText variant="body" bold>{moneyMAD(subtotal)}</KText>
      </KRow>
      {subtotal > 0 && (
        <KRow justify="space-between" style={{ marginBottom: 10 }}>
          <KText variant="body" color="textSecondary">Frais de service</KText>
          <KText variant="body" bold>{moneyMAD(serviceFee)}</KText>
        </KRow>
      )}
      {deposit > 0 && (
        <KRow justify="space-between" style={{ marginBottom: 10 }}>
          <KText variant="body" color="textSecondary">Caution (empreinte)</KText>
          <KText variant="body" bold>{moneyMAD(deposit)}</KText>
        </KRow>
      )}
      <View style={styles.divider} />
      <KRow justify="space-between" style={{ alignItems: "center" }}>
        <KText variant="label" bold>À payer maintenant</KText>
        <KText variant="h3" bold style={{ color: colors.primary }}>{moneyMAD(total)}</KText>
      </KRow>
      {deposit > 0 && <KText variant="caption" color="textTertiary" style={{ lineHeight: 17, marginTop: 10 }}>La caution est une empreinte bancaire non débitée, libérée après restitution du véhicule sans dommage.</KText>}
    </Card>
  );
}
const usePricingStyles = createStyles((colors, isDark) => ({
  divider: { height: 1, backgroundColor: isDark ? colors.border : "#EFEFEF", marginVertical: 10 },
}));

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function ReservationSkeleton() {
  const { colors } = useSkeletonStyles();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true })])).start(); }, []);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const Box = ({ w, h, r = 8, style: s }: any) => <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, s]} />;
  return <View style={{ flex: 1, backgroundColor: colors.bg, padding: 18, gap: 14 }}><Box w="100%" h={90} r={18} /><Box w="100%" h={140} r={18} /><Box w="100%" h={160} r={18} /></View>;
}
const useSkeletonStyles = createStyles((colors) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function Reservation() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { isAuthenticated } = useAuthStatus();
  const { ranges: unavailableRanges } = useUnavailableRanges(vehicleId ?? "");

  const vehicle = useQuery(api.vehicles.getVehicleWithImages, vehicleId ? { id: vehicleId as any } : "skip");
  const coverUrl = vehicle?.resolvedImageUrls?.[0] ?? null;

  const [startDate, setStartDate] = useState(""); const [endDate, setEndDate] = useState("");
  const [startTime, setStartTime] = useState("10:00"); const [endTime, setEndTime] = useState("18:00");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!vehicleId) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 18 }}><KText color="textSecondary">Paramètre manquant</KText></SafeAreaView>;
  if (vehicle === undefined) return <ReservationSkeleton />;
  if (vehicle === null) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 12 }}>
      <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
      <KText variant="label" bold>Annonce introuvable</KText>
      <KPressable onPress={() => router.back()}><KText variant="body" bold style={{ color: colors.primary }}>Retour</KText></KPressable>
    </SafeAreaView>
  );

  const pricePerDay = vehicle.pricePerDay ?? 0;
  const deposit = vehicle.depositSelected ?? vehicle.depositMin ?? 0;

  // ── Cancellation policy info ──
  const CANCEL_POLICY_MAP: Record<string, { label: string; desc: string; icon: string; color: string }> = {
    flexible: { label: "Flexible", desc: "Gratuit jusqu'à 24h avant", icon: "shield-checkmark-outline", color: "#10B981" },
    moderate: { label: "Modérée", desc: "Gratuit jusqu'à 3 jours avant", icon: "shield-half-outline", color: "#F59E0B" },
    strict:   { label: "Stricte", desc: "Gratuit jusqu'à 7 jours avant", icon: "lock-closed-outline", color: "#EF4444" },
  };
  const cancelPolicyInfo = CANCEL_POLICY_MAP[(vehicle as any).cancellationPolicy ?? "moderate"] ?? CANCEL_POLICY_MAP.moderate;
  const days = startDate && endDate ? computeDays(startDate, endDate) : 0;
  const subtotal = days > 0 ? days * pricePerDay : 0;
  const canConfirm = days > 0 && status !== "loading";

  const onConfirm = async () => {
    haptic.heavy();
    if (!ensureAuth(isAuthenticated)) return;
    if (!vehicleId || !startDate || !endDate || days <= 0) return;
    try { setStatus("loading"); setErrorMsg(""); await container.reservationRepository.createReservation({ vehicleId, startDate, endDate }); setStatus("success"); haptic.success(); }
    catch (e) { setStatus("error"); showErrorToast(e); haptic.error(); }
  };

  if (status === "success") return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.successCircle}><Ionicons name="checkmark-circle" size={40} color="#10B981" /></View>
      <KText variant="h3" bold center>Demande envoyée !</KText>
      <KText variant="body" color="textSecondary" center style={{ lineHeight: 20 }}>Le propriétaire va examiner ta demande. Tu recevras une notification dès qu'il aura répondu.</KText>
      <KVStack gap="sm" style={{ width: "100%", marginTop: 8 }}>
        <KPressable onPress={() => router.replace("/profile/reservations")} style={styles.primaryBtn}><KText variant="label" bold color="textInverse">Voir mes réservations</KText></KPressable>
        <KPressable onPress={() => router.back()} style={styles.secondaryBtn}><KText variant="label" bold>Retour à l'annonce</KText></KPressable>
      </KVStack>
    </SafeAreaView>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Custom Header ── */}
      <View style={[styles.customHeader, { paddingTop: insets.top + 6 }]}>
        <KPressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </KPressable>
        <KText variant="label" bold style={{ fontSize: 17 }}>Réservation</KText>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: Math.max(insets.bottom, 12) + 110, gap: 14 }}>
        <VehicleSummary vehicle={vehicle} coverUrl={coverUrl} />
        <DateSelector startDate={startDate} endDate={endDate} startTime={startTime} endTime={endTime} days={days} onPress={() => setCalendarOpen(true)} />
        <PricingBreakdown days={days} pricePerDay={pricePerDay} deposit={deposit} />

        {/* Trust reassurance */}
        <KVStack gap={12} style={styles.trustBox}>
          <KRow gap={10} style={{ alignItems: "center" }}>
            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            <KText variant="bodySmall" bold>Paiement 100% sécurisé</KText>
          </KRow>
          <KRow gap={10} style={{ alignItems: "center" }}>
            <Ionicons name={cancelPolicyInfo.icon as any} size={16} color={cancelPolicyInfo.color} />
            <KText variant="bodySmall">
              <KText variant="bodySmall" bold>Annulation {cancelPolicyInfo.label}</KText> — {cancelPolicyInfo.desc}
            </KText>
          </KRow>
          <KRow gap={10} style={{ alignItems: "center" }}>
            <Ionicons name="camera" size={16} color="#3B82F6" />
            <KText variant="bodySmall">Constat photo obligatoire = 0 litige</KText>
          </KRow>
        </KVStack>

        <KRow gap="sm" style={styles.infoHint}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <KText variant="bodySmall" color="textSecondary" style={{ flex: 1, lineHeight: 18 }}>
            Ta demande sera envoyée au propriétaire qui aura 24h pour accepter ou refuser. Le paiement n'est prélevé qu'après acceptation.
          </KText>
        </KRow>

        {status === "error" && errorMsg ? (
          <KRow gap="sm" style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <KText variant="bodySmall" bold style={{ flex: 1, color: "#DC2626" }}>{errorMsg}</KText>
          </KRow>
        ) : null}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
        <View style={{ flex: 1 }}>
          {days > 0 ? (
            <><KText variant="displaySmall" bold style={{ fontSize: 22 }}>{moneyMAD(subtotal + Math.round(subtotal * 0.08))}</KText><KText variant="caption" color="textSecondary" style={{ marginTop: 3 }}>{days} jour{days > 1 ? "s" : ""} · frais inclus</KText></>
          ) : (
            <KText variant="body" color="textSecondary">Sélectionne tes dates</KText>
          )}
        </View>
        <KPressable onPress={canConfirm ? onConfirm : () => setCalendarOpen(true)}
          style={[styles.ctaBtn, { backgroundColor: canConfirm ? colors.primary : colors.bgTertiary }]}>
          <KText variant="label" bold style={{ color: canConfirm ? "#FFF" : colors.textSecondary }}>
            {status === "loading" ? "Envoi..." : canConfirm ? "Confirmer" : "Voir le calendrier"}
          </KText>
        </KPressable>
      </View>

      <CalendarModal visible={calendarOpen} onClose={() => setCalendarOpen(false)} pricePerDay={pricePerDay}
        unavailableRanges={unavailableRanges} availableFrom={null} availableUntil={null}
        onConfirm={({ startDate: s, endDate: e, startTime: st, endTime: et }) => { setStartDate(s); setEndDate(e); setStartTime(st); setEndTime(et); }} />
    </View>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  customHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 10,
    backgroundColor: colors.bg,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  successCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  secondaryBtn: { backgroundColor: colors.card, borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)" },
  infoHint: { backgroundColor: isDark ? colors.bgTertiary : "#F7F8FA", borderRadius: 14, padding: 14, alignItems: "flex-start" },
  trustBox: { backgroundColor: isDark ? colors.bgTertiary : "#F8FBF9", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(16,185,129,0.08)" },
  errorBox: { backgroundColor: "#FEF2F2", borderRadius: 14, padding: 14, alignItems: "center" },
  stickyBar: {
    position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
    paddingHorizontal: 18, paddingTop: 14,
    flexDirection: "row", alignItems: "center", gap: 16,
  },
  ctaBtn: { height: 50, paddingHorizontal: 24, borderRadius: 16, alignItems: "center", justifyContent: "center" },
}));
