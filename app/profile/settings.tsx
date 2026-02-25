import { router } from "expo-router";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { authClient } from "../../src/lib/auth-client";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { useTheme, spacing, radius } from "../../src/theme";
import { useThemePrefs, type ThemeMode } from "../../src/theme/ThemePrefsProvider";

function SettingRow({
  icon,
  label,
  sublabel,
  onPress,
  danger,
  right,
}: {
  icon: string;
  label: string;
  sublabel?: string;
  onPress?: () => void;
  danger?: boolean;
  right?: React.ReactNode;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !right}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 16,
        opacity: pressed && onPress ? 0.8 : 1,
      })}
    >
      <View style={{
        width: 38, height: 38, borderRadius: 12,
        backgroundColor: danger ? colors.errorLight : colors.primaryLight,
        alignItems: "center", justifyContent: "center",
      }}>
        <Ionicons name={icon as any} size={18} color={danger ? colors.error : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 15, fontWeight: "600", color: danger ? colors.error : colors.text }}>
          {label}
        </Text>
        {sublabel && (
          <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>{sublabel}</Text>
        )}
      </View>
      {right || (onPress && <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />)}
    </Pressable>
  );
}

function ThemeToggle() {
  const { colors, isDark } = useTheme();
  const { mode, setMode } = useThemePrefs();

  const options: { key: ThemeMode; label: string; icon: string }[] = [
    { key: "auto", label: "Auto", icon: "phone-portrait-outline" },
    { key: "light", label: "Clair", icon: "sunny-outline" },
    { key: "dark", label: "Sombre", icon: "moon-outline" },
  ];

  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {options.map((opt) => {
        const active = mode === opt.key;
        return (
          <Pressable
            key={opt.key}
            onPress={() => setMode(opt.key)}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 5,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 999,
              backgroundColor: active ? colors.primary : colors.bgTertiary,
            }}
          >
            <Ionicons name={opt.icon as any} size={14} color={active ? "#FFF" : colors.textSecondary} />
            <Text style={{ fontSize: 12, fontWeight: "700", color: active ? "#FFF" : colors.textSecondary }}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  const { colors, isDark } = useTheme();

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: isDark ? 1 : 0,
      borderColor: colors.cardBorder,
      overflow: "hidden",
      marginHorizontal: 18,
      marginBottom: 16,
    }}>
      {children}
    </View>
  );
}

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { isLoading, isAuthenticated, session } = useAuthStatus();
  const user = session?.data?.user;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.bg }}
      contentContainerStyle={{ paddingTop: 12, paddingBottom: 40 }}
    >
      {/* Apparence */}
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginLeft: 18, marginBottom: 8, textTransform: "uppercase" }}>
        Apparence
      </Text>
      <SectionCard>
        <SettingRow
          icon="color-palette-outline"
          label="Thème"
          sublabel="Clair, sombre ou automatique"
          right={<ThemeToggle />}
        />
      </SectionCard>

      {/* Compte */}
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginLeft: 18, marginBottom: 8, textTransform: "uppercase" }}>
        Compte
      </Text>
      <SectionCard>
        {isAuthenticated ? (
          <>
            <SettingRow
              icon="person-outline"
              label={user?.email ?? "Mon compte"}
              sublabel="Compte connecté"
            />
            <View style={{ height: 1, backgroundColor: colors.borderLight, marginLeft: 68 }} />
            <SettingRow
              icon="image-outline"
              label="Photo de profil"
              onPress={() => router.push("/profile/avatar")}
            />
            <View style={{ height: 1, backgroundColor: colors.borderLight, marginLeft: 68 }} />
            <SettingRow
              icon="log-out-outline"
              label="Se déconnecter"
              danger
              onPress={async () => {
                try {
                  await authClient.signOut();
                  Alert.alert("OK", "Déconnecté");
                  router.replace("/(tabs)/profile");
                } catch (e) {
                  Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
                }
              }}
            />
          </>
        ) : (
          <>
            <SettingRow
              icon="log-in-outline"
              label="Se connecter"
              onPress={() => router.push("/login")}
            />
            <View style={{ height: 1, backgroundColor: colors.borderLight, marginLeft: 68 }} />
            <SettingRow
              icon="person-add-outline"
              label="Créer un compte"
              onPress={() => router.push("/signup")}
            />
          </>
        )}
      </SectionCard>

      {/* À propos */}
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginLeft: 18, marginBottom: 8, textTransform: "uppercase" }}>
        À propos
      </Text>
      <SectionCard>
        <SettingRow
          icon="information-circle-outline"
          label="Kreeny"
          sublabel="Version 1.0.0 • Location de voitures au Maroc"
        />
      </SectionCard>
    </ScrollView>
  );
}
