import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../src/lib/auth-client";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { radius, useTheme } from "../../src/theme";
import { useThemePrefs, type ThemeMode } from "../../src/theme/ThemePrefsProvider";

const APP_VERSION = "1.0.0";
const SUPPORT_EMAIL = "support@kreeny.ma";

// ═══════════════════════════════════════════════════════
// Section Label
// ═══════════════════════════════════════════════════════
function SectionLabel({ text, colors }: { text: string; colors: any }) {
  return (
    <Text
      style={{
        fontSize: 12, fontWeight: "700", color: colors.textTertiary,
        marginLeft: 18, marginBottom: 8, marginTop: 6,
        textTransform: "uppercase", letterSpacing: 0.5,
      }}
    >
      {text}
    </Text>
  );
}

// ═══════════════════════════════════════════════════════
// Section Card
// ═══════════════════════════════════════════════════════
function SectionCard({ children, colors, isDark }: { children: React.ReactNode; colors: any; isDark: boolean }) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
        overflow: "hidden",
        marginHorizontal: 18,
        marginBottom: 16,
      }}
    >
      {children}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Separator
// ═══════════════════════════════════════════════════════
function Sep({ colors, isDark }: { colors: any; isDark: boolean }) {
  return (
    <View
      style={{
        height: 1,
        backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.04)",
        marginLeft: 68,
      }}
    />
  );
}

