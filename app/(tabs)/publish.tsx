import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { ensureAuth } from "../../src/presentation/utils/ensureAuth";
import { convex } from "../../src/shared/config/convex";
import { radius } from "../../src/theme";

// UI Kit
import {
  KText,
  KRow,
  KVStack,
  KSpacer,
  KDivider,
  KPressable,
  KButton,
  KCard,
  createStyles,
} from "../../src/ui";

const { width: SW } = Dimensions.get("window");
const GAP = 10;
const TILE = (SW - 14 * 2 - GAP) / 2;
const MAX_PHOTOS = 6;

// ═══════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════
const BRANDS = [
  "Audi","BMW","Citroën","Dacia","Fiat","Ford","Honda","Hyundai",
  "Kia","Mercedes","Nissan","Opel","Peugeot","Renault","Seat",
  "Skoda","Tesla","Toyota","Volkswagen","Autre",
];
const FUEL = [
  { key: "essence", label: "Essence", icon: "flame-outline" as const },
  { key: "diesel", label: "Diesel", icon: "water-outline" as const },
  { key: "hybrid", label: "Hybride", icon: "leaf-outline" as const },
  { key: "electric", label: "Électrique", icon: "flash-outline" as const },
];
const TRANS = [
  { key: "auto", label: "Automatique" },
  { key: "manual", label: "Manuelle" },
];
const SEATS_OPTIONS = [2, 4, 5, 7, 9];

const PHOTO_SLOTS = [
  { key: "ext", label: "Extérieur (3/4)", required: true },
  { key: "int", label: "Intérieur (avant)", required: true },
  { key: "rear", label: "Arrière / coffre", required: true },
  { key: "seats", label: "Sièges arrière", required: false },
  { key: "wheels", label: "Jantes / pneus", required: false },
  { key: "detail", label: "Détail utile", required: false },
];

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

const CITIES = ["Casablanca","Rabat","Marrakech","Tanger","Fès","Agadir","Kénitra","Meknès"];
const DESC_MAX = 800;

const STEPS = [
  { id: "identity", title: "Quel véhicule ?" },
  { id: "photos", title: "Ajoute des photos" },
  { id: "specs", title: "Caractéristiques" },
  { id: "equip", title: "Équipements", optional: true },
  { id: "pricing", title: "Prix & lieu" },
  { id: "recap", title: "Aperçu" },
];

// ═══════════════════════════════════════════════════════
// Small components
// ═══════════════════════════════════════════════════════
function StepperBar({ current, total }: { current: number; total: number }) {
  const { styles, colors, isDark } = useStepperStyles();
  return (
    <KRow gap={4} px="md" py="sm">
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={[styles.bar, { backgroundColor: i <= current ? colors.primary : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)") }]} />
      ))}
    </KRow>
  );
}
const useStepperStyles = createStyles(() => ({
  bar: { flex: 1, height: 3, borderRadius: 2 },
}));

function Chip({ label, active, onPress, icon }: { label: string; active: boolean; onPress: () => void; icon?: string }) {
  const { styles, colors, isDark } = useChipStyles();
  return (
    <KPressable onPress={onPress} style={[
      styles.chip,
      { backgroundColor: active ? colors.primaryLight : (isDark ? colors.bgTertiary : "rgba(0,0,0,0.03)") },
      { borderColor: active ? colors.primary : "transparent" },
    ]}>
      {icon && <Ionicons name={icon as any} size={14} color={active ? colors.primary : colors.textTertiary} />}
      <KText variant="labelSmall" color={active ? "primary" : "text"} bold={active}>{label}</KText>
    </KPressable>
  );
}
const useChipStyles = createStyles(() => ({
  chip: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 14,
    borderWidth: 1.5, flexDirection: "row", alignItems: "center", gap: 7,
  },
}));

