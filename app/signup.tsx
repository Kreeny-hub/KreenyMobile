import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../src/lib/auth-client";
import { useTheme } from "../src/theme";

// ═══════════════════════════════════════════════════════
// Social providers
// ═══════════════════════════════════════════════════════
const SOCIAL_PROVIDERS = [
  { id: "google", label: "Google", icon: "logo-google" as const, color: "#DB4437" },
  { id: "apple", label: "Apple", icon: "logo-apple" as const, color: "#000000" },
  { id: "facebook", label: "Facebook", icon: "logo-facebook" as const, color: "#1877F2" },
];

// ═══════════════════════════════════════════════════════
// Input field
// ═══════════════════════════════════════════════════════
function FormInput({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  autoCapitalize,
  keyboardType,
  colors,
  isDark,
  testID,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "email-address";
  colors: any;
  isDark: boolean;
  testID: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, paddingLeft: 2 }}>
        {label}
      </Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: colors.inputBg,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: focused ? colors.primary : (isDark ? colors.inputBorder : "rgba(0,0,0,0.06)"),
          paddingHorizontal: 14,
          height: 52,
          gap: 10,
        }}
      >
        <Ionicons name={icon} size={18} color={focused ? colors.primary : colors.textTertiary} />
        <TextInput
          testID={testID}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.inputPlaceholder}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1,
            fontSize: 15,
            fontWeight: "500",
            color: colors.inputText,
            height: "100%",
          }}
        />
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Social Button
// ═══════════════════════════════════════════════════════
function SocialButton({
  icon,
  color,
  onPress,
  colors,
  isDark,
  testID,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
  colors: any;
  isDark: boolean;
  testID: string;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        height: 52,
        borderRadius: 14,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={22} color={isDark ? colors.text : color} />
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Divider
// ═══════════════════════════════════════════════════════
function Divider({ text, colors }: { text: string; colors: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 14, marginVertical: 4 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textTertiary }}>{text}</Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function SignupScreen() {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);

  const onSignup = async () => {
    if (!name.trim()) {
      Alert.alert("Champ requis", "Entre ton nom pour continuer.");
      return;
    }
    if (!email.trim()) {
      Alert.alert("Champ requis", "Entre ton email pour continuer.");
      return;
    }
    if (password.length < 6) {
      Alert.alert("Mot de passe trop court", "6 caractères minimum.");
      return;
    }
    setLoading(true);
    try {
      const res = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: name.trim(),
      } as any);
      if (res?.error) {
        Alert.alert("Erreur", String(res.error.message ?? "Inscription impossible"));
        return;
      }
      router.replace("/(tabs)/profile");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  const onSocialLogin = async (provider: string) => {
    setSocialLoading(provider);
    try {
      await authClient.signIn.social({ provider } as any);
      router.replace("/(tabs)/profile");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSocialLoading(null);
    }
  };

  return (
    <SafeAreaView testID="signup-screen" style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Back */}
          <Pressable
            testID="signup-back-btn"
            onPress={() => router.back()}
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1, marginBottom: 12 })}
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

          {/* Header */}
          <View style={{ marginBottom: 28 }}>
            <Text
              style={{
                fontSize: 28, fontWeight: "800", color: colors.text,
                letterSpacing: -0.5,
              }}
            >
              Créer un compte
            </Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, marginTop: 6, lineHeight: 22 }}>
              Rejoins Kreeny pour louer ou mettre en location un véhicule facilement.
            </Text>
          </View>

          {/* Form */}
          <View style={{ gap: 16 }}>
            <FormInput
              testID="signup-name-input"
              label="Comment tu t'appelles?"
              icon="person-outline"
              value={name}
              onChangeText={setName}
              placeholder="Ton nom"
              autoCapitalize="words"
              colors={colors}
              isDark={isDark}
            />
            <FormInput
              testID="signup-email-input"
              label="E-mail"
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="ton@email.com"
              autoCapitalize="none"
              keyboardType="email-address"
              colors={colors}
              isDark={isDark}
            />
            <FormInput
              testID="signup-password-input"
              label="Mot de passe"
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Juste ici... (8 caractères minimum)"
              secureTextEntry
              colors={colors}
              isDark={isDark}
            />
          </View>

          {/* Terms hint */}
          <Text style={{ fontSize: 12, color: colors.textTertiary, marginTop: 14, lineHeight: 18, paddingHorizontal: 2 }}>
            En créant un compte, tu acceptes nos{" "}
            <Text style={{ fontWeight: "700", color: colors.primary }}>conditions d'utilisation</Text>
            {" "}et notre{" "}
            <Text style={{ fontWeight: "700", color: colors.primary }}>politique de confidentialité</Text>.
          </Text>

          {/* Submit */}
          <Pressable
            testID="signup-submit-btn"
            onPress={onSignup}
            disabled={loading}
            style={({ pressed }) => ({
              backgroundColor: colors.primary,
              borderRadius: 14,
              height: 52,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 20,
              opacity: pressed || loading ? 0.75 : 1,
            })}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "800" }}>
                Créer mon compte
              </Text>
            )}
          </Pressable>

          {/* Divider */}
          <View style={{ marginTop: 22 }}>
            <Divider text="ou continuer avec" colors={colors} />
          </View>

          {/* Social */}
          <View style={{ flexDirection: "row", gap: 12, marginTop: 18 }}>
            {SOCIAL_PROVIDERS.map((p) => (
              <SocialButton
                key={p.id}
                testID={`signup-social-${p.id}`}
                icon={p.icon}
                color={p.color}
                onPress={() => onSocialLogin(p.id)}
                colors={colors}
                isDark={isDark}
              />
            ))}
          </View>

          {/* Footer */}
          <View style={{ flexDirection: "row", justifyContent: "center", marginTop: 24, gap: 4 }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>
              Déjà un compte ?
            </Text>
            <Pressable testID="goto-login-btn" onPress={() => router.push("/login")}>
              <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>
                Se connecter
              </Text>
            </Pressable>
          </View>

          {/* Spacer bottom */}
          <View style={{ height: 24 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
