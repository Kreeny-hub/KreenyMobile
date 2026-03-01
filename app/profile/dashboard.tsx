import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { router, Stack } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Animated, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { shadows, skeletonPulse, staggeredEntrance, fadeUpStyle, haptic } from "../../src/theme";
import { KText, KVStack, KRow, KPressable, KDivider, KImage, createStyles } from "../../src/ui";
import { showErrorToast, showSuccessToast } from "../../src/presentation/components/Toast";

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bonjour";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}
function formatDateShort(dateStr: string): string {
  const [_y, m, d] = dateStr.split("-").map(Number);
  const months = ["jan", "fév", "mars", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"];
  return `${d} ${months[m - 1]}`;
}
type StatusConfig = { label: string; icon: keyof typeof Ionicons.glyphMap; color: string; bgColor: string };
function getStatusConfig(status: string, isDark: boolean): StatusConfig {
  const configs: Record<string, StatusConfig> = {
    requested: { label: "En attente", icon: "time-outline", color: "#F59E0B", bgColor: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7" },
    accepted_pending_payment: { label: "Paiement requis", icon: "card-outline", color: "#8B5CF6", bgColor: isDark ? "rgba(139,92,246,0.15)" : "#F5F3FF" },
    pickup_pending: { label: "Constat départ", icon: "camera-outline", color: "#3B82F6", bgColor: isDark ? "rgba(59,130,246,0.15)" : "#EFF6FF" },
    in_progress: { label: "En cours", icon: "car-outline", color: "#10B981", bgColor: isDark ? "rgba(16,185,129,0.15)" : "#ECFDF5" },
    dropoff_pending: { label: "Constat retour", icon: "camera-reverse-outline", color: "#8B5CF6", bgColor: isDark ? "rgba(139,92,246,0.15)" : "#F5F3FF" },
  };
  return configs[status] ?? { label: status, icon: "help-circle-outline", color: "#6B7280", bgColor: "#F3F4F6" };
}

// ═══════════════════════════════════════════════════════
// Stat Card
// ═══════════════════════════════════════════════════════
function StatCard({ icon, label, count, highlight, onPress, suffix }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; count: number; highlight?: boolean; onPress?: () => void; suffix?: string;
}) {
  const { styles, colors, isDark } = useStatStyles();
  const display = suffix ? `${count.toLocaleString("fr-FR")}` : String(count);
  const isActive = count > 0;
  return (
    <KPressable testID={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`} onPress={onPress}
      style={[styles.card, !isDark && shadows.sm]}>
      <View style={[styles.iconBox, isActive && { backgroundColor: isDark ? "rgba(59,130,246,0.15)" : colors.primaryLight }]}>
        <Ionicons name={icon} size={17} color={isActive ? colors.primary : colors.textTertiary} />
      </View>
      <KText numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}
        style={{
          fontSize: suffix ? 22 : 28, lineHeight: suffix ? 30 : 36,
          fontWeight: "900", letterSpacing: -0.5, marginTop: 8,
          color: highlight && isActive ? colors.primary : isActive ? colors.text : colors.textTertiary,
        }}>
        {display}{suffix || ""}
      </KText>
      <KText variant="caption" color={isActive ? "textSecondary" : "textTertiary"} style={{ marginTop: 3 }}>{label}</KText>
    </KPressable>
  );
}
const useStatStyles = createStyles((colors, isDark) => ({
  card: {
    flex: 1, backgroundColor: colors.card, borderRadius: 18, padding: 14, paddingBottom: 16, minHeight: 120,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
  },
  iconBox: {
    width: 36, height: 36, borderRadius: 11,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", alignItems: "center", justifyContent: "center",
  },
}));

// ═══════════════════════════════════════════════════════
// Menu Row
// ═══════════════════════════════════════════════════════
function MenuRow({ icon, label, sublabel, badge, onPress }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; sublabel?: string; badge?: number; onPress?: () => void;
}) {
  const { styles, colors } = useMenuStyles();
  return (
    <KPressable testID={`menu-row-${label.toLowerCase().replace(/\s/g, "-")}`} onPress={onPress} style={styles.row}>
      <View style={styles.iconBox}><Ionicons name={icon} size={19} color={colors.primary} /></View>
      <View style={{ flex: 1 }}>
        <KText variant="label">{label}</KText>
        {sublabel && <KText variant="caption" color="textTertiary" style={{ marginTop: 1 }}>{sublabel}</KText>}
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}><KText variant="caption" bold color="textInverse" style={{ fontSize: 11 }}>{badge}</KText></View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </KPressable>
  );
}
const useMenuStyles = createStyles((colors) => ({
  row: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  badge: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
}));

// ═══════════════════════════════════════════════════════
// Reservation Item — rich card with inline actions
// ═══════════════════════════════════════════════════════
function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return "À l'instant";
  if (m < 60) return `Il y a ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Il y a ${h}h`;
  return `Il y a ${Math.floor(h / 24)}j`;
}

function ReservationItem({ reservation: r, isDark, colors, onAccept, onReject, onMessage }: {
  reservation: any; isDark: boolean; colors: any;
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  onMessage?: (vehicleId: string) => void;
}) {
  const status = getStatusConfig(r.status, isDark);
  const days = computeDays(r.startDate, r.endDate);
  const total = days * (r.vehiclePricePerDay || 0);
  const isRequested = r.status === "requested";

  return (
    <View style={{
      marginBottom: 10, backgroundColor: isRequested ? (isDark ? "rgba(245,158,11,0.04)" : "#FFFCF5") : colors.card,
      borderRadius: 16, overflow: "hidden",
      borderWidth: 1, borderColor: isRequested ? (isDark ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.18)") : (isDark ? colors.cardBorder : "rgba(0,0,0,0.05)"),
    }}>
      <KPressable onPress={() => router.push(`/profile/listings/${r.vehicleId}`)} style={{ padding: 12 }}>
        <KRow gap={12} style={{ alignItems: "center" }}>
          {/* Cover */}
          <View style={{ width: 52, height: 52, borderRadius: 12, overflow: "hidden", backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA" }}>
            {r.coverUrl ? (
              <KImage source={{ uri: r.coverUrl }} style={{ width: 52, height: 52 }} />
            ) : (
              <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="car-outline" size={20} color={colors.textTertiary} />
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            {/* Title + badge row */}
            <KRow justify="space-between" gap="sm" style={{ alignItems: "center" }}>
              <KText variant="label" bold numberOfLines={1} style={{ flex: 1 }}>{r.vehicleTitle}</KText>
              <KRow gap={4} style={{ backgroundColor: status.bgColor, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 }}>
                <Ionicons name={status.icon} size={10} color={status.color} />
                <KText variant="caption" bold style={{ fontSize: 10, color: status.color }}>{status.label}</KText>
              </KRow>
            </KRow>
            {/* Dates */}
            <KRow gap={6} style={{ marginTop: 3, alignItems: "center" }}>
              <Ionicons name="calendar-outline" size={11} color={colors.textTertiary} />
              <KText variant="caption" color="textSecondary">{formatDateShort(r.startDate)} → {formatDateShort(r.endDate)}</KText>
              <KText variant="caption" color="textTertiary">({days}j)</KText>
            </KRow>
            {/* Price + timestamp — same neutral row */}
            <KRow gap={8} style={{ marginTop: 3, alignItems: "center" }}>
              {total > 0 && (
                <KText variant="caption" bold style={{ color: colors.text }}>{total.toLocaleString("fr-FR")} MAD</KText>
              )}
              {isRequested && r.createdAt && (
                <KText variant="caption" style={{ color: isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)", fontSize: 10 }}>· {timeAgo(r.createdAt)}</KText>
              )}
            </KRow>
          </View>
          <Ionicons name="chevron-forward" size={15} color={colors.textTertiary} />
        </KRow>
      </KPressable>

      {/* Action buttons — muted, elegant */}
      {isRequested && (
        <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingBottom: 10 }}>
          <KPressable
            onPress={() => onAccept?.(String(r._id))}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
              backgroundColor: isDark ? "rgba(55,65,81,0.5)" : colors.text, borderRadius: 10, paddingVertical: 7 }}>
            <Ionicons name="checkmark" size={14} color="#FFF" />
            <KText variant="caption" bold style={{ color: "#FFF", fontSize: 12.5 }}>Accepter</KText>
          </KPressable>
          <KPressable
            onPress={() => onReject?.(String(r._id))}
            style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5,
              backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "#EAECF0", borderRadius: 10, paddingVertical: 7 }}>
            <Ionicons name="close" size={14} color={isDark ? "#D1D5DB" : "#4B5563"} />
            <KText variant="caption" bold style={{ color: isDark ? "#D1D5DB" : "#4B5563", fontSize: 12.5 }}>Refuser</KText>
          </KPressable>
          <KPressable
            onPress={() => onMessage?.(r.vehicleId)}
            style={{ width: 36, alignItems: "center", justifyContent: "center",
              backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "#F3F4F6", borderRadius: 10 }}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.textTertiary} />
          </KPressable>
        </View>
      )}
    </View>
  );
}

function computeDays(start: string, end: string) {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const diff = new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
  return diff > 0 ? Math.round(diff / 86400000) : 0;
}

// ═══════════════════════════════════════════════════════
// Section Card
// ═══════════════════════════════════════════════════════
function SectionCard({ title, children }: { title?: string; children: React.ReactNode }) {
  const { styles } = useSectionStyles();
  return (
    <View style={styles.card}>
      {title && <KText variant="caption" bold color="textTertiary" style={styles.title}>{title}</KText>}
      {children}
    </View>
  );
}
const useSectionStyles = createStyles((colors, isDark) => ({
  card: {
    backgroundColor: colors.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 4, marginBottom: 14,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
  },
  title: { paddingTop: 14, paddingBottom: 4, paddingHorizontal: 4, textTransform: "uppercase", letterSpacing: 0.5 },
}));

// ═══════════════════════════════════════════════════════
// Monthly Earnings Chart
// ═══════════════════════════════════════════════════════
const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

function MonthlyEarningsChart({ data }: { data: { month: string; amount: number }[] }) {
  const { styles: s, colors, isDark } = useChartStyles();
  const max = Math.max(...data.map((d) => d.amount), 1);
  const total = data.reduce((acc, d) => acc + d.amount, 0);

  // Animated bars
  const barAnims = useRef(data.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    Animated.stagger(60, barAnims.map((a) =>
      Animated.spring(a, { toValue: 1, useNativeDriver: false, tension: 80, friction: 12 })
    )).start();
  }, []);

  return (
    <View style={s.chartCard}>
      <KRow justify="space-between" style={{ alignItems: "flex-start", marginBottom: 16 }}>
        <View>
          <KText variant="caption" bold color="textTertiary" style={{ textTransform: "uppercase", letterSpacing: 0.5 }}>
            Revenus · 6 mois
          </KText>
          <KText variant="displayMedium" style={{ marginTop: 2 }}>
            {total.toLocaleString("fr-FR")} <KText variant="bodySmall" color="textTertiary">MAD</KText>
          </KText>
        </View>
        <View style={s.trendBadge}>
          <Ionicons name="trending-up" size={14} color="#10B981" />
        </View>
      </KRow>

      <View style={s.barsRow}>
        {data.map((item, i) => {
          const monthNum = parseInt(item.month.split("-")[1], 10);
          const label = MONTH_LABELS[monthNum - 1];
          const ratio = item.amount / max;
          const isCurrentMonth = i === data.length - 1;
          const hasValue = item.amount > 0;

          const heightAnim = barAnims[i].interpolate({
            inputRange: [0, 1],
            outputRange: [0, ratio * 110],
          });

          return (
            <View key={item.month} style={s.barCol}>
              <View style={s.barContainer}>
                {hasValue && (
                  <Animated.View
                    style={[
                      s.bar,
                      {
                        height: heightAnim,
                        backgroundColor: isCurrentMonth
                          ? colors.primary
                          : isDark ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.15)",
                        borderRadius: 6,
                      },
                    ]}
                  />
                )}
                {!hasValue && <View style={s.barEmpty} />}
              </View>
              <KText variant="caption" color={isCurrentMonth ? "text" : "textTertiary"}
                bold={isCurrentMonth} style={{ fontSize: 10, marginTop: 6 }}>
                {label}
              </KText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const useChartStyles = createStyles((colors, isDark) => ({
  chartCard: {
    backgroundColor: colors.card, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
  },
  trendBadge: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: isDark ? "rgba(16,185,129,0.1)" : "#ECFDF5",
    alignItems: "center", justifyContent: "center",
  },
  barsRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end",
    paddingHorizontal: 4,
  },
  barCol: { alignItems: "center", flex: 1 },
  barContainer: { height: 110, justifyContent: "flex-end", width: "100%" , alignItems: "center" },
  bar: { width: "60%", minHeight: 8 },
  barEmpty: {
    width: "60%", height: 4, borderRadius: 2,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.05)",
  },
}));

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function DashboardSkeleton() {
  const { colors } = useSkeletonStyles();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => { skeletonPulse(pulse).start(); }, []);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const Box = ({ w, h, r = 8, style: s }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, s]} />
  );
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 18 }}>
      <Box w="50%" h={28} style={{ marginTop: 12 }} />
      <Box w="70%" h={16} style={{ marginTop: 6 }} />
      <Box w="100%" h={100} r={16} style={{ marginTop: 16 }} />
      <KRow gap={8} style={{ marginTop: 14 }}><Box w={0} h={120} r={18} style={{ flex: 1 }} /><Box w={0} h={120} r={18} style={{ flex: 1 }} /></KRow>
      <KRow gap={8} style={{ marginTop: 8 }}><Box w={0} h={120} r={18} style={{ flex: 1 }} /><Box w={0} h={120} r={18} style={{ flex: 1 }} /></KRow>
    </View>
  );
}
const useSkeletonStyles = createStyles((colors) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// Not Authenticated
// ═══════════════════════════════════════════════════════
function NotAuthenticated() {
  const { styles, colors } = useNotAuthStyles();
  return (
    <KVStack align="center" justify="center" style={styles.container}>
      <View style={styles.iconCircle}><Ionicons name="lock-closed-outline" size={28} color={colors.textTertiary} /></View>
      <KText variant="h3" bold center>Inscris-toi pour accéder au tableau de bord</KText>
      <KVStack gap="sm" style={{ width: "100%" }}>
        <KPressable onPress={() => router.push("/signup")} style={styles.loginBtn}>
          <KText variant="label" bold color="textInverse" center>Créer un compte</KText>
        </KPressable>
        <KPressable onPress={() => router.push("/login")} style={styles.signupBtn}>
          <KText variant="label" bold center>Déjà un compte ? Se connecter</KText>
        </KPressable>
      </KVStack>
    </KVStack>
  );
}
const useNotAuthStyles = createStyles((colors, isDark) => ({
  container: { flex: 1, padding: 32, gap: 16 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA", alignItems: "center", justifyContent: "center" },
  loginBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 14 },
  signupBtn: { backgroundColor: colors.card, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)" },
}));

// ═══════════════════════════════════════════════════════
// MAIN DASHBOARD SCREEN
// ═══════════════════════════════════════════════════════
export default function DashboardScreen() {
  const { styles, colors, isDark } = useStyles();
  const { isAuthenticated, isLoading: authLoading, session } = useAuthStatus();
  const [refreshing, setRefreshing] = useState(false);

  const user = session?.data?.user;
  const profile = useQuery(api.userProfiles.getMyProfile, isAuthenticated ? {} : "skip");
  const firstName = (profile?.displayName || user?.name || "").split(" ")[0] || "";

  const data = useQuery(api.dashboard.getOwnerDashboard, isAuthenticated ? {} : "skip");
  const acceptMut = useMutation(api.reservations.acceptReservation);
  const rejectMut = useMutation(api.reservations.rejectReservation);
  const onRefresh = useCallback(() => { setRefreshing(true); setTimeout(() => setRefreshing(false), 600); }, []);

  const handleAccept = useCallback((reservationId: string) => {
    haptic.medium();
    Alert.alert("Accepter cette demande ?", "Le locataire devra ensuite procéder au paiement pour confirmer.", [
      { text: "Annuler", style: "cancel" },
      { text: "Accepter", onPress: async () => {
        try {
          await acceptMut({ reservationId: reservationId as any });
          haptic.success();
          showSuccessToast("Demande acceptée", "Le locataire a été notifié.");
        } catch (e) {
          haptic.error();
          showErrorToast(e);
        }
      }},
    ]);
  }, [acceptMut]);

  const handleReject = useCallback((reservationId: string) => {
    haptic.medium();
    Alert.alert("Refuser cette demande ?", "Les dates seront libérées et le locataire sera notifié.", [
      { text: "Annuler", style: "cancel" },
      { text: "Refuser", style: "destructive", onPress: async () => {
        try {
          await rejectMut({ reservationId: reservationId as any });
          haptic.success();
          showSuccessToast("Demande refusée", "Les dates sont de nouveau disponibles.");
        } catch (e) {
          haptic.error();
          showErrorToast(e);
        }
      }},
    ]);
  }, [rejectMut]);

  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;
  const activityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!data) return;
    staggeredEntrance([headerAnim, statsAnim, actionsAnim, activityAnim]).start();
  }, [data]);

  const fadeUp = (anim: Animated.Value) => fadeUpStyle(anim, 12);

  if (authLoading) return <><Stack.Screen options={{ headerShown: false }} /><DashboardSkeleton /></>;
  if (!isAuthenticated) return <><Stack.Screen options={{ headerShown: false }} /><SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={[]}><NotAuthenticated /></SafeAreaView></>;
  if (data === undefined) return <><Stack.Screen options={{ headerShown: false }} /><DashboardSkeleton /></>;

  const c = data.counts;
  const urgentCount = c.pickupPending + c.dropoffPending;
  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  const hasActivity = c.requested + c.inProgress + c.completed + c.pickupPending + c.dropoffPending > 0;

  // Split reservations by action needed
  const pendingRequests = data.reservations.filter((r: any) => r.status === "requested");
  const activeReservations = data.reservations.filter((r: any) => r.status !== "requested");
  const urgentReservations = data.reservations.filter((r: any) => r.status === "pickup_pending" || r.status === "dropoff_pending");

  const handleUrgentPress = () => {
    if (urgentReservations.length === 1) {
      const r = urgentReservations[0];
      const phase = r.status === "pickup_pending" ? "checkin" : "checkout";
      router.push(`/reservation/${String(r._id)}/report?phase=${phase}`);
    } else if (urgentReservations.length > 1) {
      // Multiple constats: let user pick
      const buttons = urgentReservations.map((r: any) => ({
        text: `${r.vehicleTitle} — ${r.status === "pickup_pending" ? "Départ" : "Retour"}`,
        onPress: () => {
          const phase = r.status === "pickup_pending" ? "checkin" : "checkout";
          router.push(`/reservation/${String(r._id)}/report?phase=${phase}`);
        },
      }));
      buttons.push({ text: "Annuler", onPress: () => {}, style: "cancel" as const });
      Alert.alert("Quel constat ?", "Plusieurs constats sont en attente.", buttons as any);
    } else {
      router.push("/profile/reservations");
    }
  };

  return (
    <SafeAreaView testID="dashboard-screen" style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Custom header */}
      <KRow gap="sm" style={styles.customHeader}>
        <KPressable onPress={() => { haptic.light(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <KText variant="label" bold style={{ fontSize: 17 }}>Tableau de bord</KText>
      </KRow>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {/* Header — personalized */}
        <Animated.View style={fadeUp(headerAnim)}>
          <KText variant="bodySmall" color="textTertiary" style={{ textTransform: "capitalize" }}>{today}</KText>
          <KText testID="dashboard-greeting" variant="displayMedium" style={{ marginTop: 2 }}>
            {getGreeting()}{firstName ? ` ${firstName}` : ""} 👋
          </KText>
          {hasActivity ? (
            <KText variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>
              {c.requested > 0 ? `${c.requested} demande${c.requested > 1 ? "s" : ""} en attente` : "Tout est à jour"}
            </KText>
          ) : null}
        </Animated.View>

        {/* ── 1. URGENT ALERTS (constats) ── */}
        {urgentCount > 0 && (
          <Animated.View style={[{ marginTop: 14 }, fadeUp(actionsAnim)]}>
            <KPressable testID="urgent-alert-banner" onPress={handleUrgentPress} style={styles.urgentBanner}>
              <View style={styles.urgentIcon}><Ionicons name="alert-circle-outline" size={19} color="#EF4444" /></View>
              <View style={{ flex: 1 }}>
                <KText variant="label" bold style={{ color: "#EF4444" }}>{urgentCount} constat{urgentCount > 1 ? "s" : ""} à compléter</KText>
                <KText variant="caption" color="textTertiary" style={{ marginTop: 1 }}>Action requise</KText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </KPressable>
          </Animated.View>
        )}

        {/* ── 2. PENDING REQUESTS (action business #1) ── */}
        {pendingRequests.length > 0 && (
          <Animated.View style={[{ marginTop: 16 }, fadeUp(actionsAnim)]}>
            <KRow gap={6} style={{ alignItems: "center", marginBottom: 10, marginLeft: 2 }}>
              <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: "#F59E0B" }} />
              <KText variant="caption" bold style={{ textTransform: "uppercase", letterSpacing: 0.6, color: "#D97706", fontSize: 12 }}>
                À traiter · {pendingRequests.length}
              </KText>
            </KRow>
            {pendingRequests.map((r: any) => (
              <ReservationItem key={String(r._id)} reservation={r} isDark={isDark} colors={colors}
                onAccept={handleAccept} onReject={handleReject}
                onMessage={() => router.push(`/(tabs)/messages`)} />
            ))}
          </Animated.View>
        )}

        {/* ── 3. STATS GRID ── */}
        {hasActivity && (
          <Animated.View style={[{ marginTop: pendingRequests.length > 0 ? 12 : 16 }, fadeUp(statsAnim)]}>
            <KRow gap={8}>
              <StatCard icon="mail-unread-outline" label="Demandes" count={c.requested} highlight onPress={() => router.push("/profile/listings")} />
              <StatCard icon="car-sport-outline" label="En cours" count={c.inProgress} onPress={() => router.push("/profile/reservations")} />
            </KRow>
            <KRow gap={8} style={{ marginTop: 8 }}>
              <StatCard icon="checkmark-done-outline" label="Terminées" count={c.completed} onPress={() => router.push("/profile/reservations")} />
              <StatCard icon="wallet-outline" label="Revenus" count={data.totalEarnings} suffix=" MAD" onPress={() => {}} />
            </KRow>
          </Animated.View>
        )}

        {/* ── 4. EARNINGS CHART ── */}
        {data.monthlyEarnings && data.totalEarnings > 0 && (
          <Animated.View style={[{ marginTop: 16 }, fadeUp(statsAnim)]}>
            <MonthlyEarningsChart data={data.monthlyEarnings} />
          </Animated.View>
        )}

        {/* ── 5. ACTIVE RESERVATIONS ── */}
        {activeReservations.length > 0 && (
          <Animated.View style={[{ marginTop: 16 }, fadeUp(activityAnim)]}>
            <KText variant="caption" bold color="textTertiary" style={{ textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10, marginLeft: 2 }}>
              Réservations actives
            </KText>
            {activeReservations.map((r: any) => (
              <ReservationItem key={String(r._id)} reservation={r} isDark={isDark} colors={colors} />
            ))}
          </Animated.View>
        )}

        {/* ── 6. EMPTY STATE ── */}
        {data.reservations.length === 0 && (
          <Animated.View style={[{ marginTop: 16 }, fadeUp(activityAnim)]}>
            {!hasActivity ? (
              <View style={styles.emptyCard}>
                <View style={styles.emptyCircle}><Ionicons name="rocket-outline" size={26} color={colors.primary} /></View>
                <KText variant="label" bold style={{ marginTop: 14 }}>Prêt à commencer ?</KText>
                <KText variant="bodySmall" color="textSecondary" center style={{ marginTop: 4, lineHeight: 20, maxWidth: 260 }}>
                  Publie ta première annonce et commence à recevoir des demandes de location.
                </KText>
                <KPressable onPress={() => router.push("/(tabs)/publish")} style={[styles.publishBtn, { marginTop: 18 }]}>
                  <Ionicons name="add-circle-outline" size={18} color="#FFF" />
                  <KText variant="label" bold style={{ color: "#FFF" }}>Publier une annonce</KText>
                </KPressable>
              </View>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyCircle}><Ionicons name="checkmark-circle-outline" size={24} color="#10B981" /></View>
                <KText variant="label" bold style={{ marginTop: 12 }}>Tout est à jour</KText>
                <KText variant="bodySmall" color="textSecondary" center style={{ marginTop: 4, lineHeight: 20 }}>
                  Aucune action requise pour le moment.
                </KText>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── 7. RACCOURCIS ── */}
        <Animated.View style={[{ marginTop: 16 }, fadeUp(actionsAnim)]}>
          <SectionCard title="Raccourcis">
            <MenuRow icon="car-outline" label="Mes annonces" sublabel={`${c.totalVehicles} véhicule${c.totalVehicles > 1 ? "s" : ""} actif${c.totalVehicles > 1 ? "s" : ""}`} onPress={() => router.push("/profile/listings")} />
            <KDivider indent={58} />
            <MenuRow icon="lock-closed-outline" label="Gérer les disponibilités" sublabel="Bloquer des dates" onPress={() => {
              const vehicles = data.myVehicles ?? [];
              if (vehicles.length === 0) {
                Alert.alert("Aucun véhicule", "Publie d'abord une annonce.");
              } else if (vehicles.length === 1) {
                router.push(`/profile/availability/${vehicles[0]._id}`);
              } else {
                Alert.alert("Quel véhicule ?", "Choisis le véhicule à gérer.",
                  vehicles.map((v: any) => ({ text: v.title, onPress: () => router.push(`/profile/availability/${v._id}`) })).concat([{ text: "Annuler", style: "cancel" as const }])
                );
              }
            }} />
            <KDivider indent={58} />
            <MenuRow icon="calendar-outline" label="Toutes les réservations" onPress={() => router.push("/profile/reservations")} />
            <KDivider indent={58} />
            <MenuRow icon="chatbubble-outline" label="Messagerie" onPress={() => router.push("/(tabs)/messages")} />
          </SectionCard>
        </Animated.View>

        {/* Tip */}
        <KRow gap="sm" style={styles.tipBox}>
          <Ionicons name="bulb-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <KText variant="bodySmall" color="textSecondary" style={{ flex: 1, lineHeight: 19 }}>
            Ajoute des photos de qualité à tes annonces pour recevoir jusqu'à 3× plus de demandes.
          </KText>
        </KRow>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  customHeader: {
    paddingHorizontal: 18, paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 0.5,
    borderBottomColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  urgentBanner: {
    flexDirection: "row", alignItems: "center", gap: 14,
    backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2",
    borderRadius: 14, padding: 14, borderWidth: 1,
    borderColor: isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.08)",
  },
  urgentIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  emptyCard: {
    backgroundColor: colors.card, borderRadius: 18, padding: 24,
    alignItems: "center", borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
  },
  emptyCircle: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center", justifyContent: "center",
  },
  publishBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 20,
  },
  tipBox: {
    marginTop: 14, backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8",
    borderRadius: 14, padding: 14, alignItems: "flex-start",
  },
}));