// ═══════════════════════════════════════════════════════
// Setting Row
// ═══════════════════════════════════════════════════════
function SettingRow({
  icon,
  label,
  sublabel,
  onPress,
  danger,
  right,
  colors,
  isDark,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
  colors: any;
  isDark: boolean;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress && !right}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 13,
        paddingHorizontal: 14,
        opacity: pressed && onPress ? 0.7 : 1,
      })}
    >
      <View
        style={{
          width: 38, height: 38, borderRadius: 12,
          backgroundColor: danger
            ? (isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2")
            : colors.primaryLight,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={17} color={danger ? "#EF4444" : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontSize: 15, fontWeight: "600",
            color: danger ? "#EF4444" : colors.text,
          }}
        >
          {label}
        </Text>
        {sublabel && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>
            {sublabel}
          </Text>
        )}
      </View>
      {right || (onPress && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />)}
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Theme Toggle — pills
// ═══════════════════════════════════════════════════════
function ThemeToggle({ colors }: { colors: any }) {
  const { mode, setMode } = useThemePrefs();

  const options: { key: ThemeMode; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: "auto", label: "Auto", icon: "phone-portrait-outline" },
    { key: "light", label: "Clair", icon: "sunny-outline" },
    { key: "dark", label: "Sombre", icon: "moon-outline" },
  ];

  return (
    <View style={{ flexDirection: "row", gap: 5 }}>
      {options.map((opt) => {
        const active = mode === opt.key;
        return (
          <Pressable
            key={opt.key}
            testID={`theme-toggle-${opt.key}`}
            onPress={() => setMode(opt.key)}
            style={{
              flexDirection: "row", alignItems: "center", gap: 4,
              paddingHorizontal: 10, paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: active ? colors.primary : colors.bgTertiary,
            }}
          >
            <Ionicons name={opt.icon} size={13} color={active ? "#FFF" : colors.textSecondary} />
            <Text style={{ fontSize: 11, fontWeight: "700", color: active ? "#FFF" : colors.textSecondary }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Switch Row
// ═══════════════════════════════════════════════════════
function SwitchRow({
  icon,
  label,
  sublabel,
  value,
  onValueChange,
  colors,
  isDark,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sublabel?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  colors: any;
  isDark: boolean;
  testID?: string;
}) {
  return (
    <View
      style={{
        flexDirection: "row", alignItems: "center", gap: 14,
        paddingVertical: 13, paddingHorizontal: 14,
      }}
    >
      <View
        style={{
          width: 38, height: 38, borderRadius: 12,
          backgroundColor: colors.primaryLight,
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: colors.text }}>{label}</Text>
        {sublabel && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>{sublabel}</Text>
        )}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: isDark ? colors.bgTertiary : "#E5E7EB", true: colors.primary }}
        thumbColor="#FFF"
      />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function SettingsScreen() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, session } = useAuthStatus();
  const user = session?.data?.user;

  const [pushEnabled, setPushEnabled] = useState(true);
  const [emailNotifs, setEmailNotifs] = useState(true);

  const onLogout = () => {
    Alert.alert(
      "Se déconnecter",
      "Es-tu sûr de vouloir te déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Se déconnecter",
          style: "destructive",
          onPress: async () => {
            try {
              await authClient.signOut();
              router.replace("/(tabs)/profile");
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
            }
          },
        },
      ]
    );
  };

  const onDeleteAccount = () => {
    Alert.alert(
      "Supprimer le compte",
      "Cette action est irréversible. Toutes tes données, annonces et réservations seront supprimées définitivement.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirmer la suppression",
              "Dernière chance ! Tape « SUPPRIMER » pour confirmer.",
              [{ text: "Annuler", style: "cancel" }]
            );
            // TODO: implémenter la suppression côté backend
          },
        },
      ]
    );
  };

  const onShareApp = async () => {
    try {
      await Share.share({
        message: "Découvre Kreeny — la location de voitures entre particuliers au Maroc ! 🚗 https://kreeny.ma",
      });
    } catch {}
  };

  const onContactSupport = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Support Kreeny v${APP_VERSION}`);
  };

  return (
    <SafeAreaView
      testID="settings-screen"
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row", alignItems: "center", gap: 12,
          paddingHorizontal: 14, height: 56,
        }}
      >
        <Pressable
          testID="settings-back-btn"
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <View
            style={{
              width: 40, height: 40, borderRadius: 12,
              backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </View>
        </Pressable>
        <Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>Paramètres</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 40 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Profil ── */}
        {isAuthenticated && (
          <>
            <SectionLabel text="Profil" colors={colors} />
            <SectionCard colors={colors} isDark={isDark}>
              {/* User info banner */}
              <View
                style={{
                  flexDirection: "row", alignItems: "center", gap: 14,
                  padding: 14,
                }}
              >
                <View
                  style={{
                    width: 50, height: 50, borderRadius: 25,
                    backgroundColor: colors.primaryLight,
                    alignItems: "center", justifyContent: "center",
                  }}
                >
                  <Ionicons name="person" size={22} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text }}>
                    {user?.name || "Mon profil"}
                  </Text>
                  <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 1 }}>
                    {user?.email || "—"}
                  </Text>
                </View>
              </View>
              <Sep colors={colors} isDark={isDark} />
              <SettingRow
                testID="settings-avatar"
                icon="camera-outline"
                label="Photo de profil"
                sublabel="Change ta photo visible par les autres"
                onPress={() => router.push("/profile/avatar")}
                colors={colors}
                isDark={isDark}
              />
            </SectionCard>
          </>
        )}

        {/* ── Apparence ── */}
        <SectionLabel text="Apparence" colors={colors} />
        <SectionCard colors={colors} isDark={isDark}>
          <SettingRow
            icon="color-palette-outline"
            label="Thème"
            sublabel="Clair, sombre ou automatique"
            right={<ThemeToggle colors={colors} />}
            colors={colors}
            isDark={isDark}
          />
        </SectionCard>

        {/* ── Notifications ── */}
        <SectionLabel text="Notifications" colors={colors} />
        <SectionCard colors={colors} isDark={isDark}>
          <SwitchRow
            testID="settings-push-notifs"
            icon="notifications-outline"
            label="Notifications push"
            sublabel="Nouvelles demandes, messages, rappels"
            value={pushEnabled}
            onValueChange={setPushEnabled}
            colors={colors}
            isDark={isDark}
          />
          <Sep colors={colors} isDark={isDark} />
          <SwitchRow
            testID="settings-email-notifs"
            icon="mail-outline"
            label="Notifications email"
            sublabel="Récapitulatifs et confirmations"
            value={emailNotifs}
            onValueChange={setEmailNotifs}
            colors={colors}
            isDark={isDark}
          />
        </SectionCard>

        {/* ── Compte / Sécurité ── */}
        {isAuthenticated && (
          <>
            <SectionLabel text="Compte" colors={colors} />
            <SectionCard colors={colors} isDark={isDark}>
              <SettingRow
                testID="settings-listings"
                icon="car-outline"
                label="Mes annonces"
                sublabel="Gérer tes véhicules publiés"
                onPress={() => router.push("/profile/listings")}
                colors={colors}
                isDark={isDark}
              />
              <Sep colors={colors} isDark={isDark} />
              <SettingRow
                testID="settings-reservations"
                icon="calendar-outline"
                label="Mes réservations"
                sublabel="Historique et en cours"
                onPress={() => router.push("/profile/reservations")}
                colors={colors}
                isDark={isDark}
              />
              <Sep colors={colors} isDark={isDark} />
              <SettingRow
                testID="settings-dashboard"
                icon="stats-chart-outline"
                label="Tableau de bord"
                sublabel="Vue d'ensemble propriétaire"
                onPress={() => router.push("/profile/dashboard")}
                colors={colors}
                isDark={isDark}
              />
              <Sep colors={colors} isDark={isDark} />
              <SettingRow
                testID="settings-logout"
                icon="log-out-outline"
                label="Se déconnecter"
                danger
                onPress={onLogout}
                colors={colors}
                isDark={isDark}
              />
            </SectionCard>
          </>
        )}

        {/* ── Non connecté ── */}
        {!isAuthenticated && (
          <>
            <SectionLabel text="Compte" colors={colors} />
            <SectionCard colors={colors} isDark={isDark}>
              <SettingRow
                testID="settings-login"
                icon="log-in-outline"
                label="Se connecter"
                onPress={() => router.push("/login")}
                colors={colors}
                isDark={isDark}
              />
              <Sep colors={colors} isDark={isDark} />
              <SettingRow
                testID="settings-signup"
                icon="person-add-outline"
                label="Créer un compte"
                onPress={() => router.push("/signup")}
                colors={colors}
                isDark={isDark}
              />
            </SectionCard>
          </>
        )}

        {/* ── Légal ── */}
        <SectionLabel text="Légal" colors={colors} />
        <SectionCard colors={colors} isDark={isDark}>
          <SettingRow
            testID="settings-terms"
            icon="document-text-outline"
            label="Conditions d'utilisation"
            onPress={() => Linking.openURL("https://kreeny.ma/cgu")}
            colors={colors}
            isDark={isDark}
          />
          <Sep colors={colors} isDark={isDark} />
          <SettingRow
            testID="settings-privacy"
            icon="shield-checkmark-outline"
            label="Politique de confidentialité"
            onPress={() => Linking.openURL("https://kreeny.ma/confidentialite")}
            colors={colors}
            isDark={isDark}
          />
        </SectionCard>

        {/* ── Support ── */}
        <SectionLabel text="Support" colors={colors} />
        <SectionCard colors={colors} isDark={isDark}>
          <SettingRow
            testID="settings-help"
            icon="help-circle-outline"
            label="Centre d'aide"
            sublabel="FAQ et guides"
            onPress={() => Linking.openURL("https://kreeny.ma/aide")}
            colors={colors}
            isDark={isDark}
          />
          <Sep colors={colors} isDark={isDark} />
          <SettingRow
            testID="settings-contact"
            icon="chatbubble-ellipses-outline"
            label="Contacter le support"
            sublabel={SUPPORT_EMAIL}
            onPress={onContactSupport}
            colors={colors}
            isDark={isDark}
          />
          <Sep colors={colors} isDark={isDark} />
          <SettingRow
            testID="settings-bug"
            icon="bug-outline"
            label="Signaler un problème"
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Bug Report Kreeny v${APP_VERSION}`)}
            colors={colors}
            isDark={isDark}
          />
        </SectionCard>

        {/* ── À propos ── */}
        <SectionLabel text="À propos" colors={colors} />
        <SectionCard colors={colors} isDark={isDark}>
          <SettingRow
            testID="settings-share"
            icon="share-outline"
            label="Partager Kreeny"
            sublabel="Invite tes amis"
            onPress={onShareApp}
            colors={colors}
            isDark={isDark}
          />
          <Sep colors={colors} isDark={isDark} />
          <SettingRow
            testID="settings-rate"
            icon="star-outline"
            label="Évaluer l'app"
            sublabel="Laisse un avis sur le Store"
            onPress={() => {
              // TODO: Linking.openURL(store_url)
              Alert.alert("Merci !", "Tu seras redirigé vers le store bientôt.");
            }}
            colors={colors}
            isDark={isDark}
          />
          <Sep colors={colors} isDark={isDark} />
          <SettingRow
            icon="information-circle-outline"
            label="Version"
            sublabel={`Kreeny v${APP_VERSION} • Location de voitures au Maroc`}
            colors={colors}
            isDark={isDark}
          />
        </SectionCard>

        {/* ── Zone dangereuse ── */}
        {isAuthenticated && (
          <>
            <SectionLabel text="Zone dangereuse" colors={colors} />
            <SectionCard colors={colors} isDark={isDark}>
              <SettingRow
                testID="settings-delete-account"
                icon="trash-outline"
                label="Supprimer le compte"
                sublabel="Action irréversible"
                danger
                onPress={onDeleteAccount}
                colors={colors}
                isDark={isDark}
              />
            </SectionCard>
          </>
        )}

        {/* Footer */}
        <Text
          style={{
            textAlign: "center", fontSize: 12, color: colors.textTertiary,
            marginTop: 8, paddingHorizontal: 18,
          }}
        >
          Fait avec 💙 au Maroc
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}