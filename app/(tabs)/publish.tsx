import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { ensureAuth } from "../../src/presentation/utils/ensureAuth";
import { convex } from "../../src/shared/config/convex";
import { useTheme } from "../../src/theme";

// ═══════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════
const CITIES = [
  "Casablanca", "Rabat", "Marrakech", "Tanger",
  "Fès", "Agadir", "Kénitra", "Meknès",
];

// ═══════════════════════════════════════════════════════
// Chip
// ═══════════════════════════════════════════════════════
function Chip({
  label,
  active,
  onPress,
  colors,
  isDark,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: active
          ? colors.primaryLight
          : (isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)"),
        borderWidth: 1,
        borderColor: active ? colors.primary : "transparent",
        opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text
        style={{
          fontSize: 13,
          fontWeight: active ? "800" : "600",
          color: active ? colors.primary : colors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Form Input
// ═══════════════════════════════════════════════════════
function FormInput({
  label,
  icon,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  suffix,
  hint,
  error,
  colors,
  isDark,
  testID,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad";
  suffix?: string;
  hint?: string;
  error?: string | null;
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
          borderColor: error
            ? "#EF4444"
            : focused
              ? colors.primary
              : (isDark ? colors.inputBorder : "rgba(0,0,0,0.06)"),
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
        {suffix && (
          <Text style={{ fontSize: 13, fontWeight: "700", color: colors.textTertiary }}>
            {suffix}
          </Text>
        )}
      </View>
      {error && (
        <Text style={{ fontSize: 12, fontWeight: "600", color: "#EF4444", paddingLeft: 2 }}>
          {error}
        </Text>
      )}
      {hint && !error && (
        <Text style={{ fontSize: 12, color: colors.textTertiary, paddingLeft: 2 }}>
          {hint}
        </Text>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Section Card
// ═══════════════════════════════════════════════════════
function SectionCard({
  title,
  subtitle,
  icon,
  children,
  colors,
  isDark,
}: {
  title: string;
  subtitle?: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
  colors: any;
  isDark: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderRadius: 18,
        padding: 16,
        borderWidth: 1,
        borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
        gap: 14,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <View
          style={{
            width: 36, height: 36, borderRadius: 12,
            backgroundColor: colors.primaryLight,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name={icon} size={16} color={colors.primary} />
        </View>
        <View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>{title}</Text>
          {subtitle && (
            <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 1 }}>{subtitle}</Text>
          )}
        </View>
      </View>
      {children}
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
        <Ionicons name="car-outline" size={28} color={colors.textTertiary} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" }}>
        Connecte-toi pour publier une annonce
      </Text>
      <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
        Mets ton véhicule en location et gagne de l'argent.
      </Text>
      <Pressable
        testID="publish-login-btn"
        onPress={() => router.push("/login")}
        style={({ pressed }) => ({
          backgroundColor: colors.primary, borderRadius: 14,
          paddingVertical: 14, paddingHorizontal: 32,
          opacity: pressed ? 0.85 : 1, marginTop: 8,
        })}
      >
        <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Se connecter</Text>
      </Pressable>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function PublishScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthStatus();

  const [title, setTitle] = useState("");
  const [city, setCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [loading, setLoading] = useState(false);

  const selectedCity = city === "__other" ? customCity.trim() : city;

  const priceNum = Number(pricePerDay);
  const priceError = useMemo(() => {
    if (!pricePerDay) return null;
    if (!Number.isFinite(priceNum) || priceNum <= 0) return "Prix invalide";
    if (priceNum < 50) return "Minimum 50 MAD/jour";
    if (priceNum > 50000) return "Maximum 50 000 MAD/jour";
    return null;
  }, [pricePerDay, priceNum]);

  const titleError = useMemo(() => {
    if (!title) return null;
    if (title.trim().length < 3) return "Minimum 3 caractères";
    return null;
  }, [title]);

  const canSubmit = useMemo(() => {
    return (
      title.trim().length >= 3 &&
      selectedCity.length >= 2 &&
      Number.isFinite(priceNum) &&
      priceNum >= 50 &&
      priceNum <= 50000 &&
      !loading
    );
  }, [title, selectedCity, priceNum, loading]);

  const onPublish = async () => {
    if (!ensureAuth(isAuthenticated)) return;

    if (!canSubmit) {
      Alert.alert("Vérifie les champs", "Remplis tous les champs correctement.");
      return;
    }

    Keyboard.dismiss();
    setLoading(true);
    try {
      const res = await convex.mutation(api.vehicles.createVehicle, {
        title: title.trim(),
        city: selectedCity,
        pricePerDay: priceNum,
      });

      Alert.alert("Annonce créée !", "Ajoute des photos pour rendre ton annonce attractive.");
      router.push(`/vehicle/images?vehicleId=${res.vehicleId}`);

      // Reset form
      setTitle("");
      setCity("");
      setCustomCity("");
      setPricePerDay("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      if (msg.includes("ListingLimitReached")) {
        Alert.alert("Limite atteinte", "Tu peux publier jusqu'à 2 annonces avec un compte standard.");
        return;
      }
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <View testID="publish-screen" style={{ flex: 1, backgroundColor: colors.bg }}>
        <NotAuthenticated colors={colors} isDark={isDark} />
      </View>
    );
  }

  return (
    <View testID="publish-screen" style={{ flex: 1, backgroundColor: colors.bg }}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 18,
              paddingTop: insets.top + 8,
              paddingBottom: 40,
            }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Header */}
            <Text
              style={{
                fontSize: 28, fontWeight: "800", color: colors.text,
                letterSpacing: -0.5,
              }}
            >
              Publier
            </Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4, lineHeight: 20, marginBottom: 20 }}>
              Mets ton véhicule en location en quelques secondes.
            </Text>

            {/* Section 1: Identité */}
            <SectionCard
              title="Identité du véhicule"
              subtitle="Comment s'appelle ton véhicule ?"
              icon="car-sport-outline"
              colors={colors}
              isDark={isDark}
            >
              <FormInput
                testID="publish-title-input"
                label="Titre de l'annonce"
                icon="text-outline"
                value={title}
                onChangeText={setTitle}
                placeholder="Ex : Toyota Yaris 2020"
                hint="Marque + modèle + année recommandé"
                error={titleError}
                colors={colors}
                isDark={isDark}
              />
            </SectionCard>

            {/* Section 2: Ville */}
            <View style={{ marginTop: 14 }}>
              <SectionCard
                title="Localisation"
                subtitle="Où se trouve le véhicule ?"
                icon="location-outline"
                colors={colors}
                isDark={isDark}
              >
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {CITIES.map((c) => (
                    <Chip
                      key={c}
                      label={c}
                      active={city === c}
                      onPress={() => { setCity(city === c ? "" : c); setCustomCity(""); }}
                      colors={colors}
                      isDark={isDark}
                    />
                  ))}
                  <Chip
                    label="Autre ville"
                    active={city === "__other"}
                    onPress={() => setCity(city === "__other" ? "" : "__other")}
                    colors={colors}
                    isDark={isDark}
                  />
                </View>

                {city === "__other" && (
                  <FormInput
                    testID="publish-custom-city-input"
                    label="Nom de la ville"
                    icon="location-outline"
                    value={customCity}
                    onChangeText={setCustomCity}
                    placeholder="Entre le nom de ta ville"
                    colors={colors}
                    isDark={isDark}
                  />
                )}
              </SectionCard>
            </View>

            {/* Section 3: Prix */}
            <View style={{ marginTop: 14 }}>
              <SectionCard
                title="Tarification"
                subtitle="Combien par jour ?"
                icon="cash-outline"
                colors={colors}
                isDark={isDark}
              >
                <FormInput
                  testID="publish-price-input"
                  label="Prix par jour"
                  icon="pricetag-outline"
                  value={pricePerDay}
                  onChangeText={(t) => setPricePerDay(t.replace(/[^0-9]/g, ""))}
                  placeholder="250"
                  keyboardType="number-pad"
                  suffix="MAD/jour"
                  hint="Entre 50 et 50 000 MAD"
                  error={priceError}
                  colors={colors}
                  isDark={isDark}
                />

                {/* Price suggestion */}
                {priceNum >= 50 && priceNum <= 50000 && (
                  <View
                    style={{
                      backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.03)",
                      borderRadius: 12, padding: 12,
                      flexDirection: "row", alignItems: "center", gap: 10,
                    }}
                  >
                    <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
                    <Text style={{ flex: 1, fontSize: 12, fontWeight: "600", color: colors.textSecondary, lineHeight: 17 }}>
                      La caution sera calculée automatiquement. Pour {priceNum} MAD/jour, elle sera d'environ {Math.min(10000, Math.max(200, Math.round(priceNum * 10)))} MAD.
                    </Text>
                  </View>
                )}
              </SectionCard>
            </View>

            {/* Info tip */}
            <View
              style={{
                marginTop: 14,
                backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8",
                borderRadius: 14, padding: 14,
                flexDirection: "row", gap: 10, alignItems: "flex-start",
              }}
            >
              <Ionicons name="camera-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, fontSize: 13, fontWeight: "600", color: colors.textSecondary, lineHeight: 19 }}>
                Après la création, tu pourras ajouter des photos pour rendre ton annonce plus attractive.
              </Text>
            </View>

            {/* CTA */}
            <Pressable
              testID="publish-submit-btn"
              onPress={onPublish}
              disabled={!canSubmit}
              style={({ pressed }) => ({
                backgroundColor: canSubmit ? colors.primary : (isDark ? colors.bgTertiary : "rgba(0,0,0,0.08)"),
                borderRadius: 16,
                height: 54,
                alignItems: "center",
                justifyContent: "center",
                marginTop: 20,
                opacity: pressed && canSubmit ? 0.85 : 1,
              })}
            >
              {loading ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Ionicons
                    name="add-circle-outline"
                    size={20}
                    color={canSubmit ? "#FFF" : colors.textTertiary}
                  />
                  <Text
                    style={{
                      fontSize: 16, fontWeight: "800",
                      color: canSubmit ? "#FFF" : colors.textTertiary,
                    }}
                  >
                    Créer l'annonce
                  </Text>
                </View>
              )}
            </Pressable>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </View>
  );
}