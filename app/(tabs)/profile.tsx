import { useEffect, useRef } from "react";
import { Alert, Animated, View } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { authClient } from "../../src/lib/auth-client";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { useTheme, radius, skeletonPulse } from "../../src/theme";

// UI Kit
import {
  KScreen,
  KText,
  KRow,
  KVStack,
  KSpacer,
  KDivider,
  KPressable,
  KCard,
  KButton,
  KImage,
  createStyles,
} from "../../src/ui";

// ═══════════════════════════════════════════════════════
// Guest Mode
// ═══════════════════════════════════════════════════════
function GuestProfile() {
  const { styles, colors } = useGuestStyles();

  return (
    <KScreen scroll edges={["top"]}>
      <KSpacer size="3xl" />
      <KVStack align="center" gap="md">
        <View style={styles.guestAvatar}>
          <Ionicons name="person-outline" size={34} color={colors.textTertiary} />
        </View>
        <KText variant="displayMedium" center>Bienvenue sur Kreeny</KText>
        <KText variant="body" color="textSecondary" center style={{ maxWidth: 280, lineHeight: 20 }}>
          Crée ton compte pour gérer tes réservations, publier des annonces et accéder à toutes les fonctionnalités.
        </KText>
      </KVStack>

      <KSpacer size="3xl" />

      <KVStack gap="sm">
        <KButton title="Créer un compte" onPress={() => router.push("/signup")} />
        <KPressable onPress={() => router.push("/login")} style={styles.signupBtn}>
          <KText variant="label" center style={{ fontSize: 16 }}>Déjà un compte ? Se connecter</KText>
        </KPressable>
      </KVStack>
    </KScreen>
  );
}

