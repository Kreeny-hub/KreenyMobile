import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../src/lib/auth-client";
import { KText, KVStack, KRow, KPressable, createStyles } from "../src/ui";

const SOCIAL_PROVIDERS = [
  { id: "google", label: "Google", icon: "logo-google" as const, color: "#DB4437" },
  { id: "apple", label: "Apple", icon: "logo-apple" as const, color: "#000000" },
  { id: "facebook", label: "Facebook", icon: "logo-facebook" as const, color: "#1877F2" },
];

// ═══════════════════════════════════════════════════════
// Form Input
// ═══════════════════════════════════════════════════════
function FormInput({ label, icon, value, onChangeText, placeholder, secureTextEntry, autoCapitalize, keyboardType, testID }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; value: string; onChangeText: (t: string) => void;
  placeholder?: string; secureTextEntry?: boolean; autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address"; testID: string;
}) {
  const { styles, colors } = useFormStyles();
  const [focused, setFocused] = useState(false);
  return (
    <KVStack gap={6}>
      <KText variant="bodySmall" color="textSecondary" style={{ paddingLeft: 2 }}>{label}</KText>
      <KRow gap="sm" style={[styles.inputRow, focused && { borderColor: colors.primary }]}>
        <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.textTertiary} />
        <TextInput testID={testID} value={value} onChangeText={onChangeText} placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder} secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize} keyboardType={keyboardType}
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
          style={styles.input} />
      </KRow>
    </KVStack>
  );
}
const useFormStyles = createStyles((colors, isDark) => ({
  inputRow: {
    backgroundColor: colors.inputBg, borderRadius: 14, borderWidth: 1.5,
    borderColor: isDark ? colors.inputBorder : "rgba(0,0,0,0.06)",
    paddingHorizontal: 14, height: 52, alignItems: "center",
  },
  input: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.inputText, height: "100%" },
}));

// ═══════════════════════════════════════════════════════
// Social Button
// ═══════════════════════════════════════════════════════
function SocialButton({ icon, label, color, onPress, loading, testID }: {
  icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void; loading?: boolean; testID: string;
}) {
  const { styles, colors, isDark } = useSocialStyles();
  return (
    <KPressable testID={testID} onPress={onPress} disabled={loading} style={styles.btn}>
      {loading ? <ActivityIndicator size="small" color={colors.textSecondary} /> : (
        <>
          <Ionicons name={icon} size={20} color={isDark ? colors.text : color} />
          <KText variant="label">{label}</KText>
        </>
      )}
    </KPressable>
  );
}
const useSocialStyles = createStyles((colors, isDark) => ({
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    height: 52, borderRadius: 14, backgroundColor: colors.card,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
}));

// ═══════════════════════════════════════════════════════
// Divider
// ═══════════════════════════════════════════════════════
function OrDivider({ text }: { text: string }) {
  const { colors } = useDividerStyles();
  return (
    <KRow gap="md" style={{ alignItems: "center", marginVertical: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <KText variant="caption" color="textTertiary" bold>{text}</KText>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </KRow>
  );
}
const useDividerStyles = createStyles((colors) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function LoginScreen() {
  const { styles, colors, isDark } = useStyles();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const onLogin = async () => {
    if (!email.trim() || !password) { Alert.alert("Champs requis", "Remplis ton email et mot de passe."); return; }
    setLoading(true);
    try {
      const res = await authClient.signIn.email({ email: email.trim(), password });
      if (res?.error) { Alert.alert("Erreur", String(res.error.message ?? "Connexion impossible")); return; }
      router.replace("/(tabs)/home");
    } catch (e) { Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue"); }
    finally { setLoading(false); }
  };

  const onSocialLogin = async (provider: string) => {
    setSocialLoading(provider);
    try { await authClient.signIn.social({ provider } as any); router.replace("/(tabs)/home"); }
    catch (e) { Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue"); }
    finally { setSocialLoading(null); }
  };

  return (
    <SafeAreaView testID="login-screen" style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

          <KPressable testID="login-back-btn" onPress={() => router.back()} style={[styles.backBtn, { marginBottom: 12 }]}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </KPressable>

          <KVStack style={{ marginBottom: 28 }}>
            <KText variant="displayMedium">Bon retour 👋</KText>
            <KText variant="body" color="textSecondary" style={{ marginTop: 6, lineHeight: 22 }}>
              Connecte-toi pour retrouver tes réservations et tes véhicules.
            </KText>
          </KVStack>

          <KVStack gap="md">
            <FormInput testID="login-email-input" label="E-mail" icon="mail-outline" value={email} onChangeText={setEmail} placeholder="ton@email.com" autoCapitalize="none" keyboardType="email-address" />
            <FormInput testID="login-password-input" label="Mot de passe" icon="lock-closed-outline" value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry />
          </KVStack>

          <KPressable testID="forgot-password-btn" style={{ alignSelf: "flex-end", marginTop: 10 }}>
            <KText variant="bodySmall" bold style={{ color: colors.primary }}>Mot de passe oublié ?</KText>
          </KPressable>

          <KPressable testID="login-submit-btn" onPress={onLogin} disabled={loading} style={styles.submitBtn}>
            {loading ? <ActivityIndicator color="#FFF" /> : <KText variant="label" bold color="textInverse" style={{ fontSize: 16 }}>Se connecter</KText>}
          </KPressable>

          <View style={{ marginTop: 22 }}><OrDivider text="ou continuer avec" /></View>

          <KVStack gap="sm" style={{ marginTop: 18 }}>
            {SOCIAL_PROVIDERS.map((p) => (
              <SocialButton key={p.id} testID={`login-social-${p.id}`} icon={p.icon} label={`Continuer avec ${p.label}`} color={p.color} loading={socialLoading === p.id} onPress={() => onSocialLogin(p.id)} />
            ))}
          </KVStack>

          <KRow justify="center" gap={4} style={{ marginTop: 24 }}>
            <KText variant="body" color="textSecondary">Pas encore de compte ?</KText>
            <KPressable testID="goto-signup-btn" onPress={() => router.push("/signup")}>
              <KText variant="body" bold style={{ color: colors.primary }}>Créer un compte</KText>
            </KPressable>
          </KRow>

          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", alignItems: "center", justifyContent: "center" },
  submitBtn: { backgroundColor: colors.primary, borderRadius: 14, height: 52, alignItems: "center", justifyContent: "center", marginTop: 20 },
}));
