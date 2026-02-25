import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { shadows, useTheme } from "../../src/theme";

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
  const months = [
    "jan", "fév", "mars", "avr", "mai", "juin",
    "juil", "août", "sept", "oct", "nov", "déc",
  ];
  return `${d} ${months[m - 1]}`;
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

type StatusConfig = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bgColor: string;
};

function getStatusConfig(status: string, isDark: boolean): StatusConfig {
  const configs: Record<string, StatusConfig> = {
    requested: {
      label: "En attente",
      icon: "time-outline",
      color: "#F59E0B",
      bgColor: isDark ? "rgba(245,158,11,0.15)" : "#FEF3C7",
    },
    pickup_pending: {
      label: "Constat départ",
      icon: "camera-outline",
      color: "#3B82F6",
      bgColor: isDark ? "rgba(59,130,246,0.15)" : "#EFF6FF",
    },
    in_progress: {
      label: "En cours",
      icon: "car-outline",
      color: "#3B82F6",
      bgColor: isDark ? "rgba(59,130,246,0.15)" : "#EFF6FF",
    },
    dropoff_pending: {
      label: "Constat retour",
      icon: "camera-reverse-outline",
      color: "#8B5CF6",
      bgColor: isDark ? "rgba(139,92,246,0.15)" : "#F5F3FF",
    },
  };
  return configs[status] ?? {
    label: status,
    icon: "help-circle-outline",
    color: "#6B7280",
    bgColor: "#F3F4F6",
  };
}