const useGuestStyles = createStyles((colors, isDark) => ({
  guestAvatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center", justifyContent: "center",
  },
  signupBtn: {
    backgroundColor: colors.card, borderRadius: 16,
    paddingVertical: 15, alignItems: "center",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
}));

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function ProfileSkeleton() {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = skeletonPulse(pulse);
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const B = ({ w, h, r = 8, style }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 40 }}>
      <KRow gap="lg">
        <B w={72} h={72} r={36} />
        <KVStack flex={1} gap="sm"><B w="60%" h={20} /><B w="40%" h={14} /></KVStack>
      </KRow>
      <B w="100%" h={320} r={18} style={{ marginTop: 28 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Menu Row (icon dans un carré arrondi)
// ═══════════════════════════════════════════════════════
function MenuRow({ icon, iconColor, iconBg, label, onPress, danger, hideChevron, badge }: {
  icon: string; label: string; onPress: () => void;
  iconColor?: string; iconBg?: string; danger?: boolean; hideChevron?: boolean;
  badge?: number;
}) {
  const { styles, colors, isDark } = useMenuStyles();
  const textColor = danger ? "#EF4444" : colors.text;

  return (
    <KPressable onPress={onPress}>
      <KRow gap={14} py="md" px="xs">
        <View style={[styles.iconBox, iconBg ? { backgroundColor: iconBg } : null]}>
          <Ionicons name={icon as any} size={18} color={iconColor || colors.text} />
        </View>
        <KText variant="label" color={textColor} style={{ flex: 1, fontSize: 15 }}>{label}</KText>
        {!!badge && badge > 0 && (
          <View style={styles.badgePill}>
            <KText variant="caption" bold style={{ color: "#FFF", fontSize: 11, lineHeight: 14 }}>
              {badge > 99 ? "99+" : badge}
            </KText>
          </View>
        )}
        {!hideChevron && (
          <Ionicons name="chevron-forward" size={17} color={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"} />
        )}
      </KRow>
    </KPressable>
  );
}

const useMenuStyles = createStyles((colors, isDark) => ({
  iconBox: {
    width: 38, height: 38, borderRadius: 11,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  badgePill: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: "#EF4444",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 6,
  },
}));

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function ProfileTab() {
  const { styles, colors, isDark } = useStyles();
  const { isLoading, isAuthenticated, session } = useAuthStatus();
  const user = session?.data?.user;

  const avatarUrl = useQuery(api.userProfiles.getMyAvatarUrl, isAuthenticated ? {} : "skip");
  const profile = useQuery(api.userProfiles.getMyProfile, isAuthenticated ? {} : "skip");
  const badges = useQuery(api.badges.getProfileBadge, isAuthenticated ? {} : "skip");
  const adminFlag = useQuery(api.reports.isAdmin, isAuthenticated ? {} : "skip");
  const adminStats = useQuery(api.reports.adminGetStats, adminFlag ? {} : "skip");

  const migrate = useMutation(api.migrations.fixOwnerUserIds.migrateMyData);
  const migrationRan = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !migrationRan.current) {
      migrationRan.current = true;
      migrate({}).catch(() => {});
    }
  }, [isAuthenticated]);

  if (isLoading) return <ProfileSkeleton />;
  if (!isAuthenticated) return <GuestProfile />;

  const displayName = profile?.displayName || user?.name || user?.email?.split("@")[0] || "Utilisateur";
  const email = user?.email || "";

  const onLogout = async () => {
    Alert.alert("Se déconnecter", "Tu es sûr de vouloir te déconnecter ?", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Déconnexion", style: "destructive",
        onPress: async () => {
          try { await authClient.signOut(); }
          catch (e) { Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue"); }
        },
      },
    ]);
  };

  return (
    <KScreen scroll edges={["top"]} bottomInset={30}>
      <KSpacer size="sm" />

      {/* ── Header: Avatar + Name ── */}
      <KPressable onPress={() => router.push("/profile/avatar")}>
        <KRow gap="lg">
          {avatarUrl ? (
            <KImage source={{ uri: avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={28} color={isDark ? colors.textTertiary : "#94A3B8"} />
            </View>
          )}
          <KVStack flex={1}>
            <KText variant="displayMedium">{displayName}</KText>
            {email ? <KText variant="bodySmall" color="textSecondary" style={{ marginTop: 3 }}>{email}</KText> : null}
          </KVStack>
          <Ionicons name="chevron-forward" size={20} color={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.15)"} />
        </KRow>
      </KPressable>

      {/* ── Menu principal ── */}
      <KCard style={styles.menuCard}>
        <MenuRow icon="calendar-outline" label="Mes réservations" onPress={() => router.push("/profile/reservations")} badge={badges?.renterActionCount} />
        <KDivider indent={56} />
        <MenuRow icon="car-outline" label="Mes annonces" onPress={() => router.push("/profile/listings")} />
        <KDivider indent={56} />
        <MenuRow icon="heart-outline" label="Mes favoris" onPress={() => router.push("/profile/favorites")} />
        <KDivider indent={56} />
        <MenuRow icon="stats-chart-outline" label="Tableau de bord" onPress={() => router.push("/profile/dashboard")} badge={badges?.dashboardBadge} />
      </KCard>

      {/* ── Paramètres + Admin + Déconnexion ── */}
      <KCard style={styles.settingsCard}>
        {adminFlag && (
          <>
            <MenuRow icon="shield-checkmark-outline" label="Administration" onPress={() => router.push("/admin")} badge={adminStats?.reports?.pending} />
            <KDivider indent={56} />
          </>
        )}
        <MenuRow icon="settings-outline" label="Paramètres" onPress={() => router.push("/profile/settings")} />
        <KDivider indent={56} />
        <MenuRow
          icon="log-out-outline"
          iconColor="#EF4444"
          iconBg={isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2"}
          label="Se déconnecter"
          onPress={onLogout}
          danger
          hideChevron
        />
      </KCard>

      {/* Version */}
      <KSpacer size="xl" />
      <KText variant="caption" color="textTertiary" center>Kreeny v1.0.0</KText>
    </KScreen>
  );
}

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const useStyles = createStyles((colors, isDark) => ({
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: colors.bgTertiary,
  },
  avatarPlaceholder: {
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center", justifyContent: "center",
  },
  menuCard: {
    marginTop: 28, paddingHorizontal: 14,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
  },
  settingsCard: {
    marginTop: 14, paddingHorizontal: 14,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
  },
}));