function Field({ label, value, onChangeText, placeholder, keyboardType, suffix, hint, error, multiline, maxLength, onFocusScroll }: {
  label?: string; value: string; onChangeText: (t: string) => void; placeholder?: string;
  keyboardType?: string; suffix?: string; hint?: string; error?: string | null;
  multiline?: boolean; maxLength?: number; onFocusScroll?: () => void;
}) {
  const { styles, colors, isDark } = useFieldStyles();
  const [focused, setFocused] = useState(false);
  return (
    <KVStack gap={5}>
      {label && <KText variant="labelSmall" color="textSecondary" style={{ paddingLeft: 2 }}>{label}</KText>}
      <KRow align={multiline ? "flex-start" : "center"} gap="sm" style={[
        styles.inputWrap,
        { borderColor: error ? "#EF4444" : focused ? colors.primary : (isDark ? colors.cardBorder : "rgba(0,0,0,0.06)") },
        multiline && { minHeight: 100, paddingTop: 12, paddingBottom: 12 },
      ]}>
        <TextInput
          value={value} onChangeText={onChangeText} placeholder={placeholder}
          placeholderTextColor={colors.textTertiary} keyboardType={keyboardType as any} maxLength={maxLength}
          onFocus={() => { setFocused(true); onFocusScroll?.(); }}
          onBlur={() => setFocused(false)}
          multiline={multiline} numberOfLines={multiline ? 4 : 1}
          textAlignVertical={multiline ? "top" : "center"}
          style={[styles.input, multiline ? { height: 80 } : { height: "100%" }]}
        />
        {suffix && <KText variant="labelSmall" color="textTertiary">{suffix}</KText>}
      </KRow>
      {error && <KText variant="caption" color="error" style={{ paddingLeft: 2 }}>{error}</KText>}
      {hint && !error && <KText variant="caption" color="textTertiary" style={{ paddingLeft: 2 }}>{hint}</KText>}
    </KVStack>
  );
}
const useFieldStyles = createStyles((colors, isDark) => ({
  inputWrap: {
    backgroundColor: isDark ? colors.bgTertiary : "#FAFAFA",
    borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, minHeight: 50,
  },
  input: { flex: 1, fontSize: 15, fontWeight: "500", color: colors.text },
}));

function BottomBar({ primaryLabel, primaryEnabled, onPrimary, loading }: {
  primaryLabel: string; primaryEnabled: boolean; onPrimary: () => void; loading?: boolean;
}) {
  const { styles, colors, isDark } = useBottomBarStyles();
  return (
    <View style={styles.bar}>
      <KPressable onPress={onPrimary} disabled={!primaryEnabled || loading} style={[
        styles.btn,
        { backgroundColor: primaryEnabled ? colors.primary : (isDark ? colors.bgTertiary : "rgba(0,0,0,0.08)") },
      ]}>
        {loading ? <ActivityIndicator color="#FFF" /> : (
          <KText variant="label" color={primaryEnabled ? "textInverse" : "textTertiary"} style={{ fontSize: 16 }}>{primaryLabel}</KText>
        )}
      </KPressable>
    </View>
  );
}
const useBottomBarStyles = createStyles((colors, isDark) => ({
  bar: {
    paddingHorizontal: 14, paddingBottom: 16, paddingTop: 10,
    backgroundColor: colors.bg, borderTopWidth: 1,
    borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  btn: { borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" },
}));

// ═══════════════════════════════════════════════════════
// Brand Modal
// ═══════════════════════════════════════════════════════
function BrandModal({ visible, onClose, value, onSelect }: {
  visible: boolean; onClose: () => void; value: string; onSelect: (b: string) => void;
}) {
  const { styles, colors, isDark } = useBrandModalStyles();
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return BRANDS;
    const q = search.toLowerCase();
    return BRANDS.filter((b) => b.toLowerCase().includes(q));
  }, [search]);
  useEffect(() => { if (visible) setSearch(""); }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Drag indicator */}
        <View style={{ alignItems: "center", paddingTop: 10, paddingBottom: 6 }}>
          <View style={styles.dragHandle} />
        </View>
        {/* Header */}
        <KRow gap="md" px="md" style={{ paddingBottom: 10 }}>
          <KPressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.text} />
          </KPressable>
          <KText variant="h2" bold style={{ flex: 1 }}>Marque du véhicule</KText>
        </KRow>
        {/* Search */}
        <View style={{ paddingHorizontal: 14, paddingBottom: 10 }}>
          <KRow gap="sm" style={styles.searchBar}>
            <Ionicons name="search-outline" size={18} color={colors.textTertiary} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher…"
              placeholderTextColor={colors.textTertiary}
              style={{ flex: 1, fontSize: 15, fontWeight: "500", color: colors.text, height: "100%" }} />
          </KRow>
        </View>
        <FlatList data={filtered} keyExtractor={(item) => item}
          contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 40 }}
          renderItem={({ item }) => {
            const active = item === value;
            return (
              <KPressable onPress={() => { onSelect(item); onClose(); }} style={[
                styles.brandItem,
                { backgroundColor: active ? colors.primaryLight : colors.card },
                { borderColor: active ? colors.primary : (isDark ? colors.cardBorder : "rgba(0,0,0,0.04)") },
              ]}>
                <KText variant="label" color={active ? "primary" : "text"} bold={active} style={{ fontSize: 15 }}>{item}</KText>
                {active && <Ionicons name="checkmark-circle" size={20} color={colors.primary} />}
              </KPressable>
            );
          }} />
      </View>
    </Modal>
  );
}
const useBrandModalStyles = createStyles((colors, isDark) => ({
  dragHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)" },
  closeBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", alignItems: "center", justifyContent: "center" },
  searchBar: { backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", borderRadius: 14, paddingHorizontal: 14, height: 46, alignItems: "center" },
  brandItem: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 16, paddingHorizontal: 16, marginBottom: 6,
    borderRadius: 14, borderWidth: 1,
  },
}));