// ═══════════════════════════════════════════════════════
// Stat Card — mono-bleu (primaryLight + primary)
// ═══════════════════════════════════════════════════════
function StatCard({
  icon,
  label,
  count,
  highlight,
  onPress,
  colors,
  isDark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  count: number;
  highlight?: boolean;
  onPress?: () => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <Pressable
      testID={`stat-card-${label.toLowerCase().replace(/\s/g, "-")}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        backgroundColor: colors.card,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
        opacity: pressed ? 0.92 : 1,
        ...(!isDark ? shadows.sm : {}),
      })}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: colors.primaryLight,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 14,
        }}
      >
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <Text
        style={{
          fontSize: 26,
          fontWeight: "800",
          color: highlight && count > 0 ? colors.primary : colors.text,
          letterSpacing: -0.5,
        }}
      >
        {count}
      </Text>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: colors.textSecondary,
          marginTop: 4,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Menu Row — identique au pattern profile.tsx
// ═══════════════════════════════════════════════════════
function MenuRow({
  icon,
  label,
  sublabel,
  badge,
  onPress,
  colors,
  isDark,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  badge?: number;
  onPress?: () => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <Pressable
      testID={`menu-row-${label.toLowerCase().replace(/\s/g, "-")}`}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          backgroundColor: colors.primaryLight,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={19} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>
          {label}
        </Text>
        {sublabel && (
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>
            {sublabel}
          </Text>
        )}
      </View>
      {badge !== undefined && badge > 0 && (
        <View
          style={{
            minWidth: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: colors.primary,
            alignItems: "center",
            justifyContent: "center",
            paddingHorizontal: 6,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFF" }}>
            {badge}
          </Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Section Card — identique au pattern profile.tsx
// ═══════════════════════════════════════════════════════
function SectionCard({
  title,
  children,
  colors,
  isDark,
}: {
  title?: string;
  children: React.ReactNode;
  colors: any;
  isDark: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 18,
        paddingHorizontal: 14,
        paddingVertical: 4,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
      }}
    >
      {title && (
        <Text
          style={{
            fontSize: 12,
            fontWeight: "700",
            color: colors.textTertiary,
            paddingTop: 14,
            paddingBottom: 4,
            paddingHorizontal: 4,
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

function Sep({ colors, isDark }: { colors: any; isDark: boolean }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.04)",
        marginLeft: 58,
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════
// Activity Item — timeline
// ═══════════════════════════════════════════════════════
function ActivityItem({
  reservation,
  colors,
  isDark,
  isLast,
}: {
  reservation: any;
  colors: any;
  isDark: boolean;
  isLast: boolean;
}) {
  const status = getStatusConfig(reservation.status, isDark);

  return (
    <View
      testID={`activity-item-${reservation._id}`}
      style={{
        flexDirection: "row",
        gap: 14,
        paddingVertical: 14,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: isDark ? colors.border : "rgba(0,0,0,0.04)",
      }}
    >
      <View style={{ alignItems: "center", paddingTop: 4 }}>
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: colors.primary,
          }}
        />
        {!isLast && (
          <View
            style={{
              width: 1.5,
              flex: 1,
              backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
              marginTop: 6,
            }}
          />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <View style={{ flex: 1, marginRight: 10 }}>
            <Text
              numberOfLines={1}
              style={{ fontSize: 14, fontWeight: "700", color: colors.text }}
            >
              Réservation
            </Text>
            <Text
              style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}
            >
              {formatDateShort(reservation.startDate)} → {formatDateShort(reservation.endDate)}
            </Text>
          </View>

          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 4,
              backgroundColor: status.bgColor,
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 999,
            }}
          >
            <Ionicons name={status.icon} size={12} color={status.color} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: status.color }}>
              {status.label}
            </Text>
          </View>
        </View>

        <Text
          style={{ fontSize: 11, color: colors.textTertiary, marginTop: 6 }}
        >
          {timeAgo(reservation.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function DashboardSkeleton() {
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
    <Animated.View
      style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]}
    />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 18 }}>
      <Box w="50%" h={28} style={{ marginTop: 12 }} />
      <Box w="70%" h={16} style={{ marginTop: 8 }} />
      <View style={{ flexDirection: "row", gap: 12, marginTop: 24 }}>
        <Box w={0} h={130} r={20} style={{ flex: 1 }} />
        <Box w={0} h={130} r={20} style={{ flex: 1 }} />
      </View>
      <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
        <Box w={0} h={130} r={20} style={{ flex: 1 }} />
        <Box w={0} h={130} r={20} style={{ flex: 1 }} />
      </View>
      <Box w="100%" h={200} r={18} style={{ marginTop: 24 }} />
      <Box w="100%" h={160} r={18} style={{ marginTop: 14 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Not Authenticated
// ═══════════════════════════════════════════════════════
function NotAuthenticated({ colors, isDark }: { colors: any; isDark: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
      <View
        style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons name="lock-closed-outline" size={28} color={colors.textTertiary} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" }}>
        Connecte-toi pour accéder au tableau de bord
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
// MAIN DASHBOARD SCREEN
// ═══════════════════════════════════════════════════════
export default function DashboardScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, isLoading: authLoading } = useAuthStatus();
  const [refreshing, setRefreshing] = useState(false);

  const data = useQuery(
    api.dashboard.getOwnerDashboard,
    isAuthenticated ? {} : "skip"
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  }, []);

  // ── Entrance animations ──
  const headerAnim = useRef(new Animated.Value(0)).current;
  const statsAnim = useRef(new Animated.Value(0)).current;
  const actionsAnim = useRef(new Animated.Value(0)).current;
  const activityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!data) return;
    Animated.stagger(100, [
      Animated.timing(headerAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(statsAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(actionsAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(activityAnim, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  }, [data]);

  const fadeUp = (anim: Animated.Value) => ({
    opacity: anim,
    transform: [
      { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) },
    ],
  });

  if (authLoading) return <DashboardSkeleton />;
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={[]}>
        <NotAuthenticated colors={colors} isDark={isDark} />
      </SafeAreaView>
    );
  }
  if (data === undefined) return <DashboardSkeleton />;

  const c = data.counts;
  const urgentCount = c.pickupPending + c.dropoffPending;

  const allLatest = [
    ...data.latest.requested,
    ...data.latest.pickupPending,
    ...data.latest.dropoffPending,
    ...data.latest.inProgress,
  ].sort((a, b) => b.createdAt - a.createdAt);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <View testID="dashboard-screen" style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Header ── */}
        <Animated.View style={fadeUp(headerAnim)}>
          <Text
            style={{
              fontSize: 13, fontWeight: "600", color: colors.textTertiary,
              textTransform: "capitalize",
            }}
          >
            {today}
          </Text>
          <Text
            testID="dashboard-greeting"
            style={{
              fontSize: 28, fontWeight: "800", color: colors.text,
              marginTop: 4, letterSpacing: -0.5,
            }}
          >
            {getGreeting()} 👋
          </Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4, lineHeight: 20 }}>
            Voici un aperçu de ton activité de location.
          </Text>
        </Animated.View>

        {/* ── Stats Grid — tout en bleu primary ── */}
        <Animated.View style={[{ marginTop: 24 }, fadeUp(statsAnim)]}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <StatCard
              icon="mail-unread-outline"
              label="Demandes reçues"
              count={c.requested}
              highlight
              colors={colors}
              isDark={isDark}
              onPress={() => router.push("/profile/listings")}
            />
            <StatCard
              icon="car-sport-outline"
              label="En cours"
              count={c.inProgress}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push("/profile/listings")}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
            <StatCard
              icon="camera-outline"
              label="Constats départ"
              count={c.pickupPending}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push("/profile/listings")}
            />
            <StatCard
              icon="camera-reverse-outline"
              label="Constats retour"
              count={c.dropoffPending}
              colors={colors}
              isDark={isDark}
              onPress={() => router.push("/profile/listings")}
            />
          </View>
        </Animated.View>

        {/* ── Alerte urgente (seul élément non-bleu : rouge = action requise) ── */}
        {urgentCount > 0 && (
          <Animated.View style={[{ marginTop: 18 }, fadeUp(actionsAnim)]}>
            <Pressable
              testID="urgent-alert-banner"
              onPress={() => router.push("/profile/listings")}
              style={({ pressed }) => ({
                flexDirection: "row", alignItems: "center", gap: 14,
                backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2",
                borderRadius: 14, padding: 14,
                borderWidth: 1,
                borderColor: isDark ? "rgba(239,68,68,0.2)" : "rgba(239,68,68,0.08)",
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <View
                style={{
                  width: 40, height: 40, borderRadius: 12,
                  backgroundColor: isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.08)",
                  alignItems: "center", justifyContent: "center",
                }}
              >
                <Ionicons name="alert-circle-outline" size={19} color="#EF4444" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#EF4444" }}>
                  {urgentCount} constat{urgentCount > 1 ? "s" : ""} à compléter
                </Text>
                <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>
                  Action requise de ta part
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
            </Pressable>
          </Animated.View>
        )}

        {/* ── Actions rapides — même pattern que profile.tsx ── */}
        <Animated.View style={[{ marginTop: 22 }, fadeUp(actionsAnim)]}>
          <SectionCard title="Actions rapides" colors={colors} isDark={isDark}>
            <MenuRow
              icon="car-outline"
              label="Mes annonces"
              sublabel="Gérer tes véhicules publiés"
              onPress={() => router.push("/profile/listings")}
              colors={colors}
              isDark={isDark}
            />
            <Sep colors={colors} isDark={isDark} />
            <MenuRow
              icon="calendar-outline"
              label="Réservations reçues"
              sublabel="Voir et répondre aux demandes"
              badge={c.requested > 0 ? c.requested : undefined}
              onPress={() => router.push("/profile/listings")}
              colors={colors}
              isDark={isDark}
            />
            <Sep colors={colors} isDark={isDark} />
            <MenuRow
              icon="chatbubble-outline"
              label="Messagerie"
              sublabel="Discuter avec tes locataires"
              onPress={() => router.push("/(tabs)/messages")}
              colors={colors}
              isDark={isDark}
            />
          </SectionCard>
        </Animated.View>

        {/* ── Activité récente ── */}
        <Animated.View style={fadeUp(activityAnim)}>
          <View
            style={{
              flexDirection: "row", justifyContent: "space-between",
              alignItems: "flex-end", marginBottom: 10,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.textTertiary, textTransform: "uppercase", letterSpacing: 0.5 }}>
              Activité récente
            </Text>
            <Pressable onPress={() => router.push("/profile/listings")}>
              <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
                Tout voir
              </Text>
            </Pressable>
          </View>

          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: 18,
              paddingHorizontal: 16,
              borderWidth: 1,
              borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
            }}
          >
            {allLatest.length === 0 ? (
              <View style={{ paddingVertical: 32, alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 56, height: 56, borderRadius: 28,
                    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Ionicons name="calendar-outline" size={24} color={colors.textTertiary} />
                </View>
                <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
                  Aucune activité récente
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center" }}>
                  Les nouvelles demandes apparaîtront ici.
                </Text>
              </View>
            ) : (
              allLatest.map((res, idx) => (
                <ActivityItem
                  key={String(res._id)}
                  reservation={res}
                  colors={colors}
                  isDark={isDark}
                  isLast={idx === allLatest.length - 1}
                />
              ))
            )}
          </View>
        </Animated.View>

        {/* ── Tip — même style que les info hints du vehicle detail ── */}
        <View
          style={{
            marginTop: 18,
            backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8",
            borderRadius: 14, padding: 14,
            flexDirection: "row", gap: 10, alignItems: "flex-start",
          }}
        >
          <Ionicons name="bulb-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <Text
            style={{
              flex: 1, fontSize: 13, fontWeight: "600",
              color: colors.textSecondary, lineHeight: 19,
            }}
          >
            Ajoute des photos de qualité à tes annonces pour recevoir jusqu'à 3× plus de demandes.
          </Text>
        </View>

        <Text style={{ textAlign: "center", fontSize: 12, color: colors.textTertiary, marginTop: 24 }}>
          Kreeny v1.0.0
        </Text>
      </ScrollView>
    </View>
  );
}
