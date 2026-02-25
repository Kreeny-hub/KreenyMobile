import { useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { authClient } from "../../src/lib/auth-client";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { useTheme } from "../../src/theme";

// ═══════════════════════════════════════════════════════
// Menu Row
// ═══════════════════════════════════════════════════════
function MenuRow({
  icon,
  iconColor,
  iconBg,
  label,
  sublabel,
  onPress,
  colors,
  isDark,
  rightElement,
  danger,
}: any) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", gap: 14,
        paddingVertical: 14, paddingHorizontal: 4,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <View style={{
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: iconBg || colors.primaryLight,
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name={icon} size={19} color={iconColor || colors.primary} />
      </View>

      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: danger ? "#EF4444" : colors.text }}>
          {label}
        </Text>
        {sublabel && (
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 1 }}>{sublabel}</Text>
        )}
      </View>

      {rightElement || <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />}
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Section Card
// ═══════════════════════════════════════════════════════
function SectionCard({ title, children, colors, isDark }: any) {
  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: 18,
      paddingHorizontal: 14,
      paddingVertical: 4,
      marginBottom: 14,
      borderWidth: 1,
      borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
    }}>
      {title && (
        <Text style={{
          fontSize: 12, fontWeight: "700", color: colors.textTertiary,
          paddingTop: 14, paddingBottom: 4, paddingHorizontal: 4,
          textTransform: "uppercase", letterSpacing: 0.5,
        }}>
          {title}
        </Text>
      )}
      {children}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Separator
// ═══════════════════════════════════════════════════════
function Sep({ colors, isDark }: any) {
  return <View style={{ height: 1, backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.04)", marginLeft: 58 }} />;
}

// ═══════════════════════════════════════════════════════
// Guest Mode
// ═══════════════════════════════════════════════════════
function GuestProfile({ colors, isDark }: any) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 18, paddingTop: 30 }}>
        {/* Welcome */}
        <View style={{ alignItems: "center", marginBottom: 30, gap: 12 }}>
          <View style={{
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="person-outline" size={34} color={colors.textTertiary} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>Bienvenue sur Kreeny</Text>
          <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20, maxWidth: 280 }}>
            Connecte-toi pour gérer tes réservations, publier des annonces et accéder à toutes les fonctionnalités.
          </Text>
        </View>

        {/* Buttons */}
        <View style={{ gap: 10 }}>
          <Pressable
            onPress={() => router.push("/login")}
            style={({ pressed }) => ({
              backgroundColor: colors.primary, borderRadius: 16,
              paddingVertical: 15, alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 16 }}>Se connecter</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/signup")}
            style={({ pressed }) => ({
              backgroundColor: colors.card, borderRadius: 16,
              paddingVertical: 15, alignItems: "center",
              borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 16 }}>Créer un compte</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function ProfileSkeleton() {
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
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 18, alignItems: "center", paddingTop: 30 }}>
      <Box w={80} h={80} r={40} />
      <Box w="50%" h={20} style={{ marginTop: 14 }} />
      <Box w="35%" h={14} style={{ marginTop: 8 }} />
      <Box w="100%" h={200} r={18} style={{ marginTop: 24 }} />
      <Box w="100%" h={160} r={18} style={{ marginTop: 14 }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function ProfileTab() {
  const { colors, isDark } = useTheme();
  const { isLoading, isAuthenticated, session } = useAuthStatus();
  const user = session?.data?.user;

  const avatarUrl = useQuery(
    api.userProfiles.getMyAvatarUrl,
    isAuthenticated ? {} : "skip"
  );

  const profile = useQuery(
    api.userProfiles.getMyProfile,
    isAuthenticated ? {} : "skip"
  );

  if (isLoading) return <ProfileSkeleton />;
  if (!isAuthenticated) return <GuestProfile colors={colors} isDark={isDark} />;

  const displayName = profile?.displayName || user?.name || user?.email?.split("@")[0] || "Utilisateur";
  const email = user?.email || "";

  const onLogout = async () => {
    Alert.alert(
      "Se déconnecter",
      "Tu es sûr de vouloir te déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnexion",
          style: "destructive",
          onPress: async () => {
            try {
              await authClient.signOut();
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingTop: 24 }}>

        {/* Avatar + Name */}
        <Pressable
          onPress={() => router.push("/profile/avatar")}
          style={{ alignItems: "center", marginBottom: 24 }}
        >
          {avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={{
                width: 88, height: 88, borderRadius: 44,
                backgroundColor: colors.bgTertiary,
                borderWidth: 3, borderColor: colors.primaryLight,
              }}
            />
          ) : (
            <View style={{
              width: 88, height: 88, borderRadius: 44,
              backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
              alignItems: "center", justifyContent: "center",
              borderWidth: 3, borderColor: colors.primaryLight,
            }}>
              <Ionicons name="person" size={34} color={colors.primary} />
            </View>
          )}

          <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 12 }}>
            {displayName}
          </Text>
          {email ? (
            <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 3 }}>
              {email}
            </Text>
          ) : null}

          <View style={{
            flexDirection: "row", alignItems: "center", gap: 4,
            marginTop: 8, backgroundColor: colors.primaryLight,
            paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
          }}>
            <Ionicons name="camera-outline" size={14} color={colors.primary} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>Modifier la photo</Text>
          </View>
        </Pressable>

        {/* Section: Location */}
        <SectionCard title="Location" colors={colors} isDark={isDark}>
          <MenuRow
            icon="calendar-outline"
            label="Mes réservations"
            sublabel="Suivre tes locations en cours"
            onPress={() => router.push("/profile/reservations")}
            colors={colors}
            isDark={isDark}
          />
          <Sep colors={colors} isDark={isDark} />
          <MenuRow
            icon="chatbubble-outline"
            label="Messagerie"
            sublabel="Discussions avec les propriétaires"
            onPress={() => router.push("/(tabs)/inbox")}
            colors={colors}
            isDark={isDark}
          />
        </SectionCard>

        {/* Section: Loueur */}
        <SectionCard title="Loueur" colors={colors} isDark={isDark}>
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
            icon="stats-chart-outline"
            label="Tableau de bord"
            sublabel="Statistiques et revenus"
            onPress={() => router.push("/profile/dashboard")}
            colors={colors}
            isDark={isDark}
          />
        </SectionCard>

        {/* Section: Compte */}
        <SectionCard title="Compte" colors={colors} isDark={isDark}>
          <MenuRow
            icon="settings-outline"
            label="Paramètres"
            sublabel="Apparence, notifications"
            onPress={() => router.push("/profile/settings")}
            colors={colors}
            isDark={isDark}
          />
          <Sep colors={colors} isDark={isDark} />
          <MenuRow
            icon="log-out-outline"
            iconColor="#EF4444"
            iconBg={isDark ? "rgba(239,68,68,0.15)" : "#FEF2F2"}
            label="Se déconnecter"
            onPress={onLogout}
            colors={colors}
            isDark={isDark}
            danger
            rightElement={<View />}
          />
        </SectionCard>

        {/* Version */}
        <Text style={{ textAlign: "center", fontSize: 12, color: colors.textTertiary, marginTop: 8, marginBottom: 24 }}>
          Kreeny v1.0.0
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