// ═══════════════════════════════════════════════════════
// Equipment Toggle Item
// ═══════════════════════════════════════════════════════
function EquipItem({ item, active, onPress }: { item: { key: string; label: string; icon: string }; active: boolean; onPress: () => void }) {
  const { styles, colors, isDark } = useEquipStyles();
  return (
    <KPressable onPress={onPress} style={[
      styles.row,
      { backgroundColor: active ? (isDark ? "rgba(16,185,129,0.1)" : "#F0FDF4") : (isDark ? colors.bgTertiary : "#FAFAFA") },
      { borderColor: active ? "#10B981" : "transparent" },
    ]}>
      <View style={[styles.iconBox, { backgroundColor: active ? (isDark ? "rgba(16,185,129,0.15)" : "#DCFCE7") : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)") }]}>
        <Ionicons name={item.icon as any} size={17} color={active ? "#10B981" : colors.textTertiary} />
      </View>
      <KText variant="label" color={active ? "#10B981" : "text"} style={{ flex: 1 }}>{item.label}</KText>
      <Ionicons name={active ? "checkmark-circle" : "ellipse-outline"} size={22} color={active ? "#10B981" : (isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)")} />
    </KPressable>
  );
}
const useEquipStyles = createStyles(() => ({
  row: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1.5,
  },
  iconBox: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
}));

// ═══════════════════════════════════════════════════════
// Not Authenticated
// ═══════════════════════════════════════════════════════
function NotAuthenticated() {
  const { styles, colors } = useNotAuthStyles();
  return (
    <KVStack flex={1} align="center" justify="center" padding="3xl" gap="lg">
      <View style={styles.iconCircle}>
        <Ionicons name="car-outline" size={28} color={colors.textTertiary} />
      </View>
      <KText variant="h3" bold center>Inscris-toi pour publier</KText>
      <KButton title="Créer un compte" onPress={() => router.push("/signup")} style={{ paddingHorizontal: 32, marginTop: 8 }} />
      <KPressable onPress={() => router.push("/login")}>
        <KText variant="bodySmall" color="textSecondary">Déjà un compte ? <KText variant="bodySmall" bold style={{ color: colors.primary }}>Se connecter</KText></KText>
      </KPressable>
    </KVStack>
  );
}
const useNotAuthStyles = createStyles((colors, isDark) => ({
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center", justifyContent: "center",
  },
}));

// ═══════════════════════════════════════════════════════
// Recap Row
// ═══════════════════════════════════════════════════════
function RecapRow({ label, value }: { label: string; value: string }) {
  return (
    <KRow justify="space-between" align="center" style={{ marginBottom: 10 }}>
      <KText variant="label" color="textSecondary" style={{ fontSize: 14 }}>{label}</KText>
      <KText variant="label" bold style={{ fontSize: 14 }}>{value || "—"}</KText>
    </KRow>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function PublishScreen() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuthStatus();
  const scrollRef = useRef<ScrollView>(null);
  const descYRef = useRef(0);

  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [brandModal, setBrandModal] = useState(false);

  // Step 0 — Identity
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [year, setYear] = useState("");

  // Step 1 — Photos
  const [photos, setPhotos] = useState<Record<string, string | null>>(() => {
    const obj: Record<string, string | null> = {};
    PHOTO_SLOTS.forEach((s) => (obj[s.key] = null));
    return obj;
  });

  // Step 2 — Specs
  const [transmission, setTransmission] = useState("auto");
  const [fuel, setFuel] = useState("essence");
  const [seats, setSeats] = useState("");
  const [description, setDescription] = useState("");

  // Step 3 — Equipment
  const [equip, setEquip] = useState<string[]>([]);

  // Step 4 — Pricing
  const [pricePerDay, setPricePerDay] = useState("");
  const [city, setCity] = useState("");
  const [customCity, setCustomCity] = useState("");
  const [delivery, setDelivery] = useState(false);
  const [dlvRadius, setDlvRadius] = useState("");
  const [dlvPrice, setDlvPrice] = useState("");

  useEffect(() => {
    Keyboard.dismiss();
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [step]);

  const selectedCity = city === "__other" ? customCity.trim() : city;
  const priceNum = Number(pricePerDay);
  const yearNum = Number(year);
  const seatsNum = Number(seats);

  const toggleEquip = (key: string) => {
    setEquip((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  const autoTitle = useMemo(() => [brand, model, year].filter(Boolean).join(" ").trim() || "Mon véhicule", [brand, model, year]);

  const suggestedDeposit = useMemo(() => {
    if (!priceNum || priceNum <= 0) return null;
    return Math.min(10000, Math.max(200, Math.round(priceNum * 10)));
  }, [priceNum]);

  const yearError = useMemo(() => {
    if (!year) return null;
    const max = new Date().getFullYear() + 1;
    if (!Number.isFinite(yearNum) || yearNum < 1990 || yearNum > max) return `Entre 1990 et ${max}`;
    return null;
  }, [year, yearNum]);

  const priceError = useMemo(() => {
    if (!pricePerDay) return null;
    if (!Number.isFinite(priceNum) || priceNum <= 0) return "Prix invalide";
    if (priceNum < 50) return "Minimum 50 MAD";
    if (priceNum > 50000) return "Maximum 50 000 MAD";
    return null;
  }, [pricePerDay, priceNum]);

  const fuelLabel = FUEL.find((f) => f.key === fuel)?.label ?? fuel;
  const transLabel = TRANS.find((t) => t.key === transmission)?.label ?? transmission;

  const requiredPhotosCount = PHOTO_SLOTS.filter((s) => s.required && photos[s.key]).length;
  const totalPhotosCount = PHOTO_SLOTS.filter((s) => photos[s.key]).length;

  const canNext = useMemo(() => {
    if (step === 0) return brand !== "" && model.trim() !== "" && year.length === 4 && !yearError;
    if (step === 1) return requiredPhotosCount >= 3;
    if (step === 2) return seatsNum >= 2 && seatsNum <= 9;
    if (step === 3) return true;
    if (step === 4) return priceNum >= 50 && priceNum <= 50000 && selectedCity.length >= 2;
    return true;
  }, [step, brand, model, year, yearError, requiredPhotosCount, seatsNum, priceNum, selectedCity]);

  const goNext = () => { if (canNext) setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const goBack = () => { if (step === 0) return; setStep((s) => s - 1); };

  const pickSlotPhoto = (slotKey: string) => {
    Alert.alert("Ajouter une photo", "Choisis une source", [
      {
        text: "Galerie", onPress: async () => {
          const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
          if (!res.canceled && res.assets[0]?.uri) setPhotos((p) => ({ ...p, [slotKey]: res.assets[0].uri }));
        },
      },
      {
        text: "Caméra", onPress: async () => {
          const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 });
          if (!res.canceled && res.assets[0]?.uri) setPhotos((p) => ({ ...p, [slotKey]: res.assets[0].uri }));
        },
      },
      { text: "Annuler", style: "cancel" },
    ]);
  };

  const onPublish = async () => {
    if (!ensureAuth(isAuthenticated)) return;
    Keyboard.dismiss();
    setLoading(true);
    try {
      const safetyKeys = EQUIP_SECTIONS[0].items.map((i) => i.key);
      const connectKeys = EQUIP_SECTIONS[1].items.map((i) => i.key);
      const amenityKeys = EQUIP_SECTIONS[2].items.map((i) => i.key);

      const res = await convex.mutation(api.vehicles.createVehicle, {
        title: autoTitle, city: selectedCity, pricePerDay: priceNum,
        brand: brand.trim(), model: model.trim(),
        year: yearNum || undefined, transmission, fuel,
        seats: seatsNum || undefined,
        description: description.trim() || undefined,
        featuresSafety: equip.filter((k) => safetyKeys.includes(k)).length ? equip.filter((k) => safetyKeys.includes(k)) : undefined,
        featuresConnect: equip.filter((k) => connectKeys.includes(k)).length ? equip.filter((k) => connectKeys.includes(k)) : undefined,
        featuresAmenities: equip.filter((k) => amenityKeys.includes(k)).length ? equip.filter((k) => amenityKeys.includes(k)) : undefined,
        delivery: delivery || undefined,
        deliveryRadiusKm: delivery && dlvRadius ? Number(dlvRadius) : undefined,
        deliveryPrice: delivery && dlvPrice ? Number(dlvPrice) : undefined,
      });

      const photoUris = PHOTO_SLOTS.map((s) => photos[s.key]).filter(Boolean) as string[];
      for (const uri of photoUris) {
        try {
          const m = await ImageManipulator.manipulateAsync(uri, [{ resize: { width: 1200 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
          const g = await convex.mutation(api.vehicles.generateVehicleImageUploadUrl, { vehicleId: res.vehicleId as any, mimeType: "image/jpeg", byteSize: 0 });
          if (!g.ok) continue;
          const blob = await (await fetch(m.uri)).blob();
          const u = await fetch(g.uploadUrl, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
          if (!u.ok) continue;
          const j = await u.json();
          await convex.mutation(api.vehicles.addVehicleImage, { vehicleId: res.vehicleId as any, storageId: String(j.storageId) });
        } catch {}
      }

      Alert.alert("Annonce publiée !", "Ton véhicule est maintenant visible.", [
        { text: "Voir", onPress: () => router.push(`/vehicle/${res.vehicleId}`) },
        { text: "OK" },
      ]);

      setStep(0); setBrand(""); setModel(""); setYear("");
      setTransmission("auto"); setFuel("essence"); setSeats(""); setDescription("");
      const resetPhotos: Record<string, string | null> = {};
      PHOTO_SLOTS.forEach((s) => (resetPhotos[s.key] = null));
      setPhotos(resetPhotos);
      setEquip([]); setPricePerDay(""); setCity(""); setCustomCity("");
      setDelivery(false); setDlvRadius(""); setDlvPrice("");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      if (msg.includes("ListingLimitReached")) { Alert.alert("Limite atteinte", "2 annonces max."); return; }
      Alert.alert("Erreur", msg);
    } finally { setLoading(false); }
  };

  if (!isAuthenticated) {
    return <View testID="publish-screen" style={{ flex: 1, backgroundColor: colors.bg }}><NotAuthenticated /></View>;
  }

  const cs = STEPS[step];

  return (
    <View testID="publish-screen" style={{ flex: 1, backgroundColor: colors.bg }}>
      <BrandModal visible={brandModal} onClose={() => setBrandModal(false)} value={brand} onSelect={setBrand} />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>
          {/* Nav */}
          <KRow gap="md" px="md" style={{ paddingTop: insets.top + 4, height: insets.top + 52 }}>
            {step > 0 ? (
              <KPressable onPress={goBack} style={styles.backBtn}>
                <Ionicons name="chevron-back" size={20} color={colors.text} />
              </KPressable>
            ) : <View style={{ width: 40 }} />}
            <KText variant="h3" bold center style={{ flex: 1 }}>Publier</KText>
            <KText variant="bodySmall" color="textTertiary" style={{ width: 40, textAlign: "right" }}>{step + 1}/{STEPS.length}</KText>
          </KRow>

          <StepperBar current={step} total={STEPS.length} />

          <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 100 }}
            showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">

            {/* Title */}
            <KRow gap="sm" px="md" py="md">
              <KText variant="displayMedium">{cs.title}</KText>
              {cs.optional && (
                <View style={styles.optionalBadge}>
                  <KText variant="caption" color="textTertiary" style={{ fontSize: 10, fontWeight: "700" }}>OPTIONNEL</KText>
                </View>
              )}
            </KRow>

            {/* ── STEP 0: Identité ── */}
            {step === 0 && (
              <KVStack gap="lg" px="md">
                <KPressable onPress={() => setBrandModal(true)} style={[
                  styles.brandSelector,
                  { borderColor: brand ? colors.primary : (isDark ? colors.cardBorder : "rgba(0,0,0,0.06)") },
                ]}>
                  <KVStack>
                    <KText variant="caption" color="textTertiary">Marque</KText>
                    <KText variant="label" color={brand ? "text" : "textTertiary"} bold={!!brand} style={{ fontSize: 16, marginTop: 2 }}>
                      {brand || "Sélectionner"}
                    </KText>
                  </KVStack>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
                </KPressable>
                <Field label="Modèle" value={model} onChangeText={setModel} placeholder="Yaris, Clio, Golf…" />
                <Field label="Année" value={year} onChangeText={(t) => setYear(t.replace(/\D/g, "").slice(0, 4))}
                  placeholder="2020" keyboardType="number-pad" maxLength={4} error={yearError} />
              </KVStack>
            )}

            {/* ── STEP 1: Photos ── */}
            {step === 1 && (
              <View style={{ paddingHorizontal: 14 }}>
                <KRow justify="space-between" style={{ marginBottom: 14 }}>
                  <KText variant="bodySmall" color="textSecondary">3 obligatoires, 3 optionnelles</KText>
                  <KText variant="bodySmall" bold color={requiredPhotosCount >= 3 ? "#10B981" : "primary"}>{totalPhotosCount}/{MAX_PHOTOS}</KText>
                </KRow>

                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
                  {PHOTO_SLOTS.map((slot) => {
                    const uri = photos[slot.key];
                    return (
                      <KPressable key={slot.key} onPress={() => pickSlotPhoto(slot.key)} style={[
                        styles.photoSlot,
                        { borderWidth: uri ? 2 : 1.5, borderStyle: uri ? "solid" : "dashed" },
                        { borderColor: uri ? "#10B981" : slot.required ? colors.primary : (isDark ? colors.cardBorder : "rgba(0,0,0,0.1)") },
                      ]}>
                        {uri ? (
                          <View style={{ flex: 1 }}>
                            <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                            <View style={styles.photoCheck}>
                              <Ionicons name="checkmark" size={14} color="#FFF" />
                            </View>
                            <View style={styles.photoLabel}>
                              <KText variant="caption" color="#FFF" style={{ fontSize: 10, fontWeight: "700" }} numberOfLines={1}>{slot.label}</KText>
                            </View>
                          </View>
                        ) : (
                          <KVStack flex={1} align="center" justify="center" gap={6} padding="sm"
                            style={{ backgroundColor: isDark ? colors.bgTertiary : "#F8F9FA" }}>
                            <Ionicons name="camera-outline" size={22} color={slot.required ? colors.primary : colors.textTertiary} />
                            <KText variant="caption" color={slot.required ? "primary" : "textTertiary"} center bold style={{ fontSize: 11 }} numberOfLines={2}>{slot.label}</KText>
                            {slot.required && (
                              <View style={styles.requiredBadge}>
                                <KText variant="caption" color="primary" style={{ fontSize: 8, fontWeight: "800" }}>OBLIGATOIRE</KText>
                              </View>
                            )}
                          </KVStack>
                        )}
                      </KPressable>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ── STEP 2: Caractéristiques ── */}
            {step === 2 && (
              <KVStack gap="xl" px="md">
                <KVStack gap="sm">
                  <KText variant="bodySmall" bold color="textSecondary">Transmission</KText>
                  <KRow gap="sm">{TRANS.map((o) => <Chip key={o.key} label={o.label} active={transmission === o.key} onPress={() => setTransmission(o.key)} />)}</KRow>
                </KVStack>
                <KVStack gap="sm">
                  <KText variant="bodySmall" bold color="textSecondary">Carburant</KText>
                  <KRow gap="sm" wrap>{FUEL.map((o) => <Chip key={o.key} label={o.label} icon={o.icon} active={fuel === o.key} onPress={() => setFuel(o.key)} />)}</KRow>
                </KVStack>
                <KVStack gap="sm">
                  <KText variant="bodySmall" bold color="textSecondary">Places</KText>
                  <KRow gap="sm">{SEATS_OPTIONS.map((n) => <Chip key={String(n)} label={`${n}`} active={seats === String(n)} onPress={() => setSeats(String(n))} />)}</KRow>
                </KVStack>
                <View onLayout={(e) => { descYRef.current = e.nativeEvent.layout.y; }}>
                  <Field label="Description (optionnel)" value={description}
                    onChangeText={(t) => setDescription(t.slice(0, DESC_MAX))}
                    placeholder="Voiture propre, non fumeur, clim OK…"
                    hint={description.trim().length > 0 ? `${description.trim().length}/${DESC_MAX}` : undefined}
                    multiline maxLength={DESC_MAX}
                    onFocusScroll={() => setTimeout(() => scrollRef.current?.scrollTo({ y: descYRef.current - 40, animated: true }), 300)} />
                </View>
              </KVStack>
            )}

            {/* ── STEP 3: Équipements ── */}
            {step === 3 && (
              <KVStack gap="lg" px="md">
                {EQUIP_SECTIONS.map((section) => (
                  <KVStack key={section.title} gap="sm">
                    <KRow gap="sm">
                      <View style={styles.equipSectionIcon}>
                        <Ionicons name={section.icon} size={16} color={colors.primary} />
                      </View>
                      <KText variant="label" bold style={{ fontSize: 15 }}>{section.title}</KText>
                    </KRow>
                    <KVStack gap={6}>
                      {section.items.map((item) => (
                        <EquipItem key={item.key} item={item} active={equip.includes(item.key)}
                          onPress={() => toggleEquip(item.key)} />
                      ))}
                    </KVStack>
                  </KVStack>
                ))}
              </KVStack>
            )}

            {/* ── STEP 4: Prix & Ville ── */}
            {step === 4 && (
              <KVStack gap="xl" px="md">
                <Field label="Prix par jour" value={pricePerDay}
                  onChangeText={(t) => setPricePerDay(t.replace(/\D/g, ""))}
                  placeholder="250" keyboardType="number-pad" suffix="MAD/jour" error={priceError} />

                {suggestedDeposit && (
                  <KRow gap="sm" style={styles.depositHint}>
                    <Ionicons name="shield-checkmark-outline" size={16} color={colors.primary} />
                    <KText variant="caption" color="textSecondary" style={{ flex: 1 }}>Caution estimée : {suggestedDeposit} MAD</KText>
                  </KRow>
                )}

                <KVStack gap="sm">
                  <KText variant="bodySmall" bold color="textSecondary">Ville</KText>
                  <KRow gap="sm" wrap>
                    {CITIES.map((c) => <Chip key={c} label={c} active={city === c} onPress={() => { setCity(city === c ? "" : c); setCustomCity(""); }} />)}
                    <Chip label="Autre" active={city === "__other"} onPress={() => setCity(city === "__other" ? "" : "__other")} icon="location-outline" />
                  </KRow>
                  {city === "__other" && (
                    <View style={{ marginTop: 4 }}>
                      <Field value={customCity} onChangeText={setCustomCity} placeholder="Nom de ta ville" />
                    </View>
                  )}
                </KVStack>

                {/* Delivery toggle */}
                <KPressable onPress={() => setDelivery(!delivery)} style={styles.toggleRow}>
                  <KText variant="label">Livraison possible</KText>
                  <View style={[styles.toggle, { backgroundColor: delivery ? colors.primary : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)") }]}>
                    <View style={[styles.toggleThumb, { alignSelf: delivery ? "flex-end" : "flex-start" }]} />
                  </View>
                </KPressable>

                {delivery && (
                  <KRow gap="sm">
                    <View style={{ flex: 1 }}><Field label="Rayon" value={dlvRadius} onChangeText={(t) => setDlvRadius(t.replace(/\D/g, ""))} placeholder="30" keyboardType="number-pad" suffix="km" /></View>
                    <View style={{ flex: 1 }}><Field label="Prix livraison" value={dlvPrice} onChangeText={(t) => setDlvPrice(t.replace(/\D/g, ""))} placeholder="50" keyboardType="number-pad" suffix="MAD" /></View>
                  </KRow>
                )}

                {/* ── Politique d'annulation (info) ── */}
                <KRow gap="sm" style={styles.depositHint}>
                  <Ionicons name="shield-half-outline" size={16} color="#F59E0B" />
                  <KText variant="caption" color="textSecondary" style={{ flex: 1 }}>Politique d'annulation : Modérée — gratuit jusqu'à 3 jours avant le départ</KText>
                </KRow>
              </KVStack>
            )}

            {/* ── STEP 5: Récap ── */}
            {step === 5 && (() => {
              const allPhotos = PHOTO_SLOTS.map((s) => photos[s.key]).filter(Boolean) as string[];
              return (
              <View>
                {/* Hero carousel */}
                {allPhotos.length > 0 ? (
                  <View style={{ position: "relative" }}>
                    <FlatList
                      data={allPhotos} horizontal pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      keyExtractor={(_, i) => String(i)}
                      renderItem={({ item }) => (
                        <Image source={{ uri: item }} style={{ width: SW, height: SW * 0.65 }} resizeMode="cover" />
                      )}
                    />
                    {allPhotos.length > 1 && (
                      <KRow gap={5} style={styles.recapPhotoCounter}>
                        <Ionicons name="images-outline" size={13} color="#FFF" />
                        <KText variant="labelSmall" color="#FFF">{allPhotos.length}</KText>
                      </KRow>
                    )}
                  </View>
                ) : (
                  <KVStack align="center" justify="center" gap="sm" style={styles.recapNoPhotos}>
                    <Ionicons name="camera-outline" size={30} color={colors.textTertiary} />
                    <KText variant="bodySmall" color="textTertiary">Aucune photo</KText>
                  </KVStack>
                )}

                <View style={{ padding: 18 }}>
                  <KText variant="displayMedium" style={{ lineHeight: 28, letterSpacing: -0.3 }}>{autoTitle}</KText>
                  <KRow gap={4} align="flex-end" style={{ marginTop: 8 }}>
                    <KText variant="displayMedium">{pricePerDay} MAD</KText>
                    <KText variant="label" color="textSecondary" style={{ marginBottom: 2 }}> / jour</KText>
                  </KRow>
                  <KRow gap={6} style={{ marginTop: 8 }}>
                    <Ionicons name="location-outline" size={14} color={colors.textSecondary} />
                    <KText variant="bodySmall" color="textSecondary">{selectedCity}</KText>
                  </KRow>

                  {/* Details card */}
                  <KCard style={styles.recapCard}>
                    <KText variant="label" bold style={{ marginBottom: 12 }}>Détails du véhicule</KText>
                    <RecapRow label="Marque" value={brand} />
                    <RecapRow label="Modèle" value={model} />
                    <RecapRow label="Année" value={year} />
                    <RecapRow label="Transmission" value={transLabel} />
                    <RecapRow label="Carburant" value={fuelLabel} />
                    <RecapRow label="Places" value={seats} />
                  </KCard>

                  {/* Tarif card */}
                  <KCard style={styles.recapCard}>
                    <KText variant="label" bold style={{ marginBottom: 12 }}>Tarif</KText>
                    <RecapRow label="Prix / jour" value={`${pricePerDay} MAD`} />
                    <RecapRow label="Caution estimée" value={`${suggestedDeposit ?? "—"} MAD`} />
                    {delivery && <RecapRow label="Livraison" value={`${dlvRadius} km • ${dlvPrice || "0"} MAD`} />}
                    <RecapRow label="Annulation" value="Modérée" />
                  </KCard>

                  {/* Equipment */}
                  {equip.length > 0 && (
                    <View style={styles.recapEquip}>
                      {equip.map((key) => {
                        const all = EQUIP_SECTIONS.flatMap((s) => s.items);
                        const item = all.find((i) => i.key === key);
                        return item ? (
                          <KRow key={key} gap="sm" py="xs">
                            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                            <KText variant="bodySmall" bold>{item.label}</KText>
                          </KRow>
                        ) : null;
                      })}
                    </View>
                  )}

                  {/* Description */}
                  {description.trim() && (
                    <KVStack style={{ marginTop: 14 }}>
                      <KText variant="label" bold style={{ marginBottom: 6 }}>Description</KText>
                      <KText variant="bodySmall" color="textSecondary" style={{ lineHeight: 20 }}>{description.trim()}</KText>
                    </KVStack>
                  )}
                </View>
              </View>
              );})()}
          </ScrollView>

          {/* Bottom */}
          {step < 5 ? (
            <BottomBar
              primaryLabel={step === 3 ? (equip.length === 0 ? "Passer" : "Continuer") : "Continuer"}
              primaryEnabled={canNext} onPrimary={goNext} />
          ) : (
            <BottomBar primaryLabel="Publier l'annonce" primaryEnabled={!loading}
              onPrimary={onPublish} loading={loading} />
          )}
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const useStyles = createStyles((colors, isDark) => ({
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  optionalBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999,
    backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)",
  },
  brandSelector: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: isDark ? colors.bgTertiary : "#FAFAFA",
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 16, height: 56,
  },
  photoSlot: { width: TILE, aspectRatio: 1, borderRadius: 16, overflow: "hidden" },
  photoCheck: {
    position: "absolute", top: 8, right: 8,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: "#10B981", alignItems: "center", justifyContent: "center",
  },
  photoLabel: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 5, paddingHorizontal: 10,
  },
  requiredBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.primaryLight },
  equipSectionIcon: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center",
  },
  depositHint: {
    backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.03)",
    borderRadius: 12, padding: 12, alignItems: "center",
  },
  toggleRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8", borderRadius: 14, padding: 14,
  },
  toggle: { width: 44, height: 26, borderRadius: 13, justifyContent: "center", paddingHorizontal: 3 },
  toggleThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#FFF" },
  recapPhotoCounter: {
    position: "absolute", bottom: 12, right: 16,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, alignItems: "center",
  },
  recapNoPhotos: {
    width: SW, height: SW * 0.35,
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
  },
  recapCard: {
    marginTop: 14, padding: 16, borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
  },
  recapEquip: {
    marginTop: 14, backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8",
    borderRadius: 16, padding: 14,
  },
}));
