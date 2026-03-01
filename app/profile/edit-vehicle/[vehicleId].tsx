import { Ionicons } from "@expo/vector-icons";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { haptic, radius } from "../../../src/theme";
import { showErrorToast, showSuccessToast } from "../../../src/presentation/components/Toast";
import {
  KText,
  KRow,
  KVStack,
  KSpacer,
  KDivider,
  KPressable,
  KButton,
  createStyles,
} from "../../../src/ui";

// ═══════════════════════════════════════════════════════
// CONSTANTS (same as publish)
// ═══════════════════════════════════════════════════════
const BRANDS = [
  "Audi","BMW","Citroën","Dacia","Fiat","Ford","Honda","Hyundai",
  "Kia","Mercedes","Nissan","Opel","Peugeot","Renault","Seat",
  "Skoda","Tesla","Toyota","Volkswagen","Autre",
];

const CITIES = ["Casablanca","Rabat","Marrakech","Tanger","Fès","Agadir","Kénitra","Meknès"];

const EQUIP_SECTIONS = [
  {
    title: "Sécurité", icon: "shield-outline" as const,
    items: [
      { key: "rear_camera", label: "Caméra de recul", icon: "videocam-outline" as const },
      { key: "parking_sensors", label: "Radar de recul", icon: "radio-outline" as const },
      { key: "blind_spot", label: "Angles morts", icon: "eye-off-outline" as const },
      { key: "brake_assist", label: "Freinage assisté", icon: "hand-left-outline" as const },
    ],
  },
  {
    title: "Connectivité", icon: "wifi-outline" as const,
    items: [
      { key: "carplay", label: "Apple CarPlay", icon: "logo-apple" as const },
      { key: "android_auto", label: "Android Auto", icon: "logo-google" as const },
      { key: "bluetooth", label: "Bluetooth", icon: "bluetooth-outline" as const },
      { key: "usb_port", label: "Port USB", icon: "flash-outline" as const },
    ],
  },
  {
    title: "Confort", icon: "sparkles-outline" as const,
    items: [
      { key: "gps", label: "GPS intégré", icon: "navigate-outline" as const },
      { key: "keyless", label: "Accès sans clé", icon: "key-outline" as const },
      { key: "heated_seats", label: "Sièges chauffants", icon: "sunny-outline" as const },
      { key: "pets_ok", label: "Animaux acceptés", icon: "paw-outline" as const },
    ],
  },
];

const DESC_MAX = 800;

// ═══════════════════════════════════════════════════════
// SMALL COMPONENTS
// ═══════════════════════════════════════════════════════
function SectionTitle({ icon, title }: { icon: string; title: string }) {
  const { colors } = useSectionStyles();
  return (
    <KRow gap="sm" style={{ alignItems: "center", marginBottom: 14 }}>
      <Ionicons name={icon as any} size={18} color={colors.primary} />
      <KText variant="label" bold style={{ fontSize: 15 }}>{title}</KText>
    </KRow>
  );
}
const useSectionStyles = createStyles((colors) => ({}));

function Field({ label, value, onChangeText, placeholder, keyboardType, suffix, multiline, maxLength }: {
  label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string;
  keyboardType?: string; suffix?: string; multiline?: boolean; maxLength?: number;
}) {
  const { styles, colors, isDark } = useFieldStyles();
  return (
    <KVStack gap={4}>
      {label && <KText variant="caption" bold color="textSecondary" style={{ fontSize: 11, textTransform: "uppercase" }}>{label}</KText>}
      <View style={styles.inputRow}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          keyboardType={keyboardType as any}
          style={[styles.input, multiline && { height: 100, textAlignVertical: "top" }]}
          multiline={multiline}
          maxLength={maxLength}
        />
        {suffix && <KText variant="caption" color="textTertiary" style={{ marginLeft: 8 }}>{suffix}</KText>}
      </View>
    </KVStack>
  );
}
const useFieldStyles = createStyles((colors, isDark) => ({
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: isDark ? colors.bgTertiary : "#F7F8FA",
    borderRadius: 12, paddingHorizontal: 14,
  },
  input: {
    flex: 1, paddingVertical: 12, fontSize: 15, color: colors.text,
  },
}));

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors, isDark } = useChipStyles();
  return (
    <KPressable onPress={onPress} style={[
      { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
      { backgroundColor: active ? colors.primaryLight : (isDark ? colors.bgTertiary : "rgba(0,0,0,0.03)") },
      { borderColor: active ? colors.primary : "transparent" },
    ]}>
      <KText variant="labelSmall" color={active ? "primary" : "text"} bold={active}>{label}</KText>
    </KPressable>
  );
}
const useChipStyles = createStyles((colors) => ({}));

function EquipToggle({ label, icon, active, onPress }: { label: string; icon: string; active: boolean; onPress: () => void }) {
  const { colors, isDark } = useEquipStyles();
  return (
    <KPressable onPress={onPress} style={[
      { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
      active && { backgroundColor: isDark ? "rgba(59,130,246,0.08)" : "#F0F6FF" },
    ]}>
      <Ionicons name={icon as any} size={16} color={active ? colors.primary : colors.textTertiary} />
      <KText variant="bodySmall" style={{ flex: 1 }} color={active ? "text" : "textSecondary"}>{label}</KText>
      <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={18} color={active ? colors.primary : colors.textTertiary} />
    </KPressable>
  );
}
const useEquipStyles = createStyles((colors) => ({}));

// ═══════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════
function EditSkeleton() {
  const { colors } = useStyles();
  const B = ({ w, h }: { w: number | string; h: number }) => (
    <View style={{ width: w, height: h, borderRadius: 10, backgroundColor: colors.bgTertiary }} />
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ padding: 18, gap: 16 }}>
        <B w="40%" h={20} />
        <B w="100%" h={48} />
        <B w="100%" h={48} />
        <B w="60%" h={20} />
        <B w="100%" h={48} />
        <B w="100%" h={48} />
      </View>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function EditVehicle() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();

  const vehicle = useQuery(api.vehicles.getVehicleById, vehicleId ? { id: vehicleId as any } : "skip");
  const updateMut = useMutation(api.vehicles.updateVehicle);
  const [saving, setSaving] = useState(false);

  // ── Form state ──
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");
  const [transmission, setTransmission] = useState("auto");
  const [fuel, setFuel] = useState("essence");
  const [seats, setSeats] = useState("");
  const [description, setDescription] = useState("");
  const [pricePerDay, setPricePerDay] = useState("");
  const [city, setCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [delivery, setDelivery] = useState(false);
  const [dlvRadius, setDlvRadius] = useState("");
  const [dlvPrice, setDlvPrice] = useState("");
  const [equip, setEquip] = useState<string[]>([]);

  // ── Prefill from vehicle ──
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    if (vehicle && !prefilled) {
      setBrand(vehicle.brand || "");
      setModel(vehicle.model || "");
      setYear(vehicle.year ? String(vehicle.year) : "");
      setTransmission(vehicle.transmission || "auto");
      setFuel(vehicle.fuel || "essence");
      setSeats(vehicle.seats ? String(vehicle.seats) : "");
      setDescription(vehicle.description || "");
      setPricePerDay(String(vehicle.pricePerDay || ""));
      const vehicleCity = (vehicle as any).city || "";
      if (CITIES.includes(vehicleCity)) {
        setCity(vehicleCity);
      } else if (vehicleCity) {
        setCity("__other");
        setCustomCity(vehicleCity);
      }
      setDelivery(!!(vehicle as any).delivery);
      setDlvRadius((vehicle as any).deliveryRadiusKm ? String((vehicle as any).deliveryRadiusKm) : "");
      setDlvPrice((vehicle as any).deliveryPrice ? String((vehicle as any).deliveryPrice) : "");
      const allEquip = [
        ...((vehicle as any).featuresSafety || []),
        ...((vehicle as any).featuresConnect || []),
        ...((vehicle as any).featuresAmenities || []),
      ];
      setEquip(allEquip);
      setPrefilled(true);
    }
  }, [vehicle, prefilled]);

  // ── Derived ──
  const selectedCity = city === "__other" ? customCity.trim() : city;
  const priceNum = Number(pricePerDay) || 0;
  const seatsNum = Number(seats) || 0;
  const yearNum = Number(year) || 0;
  const autoTitle = `${brand} ${model}${yearNum ? ` ${yearNum}` : ""}`.trim();

  const toggleEquip = (key: string) => setEquip((e) => e.includes(key) ? e.filter((k) => k !== key) : [...e, key]);

  const canSave = brand.trim() !== "" && model.trim() !== "" && priceNum >= 50 && selectedCity.length >= 2;

  // ── Save ──
  const onSave = async () => {
    if (!canSave || saving) return;
    Keyboard.dismiss();
    setSaving(true);
    try {
      const safetyKeys = EQUIP_SECTIONS[0].items.map((i) => i.key);
      const connectKeys = EQUIP_SECTIONS[1].items.map((i) => i.key);
      const amenityKeys = EQUIP_SECTIONS[2].items.map((i) => i.key);

      await updateMut({
        vehicleId: vehicleId as any,
        title: autoTitle,
        brand: brand.trim(),
        model: model.trim(),
        year: yearNum || undefined,
        transmission,
        fuel,
        seats: seatsNum || undefined,
        description: description.trim() || undefined,
        pricePerDay: priceNum,
        city: selectedCity,
        featuresSafety: equip.filter((k) => safetyKeys.includes(k)),
        featuresConnect: equip.filter((k) => connectKeys.includes(k)),
        featuresAmenities: equip.filter((k) => amenityKeys.includes(k)),
        delivery: delivery || undefined,
        deliveryRadiusKm: delivery && dlvRadius ? Number(dlvRadius) : undefined,
        deliveryPrice: delivery && dlvPrice ? Number(dlvPrice) : undefined,
      });

      haptic.success();
      showSuccessToast("Annonce modifiée");
      router.back();
    } catch (e) {
      showErrorToast(e);
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ──
  if (!vehicleId) return null;
  if (vehicle === undefined) return <EditSkeleton />;
  if (vehicle === null) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <KText color="textSecondary">Annonce introuvable</KText>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <KRow gap={8} style={styles.header}>
        <KPressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <View style={{ flex: 1 }}>
          <KText variant="label" bold style={{ fontSize: 17 }}>Modifier l'annonce</KText>
        </View>
      </KRow>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingBottom: Math.max(insets.bottom, 12) + 90, gap: 0 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ═══ IDENTITÉ ═══ */}
          <SectionTitle icon="car-sport-outline" title="Identité" />
          <KVStack gap="md">
            <KText variant="bodySmall" bold color="textSecondary">Marque</KText>
            <KRow gap="sm" wrap>
              {BRANDS.map((b) => <Chip key={b} label={b} active={brand === b} onPress={() => setBrand(brand === b ? "" : b)} />)}
            </KRow>
            <Field label="Modèle" value={model} onChangeText={setModel} placeholder="Ex: Clio, Golf, Série 3…" />
            <Field label="Année" value={year} onChangeText={(t) => setYear(t.replace(/\D/g, "").slice(0, 4))} placeholder="2022" keyboardType="number-pad" />
          </KVStack>

          <KDivider style={{ marginVertical: 22 }} />

          {/* ═══ CARACTÉRISTIQUES ═══ */}
          <SectionTitle icon="settings-outline" title="Caractéristiques" />
          <KVStack gap="md">
            <KVStack gap="sm">
              <KText variant="bodySmall" bold color="textSecondary">Transmission</KText>
              <KRow gap="sm">
                <Chip label="Automatique" active={transmission === "auto"} onPress={() => setTransmission("auto")} />
                <Chip label="Manuelle" active={transmission === "manual"} onPress={() => setTransmission("manual")} />
              </KRow>
            </KVStack>
            <KVStack gap="sm">
              <KText variant="bodySmall" bold color="textSecondary">Carburant</KText>
              <KRow gap="sm" wrap>
                {[{ key: "essence", label: "Essence" }, { key: "diesel", label: "Diesel" }, { key: "hybrid", label: "Hybride" }, { key: "electric", label: "Électrique" }].map((f) => (
                  <Chip key={f.key} label={f.label} active={fuel === f.key} onPress={() => setFuel(f.key)} />
                ))}
              </KRow>
            </KVStack>
            <Field label="Nombre de places" value={seats} onChangeText={(t) => setSeats(t.replace(/\D/g, "").slice(0, 1))} placeholder="5" keyboardType="number-pad" />
          </KVStack>

          <KDivider style={{ marginVertical: 22 }} />

          {/* ═══ DESCRIPTION ═══ */}
          <SectionTitle icon="document-text-outline" title="Description" />
          <Field value={description} onChangeText={setDescription} placeholder="Décris ton véhicule, son état, ce qui le rend unique…" multiline maxLength={DESC_MAX} />
          <KText variant="caption" color="textTertiary" style={{ marginTop: 4, alignSelf: "flex-end" }}>{description.length}/{DESC_MAX}</KText>

          <KDivider style={{ marginVertical: 22 }} />

          {/* ═══ PRIX & LIEU ═══ */}
          <SectionTitle icon="pricetag-outline" title="Prix & lieu" />
          <KVStack gap="md">
            <Field label="Prix par jour" value={pricePerDay} onChangeText={(t) => setPricePerDay(t.replace(/\D/g, ""))} placeholder="250" keyboardType="number-pad" suffix="MAD/jour" />
            <KVStack gap="sm">
              <KText variant="bodySmall" bold color="textSecondary">Ville</KText>
              <KRow gap="sm" wrap>
                {CITIES.map((c) => <Chip key={c} label={c} active={city === c} onPress={() => { setCity(city === c ? "" : c); setCustomCity(""); }} />)}
                <Chip label="Autre" active={city === "__other"} onPress={() => setCity(city === "__other" ? "" : "__other")} />
              </KRow>
              {city === "__other" && (
                <Field value={customCity} onChangeText={setCustomCity} placeholder="Nom de ta ville" />
              )}
            </KVStack>
          </KVStack>

          <KDivider style={{ marginVertical: 22 }} />

          {/* ═══ ÉQUIPEMENTS ═══ */}
          <SectionTitle icon="sparkles-outline" title="Équipements" />
          {EQUIP_SECTIONS.map((sec) => (
            <KVStack key={sec.title} gap={2} style={{ marginBottom: 14 }}>
              <KRow gap={6} style={{ alignItems: "center", marginBottom: 6 }}>
                <Ionicons name={sec.icon} size={14} color={colors.textTertiary} />
                <KText variant="caption" bold color="textTertiary">{sec.title}</KText>
              </KRow>
              {sec.items.map((item) => (
                <EquipToggle key={item.key} label={item.label} icon={item.icon} active={equip.includes(item.key)} onPress={() => toggleEquip(item.key)} />
              ))}
            </KVStack>
          ))}

          <KDivider style={{ marginVertical: 22 }} />

          {/* ═══ LIVRAISON ═══ */}
          <SectionTitle icon="car-outline" title="Livraison" />
          <KPressable onPress={() => setDelivery(!delivery)} style={styles.toggleRow}>
            <KText variant="label">Livraison possible</KText>
            <View style={[styles.toggle, { backgroundColor: delivery ? colors.primary : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)") }]}>
              <View style={[styles.toggleThumb, { alignSelf: delivery ? "flex-end" : "flex-start" }]} />
            </View>
          </KPressable>
          {delivery && (
            <KRow gap="sm" style={{ marginTop: 12 }}>
              <View style={{ flex: 1 }}><Field label="Rayon" value={dlvRadius} onChangeText={(t) => setDlvRadius(t.replace(/\D/g, ""))} placeholder="30" keyboardType="number-pad" suffix="km" /></View>
              <View style={{ flex: 1 }}><Field label="Prix livraison" value={dlvPrice} onChangeText={(t) => setDlvPrice(t.replace(/\D/g, ""))} placeholder="50" keyboardType="number-pad" suffix="MAD" /></View>
            </KRow>
          )}

          {/* ═══ INFO ANNULATION ═══ */}
          <KRow gap="sm" style={[styles.infoHint, { marginTop: 22 }]}>
            <Ionicons name="shield-half-outline" size={16} color="#F59E0B" />
            <KText variant="caption" color="textSecondary" style={{ flex: 1 }}>Politique d'annulation : Modérée — gratuit jusqu'à 3 jours avant le départ</KText>
          </KRow>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Sticky Save ── */}
      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <KButton
          title={saving ? "Enregistrement…" : "Sauvegarder"}
          onPress={onSave}
          disabled={!canSave || saving}
          fullWidth
          size="lg"
        />
      </View>
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const useStyles = createStyles((colors, isDark) => ({
  header: {
    paddingHorizontal: 14, paddingVertical: 10, alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center",
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
  },
  toggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8", borderRadius: 14, padding: 14,
  },
  toggle: { width: 44, height: 26, borderRadius: 13, justifyContent: "center", paddingHorizontal: 3 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFF" },
  infoHint: {
    backgroundColor: isDark ? "rgba(245,158,11,0.08)" : "#FFFBEB",
    borderRadius: 12, padding: 12, alignItems: "center",
  },
  stickyBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 18, paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
}));
