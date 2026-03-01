import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Dimensions, Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { api } from "../../../convex/_generated/api";
import { convex } from "../../../src/shared/config/convex";
import { uploadToConvexStorage } from "../../../src/infrastructure/convex/uploadToConvexStorage";
import { KText, KVStack, KRow, KPressable, createStyles } from "../../../src/ui";
import { haptic } from "../../../src/theme";

type Phase = "checkin" | "checkout";
type Role = "owner" | "renter";

// ═══════════════════════════════════════════════════════
// Slot config
// ═══════════════════════════════════════════════════════
const EXTERIOR_SLOTS = [
  { key: "front", label: "Avant" }, { key: "front_left", label: "Avant gauche" },
  { key: "front_right", label: "Avant droit" }, { key: "back", label: "Arrière" },
  { key: "back_left", label: "Arrière gauche" }, { key: "back_right", label: "Arrière droit" },
] as const;
const INTERIOR_SLOTS = [
  { key: "interior_front", label: "Intérieur avant" }, { key: "interior_back", label: "Intérieur arrière" },
  { key: "dashboard", label: "Tableau de bord" },
] as const;
const ALL_REQUIRED_SLOTS = [...EXTERIOR_SLOTS, ...INTERIOR_SLOTS];
type DetailLocal = { uri: string; note: string };

const STEPS = [
  { id: "exterior", title: "Extérieur", subtitle: "6 photos des angles extérieurs", icon: "car-outline" as const },
  { id: "interior", title: "Intérieur", subtitle: "3 photos de l'habitacle", icon: "albums-outline" as const },
  { id: "video", title: "Vidéo 360°", subtitle: "Filme un tour complet", icon: "videocam-outline" as const, optional: true },
  { id: "details", title: "Défauts", subtitle: "Photographie les dégâts existants", icon: "alert-circle-outline" as const, optional: true },
  { id: "recap", title: "Récapitulatif", subtitle: "Vérifie et confirme", icon: "shield-checkmark-outline" as const },
] as const;

const { width: SCREEN_W } = Dimensions.get("window");
const GRID_GAP = 10;
const TILE_W = (SCREEN_W - 14 * 2 - GRID_GAP) / 2;
const RECAP_TILE = (SCREEN_W - 14 * 2 - GRID_GAP * 2) / 3;

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function ReportSkeleton() {
  const { colors } = useSkeletonStyles();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true })])).start(); }, []);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const Box = ({ w, h, r = 10, style: s }: any) => <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, s]} />;
  return <View style={{ flex: 1, backgroundColor: colors.bg, padding: 18, paddingTop: 80 }}><Box w="55%" h={22} /><Box w="35%" h={14} style={{ marginTop: 6 }} />{[0, 1, 2].map((i) => <Box key={i} w="100%" h={100} r={16} style={{ marginTop: 16 }} />)}</View>;
}
const useSkeletonStyles = createStyles((colors) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// Stepper Bar
// ═══════════════════════════════════════════════════════
function StepperBar({ current, total }: { current: number; total: number }) {
  const { colors, isDark } = useStepperStyles();
  return (
    <KRow gap={6} style={{ paddingHorizontal: 14, paddingVertical: 10 }}>
      {Array.from({ length: total }).map((_, i) => (
        <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= current ? colors.primary : (isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"), opacity: i <= current ? 1 : 0.4 }} />
      ))}
    </KRow>
  );
}
const useStepperStyles = createStyles((colors, isDark) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// Step Header
// ═══════════════════════════════════════════════════════
function StepHeader({ step }: { step: typeof STEPS[number] }) {
  const { styles, colors, isDark } = useStepHeaderStyles();
  return (
    <View style={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 16 }}>
      <KRow gap="sm" style={{ alignItems: "center" }}>
        <View style={styles.iconBox}><Ionicons name={step.icon} size={20} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <KRow gap="sm" style={{ alignItems: "center" }}>
            <KText variant="h3" bold>{step.title}</KText>
            {step.optional && (
              <View style={styles.optionalBadge}><KText variant="caption" bold color="textTertiary" style={{ fontSize: 10 }}>OPTIONNEL</KText></View>
            )}
          </KRow>
          <KText variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>{step.subtitle}</KText>
        </View>
      </KRow>
    </View>
  );
}
const useStepHeaderStyles = createStyles((colors, isDark) => ({
  iconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" },
  optionalBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)" },
}));

// ═══════════════════════════════════════════════════════
// Photo Tile
// ═══════════════════════════════════════════════════════
function PhotoTile({ label, uri, onPress, size }: { label: string; uri?: string; onPress: () => void; size: number }) {
  const { colors, isDark } = usePhotoTileStyles();
  return (
    <KPressable onPress={onPress} style={{
      width: size, height: size, borderRadius: 16, overflow: "hidden",
      borderWidth: uri ? 2 : 1.5, borderColor: uri ? "#10B981" : (isDark ? colors.cardBorder : "rgba(0,0,0,0.1)"),
      borderStyle: uri ? "solid" : "dashed",
    }}>
      {uri ? (
        <View style={{ flex: 1 }}>
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          <View style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: 12, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="checkmark" size={14} color="#FFF" />
          </View>
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 6, paddingHorizontal: 10 }}>
            <KText variant="caption" bold style={{ color: "#FFF" }} numberOfLines={1}>{label}</KText>
          </View>
        </View>
      ) : (
        <KVStack align="center" justify="center" gap={6} style={{ flex: 1, backgroundColor: isDark ? colors.bgTertiary : "#F8F9FA" }}>
          <Ionicons name="camera-outline" size={24} color={colors.primary} />
          <KText variant="bodySmall" bold center>{label}</KText>
        </KVStack>
      )}
    </KPressable>
  );
}
const usePhotoTileStyles = createStyles((colors, isDark) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// Recap Tile
// ═══════════════════════════════════════════════════════
function RecapTile({ label, uri }: { label: string; uri?: string }) {
  const { colors, isDark } = useRecapTileStyles();
  return (
    <View style={{ width: RECAP_TILE, height: RECAP_TILE, borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: uri ? "#10B981" : (isDark ? colors.cardBorder : "rgba(0,0,0,0.08)") }}>
      {uri ? (
        <View style={{ flex: 1 }}>
          <Image source={{ uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 3, paddingHorizontal: 6 }}>
            <KText variant="caption" bold style={{ fontSize: 9, color: "#FFF" }} numberOfLines={1}>{label}</KText>
          </View>
        </View>
      ) : (
        <KVStack align="center" justify="center" style={{ flex: 1, backgroundColor: isDark ? colors.bgTertiary : "#F8F9FA" }}>
          <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
          <KText variant="caption" bold center style={{ fontSize: 9, color: "#EF4444", marginTop: 2 }} numberOfLines={1}>{label}</KText>
        </KVStack>
      )}
    </View>
  );
}
const useRecapTileStyles = createStyles((colors, isDark) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// Bottom Bar
// ═══════════════════════════════════════════════════════
function BottomBar({ primaryLabel, primaryIcon, primaryEnabled, onPrimary, loading, longPress }: {
  primaryLabel: string; primaryIcon: keyof typeof Ionicons.glyphMap; primaryEnabled: boolean; onPrimary: () => void; loading?: boolean; longPress?: boolean;
}) {
  const { styles, colors } = useBottomBarStyles();

  if (longPress && primaryEnabled && !loading) {
    return (
      <View style={styles.bar}>
        <LongPressConfirmButton label={primaryLabel} icon={primaryIcon} onConfirm={onPrimary} holdDurationMs={2000} />
      </View>
    );
  }

  return (
    <View style={styles.bar}>
      <KPressable onPress={onPrimary} disabled={!primaryEnabled || loading}
        style={[styles.btn, { backgroundColor: primaryEnabled ? colors.primary : colors.bgTertiary }]}>
        {loading ? <ActivityIndicator color="#FFF" /> : (
          <KRow gap="sm" style={{ alignItems: "center" }}>
            <Ionicons name={primaryIcon} size={18} color={primaryEnabled ? "#FFF" : colors.textTertiary} />
            <KText variant="label" bold style={{ fontSize: 16, color: primaryEnabled ? "#FFF" : colors.textTertiary }}>{primaryLabel}</KText>
          </KRow>
        )}
      </KPressable>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Long Press Confirm Button
// ═══════════════════════════════════════════════════════
function LongPressConfirmButton({ label, icon, onConfirm, holdDurationMs }: {
  label: string; icon: keyof typeof Ionicons.glyphMap; onConfirm: () => void; holdDurationMs: number;
}) {
  const { colors } = useBottomBarStyles();
  const progress = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<any>(null);
  const confirmedRef = useRef(false);

  const onPressIn = () => {
    confirmedRef.current = false;
    haptic.medium();
    progress.setValue(0);
    timerRef.current = Animated.timing(progress, {
      toValue: 1,
      duration: holdDurationMs,
      useNativeDriver: false,
    });
    timerRef.current.start(({ finished }: { finished: boolean }) => {
      if (finished && !confirmedRef.current) {
        confirmedRef.current = true;
        haptic.success();
        onConfirm();
      }
    });
  };

  const onPressOut = () => {
    if (!confirmedRef.current) {
      timerRef.current?.stop();
      Animated.timing(progress, { toValue: 0, duration: 150, useNativeDriver: false }).start();
    }
  };

  const widthInterp = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  const bgInterp = progress.interpolate({ inputRange: [0, 0.8, 1], outputRange: [colors.primary, "#10B981", "#10B981"] });

  return (
    <View style={{ borderRadius: 16, overflow: "hidden", height: 54 }}>
      {/* Background track */}
      <View style={{ position: "absolute", inset: 0, backgroundColor: colors.primary + "20", borderRadius: 16 }} />
      {/* Progress fill */}
      <Animated.View style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: widthInterp, backgroundColor: bgInterp, borderRadius: 16 }} />
      {/* Touchable overlay */}
      <KPressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}
      >
        <Ionicons name={icon} size={18} color="#FFF" />
        <KText variant="label" bold style={{ fontSize: 16, color: "#FFF" }}>{label}</KText>
      </KPressable>
    </View>
  );
}
const useBottomBarStyles = createStyles((colors, isDark) => ({
  bar: { paddingHorizontal: 14, paddingBottom: 34, paddingTop: 12, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)", gap: 8 },
  btn: { borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" },
}));

// ═══════════════════════════════════════════════════════
// Nav Header (reused in guards + viewer)
// ═══════════════════════════════════════════════════════
function NavHeader({ title, subtitle, right, onBack }: { title: string; subtitle?: string; right?: React.ReactNode; onBack: () => void }) {
  const { styles, colors } = useNavStyles();
  return (
    <KRow gap="sm" style={styles.header}>
      <KPressable onPress={onBack} style={styles.backBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></KPressable>
      <View style={{ flex: 1 }}>
        <KText variant="label" bold style={{ fontSize: 17 }}>{title}</KText>
        {subtitle && <KText variant="caption" color="textSecondary" style={{ marginTop: 1 }}>{subtitle}</KText>}
      </View>
      {right}
    </KRow>
  );
}
const useNavStyles = createStyles((colors, isDark) => ({
  header: { alignItems: "center", paddingHorizontal: 14, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", alignItems: "center", justifyContent: "center" },
}));

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function ConditionReportScreen() {
  const { styles, colors, isDark } = useStyles();
  const params = useLocalSearchParams<{ reservationId: string; phase?: Phase }>();
  const reservationId = params.reservationId;
  const phase = (params.phase ?? "checkin") as Phase;

  const [step, setStep] = useState(0);
  const [requiredLocal, setRequiredLocal] = useState<Record<string, string>>({});
  const [detailLocal, setDetailLocal] = useState<DetailLocal[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<false | "checkin" | "checkout">(false);

  const role = useQuery(api.reservations.getMyRoleForReservation, reservationId ? { reservationId: reservationId as any } : "skip") as Role | null | undefined;
  const can = useQuery(api.conditionReports.canSubmitConditionReport, reservationId ? { reservationId: reservationId as any, phase } : "skip");
  const report = useQuery(api.conditionReports.getConditionReportWithUrls, reservationId && role ? { reservationId: reservationId as any, phase, role } : "skip");
  const isLocked = !!report;

  // Camera helpers
  const pickPhoto = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission caméra", "Autorise la caméra pour prendre des photos."); return null; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 });
    return res.canceled ? null : res.assets[0]?.uri ?? null;
  };
  const pickVideo = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { Alert.alert("Permission caméra", "Autorise la caméra pour filmer."); return null; }
    const res = await ImagePicker.launchCameraAsync({ mediaTypes: ["videos"], videoMaxDuration: 60, quality: 0.7 });
    return res.canceled ? null : res.assets[0]?.uri ?? null;
  };
  const takeSlotPhoto = async (key: string) => { const uri = await pickPhoto(); if (uri) setRequiredLocal((p) => ({ ...p, [key]: uri })); };
  const takeDetailPhoto = async () => {
    if (detailLocal.length >= 6) return;
    const uri = await pickPhoto();
    if (!uri) return;
    Alert.alert("Commentaire", "Décris le défaut photographié (optionnel)", [
      { text: "Passer", style: "cancel", onPress: () => setDetailLocal((p) => [...p, { uri, note: "" }]) },
      { text: "Ajouter", onPress: () => {
        if (typeof (Alert as any).prompt === "function") {
          (Alert as any).prompt("Note", "Ex: jante avant droite rayée", (txt: string) => { setDetailLocal((p) => [...p, { uri, note: txt?.trim() ?? "" }]); }, "plain-text", "", "default");
        } else { setDetailLocal((p) => [...p, { uri, note: "" }]); }
      }},
    ]);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      const requiredPhotos: Record<string, string> = {};
      for (const s of ALL_REQUIRED_SLOTS) { requiredPhotos[s.key] = await uploadToConvexStorage(convex, { uri: requiredLocal[s.key], mimeType: "image/jpeg", name: `${phase}_${role}_${s.key}.jpg` }); }
      const detailPhotos: any[] = [];
      for (let i = 0; i < detailLocal.length; i++) { const d = detailLocal[i]; detailPhotos.push({ storageId: await uploadToConvexStorage(convex, { uri: d.uri, mimeType: "image/jpeg", name: `${phase}_${role}_detail_${i + 1}.jpg` }), note: d.note?.trim() || undefined }); }
      let video360StorageId: string | undefined;
      if (videoUri) video360StorageId = await uploadToConvexStorage(convex, { uri: videoUri, mimeType: "video/mp4", name: `${phase}_${role}_360.mp4` });
      await convex.mutation(api.conditionReports.submitConditionReport, { reservationId: reservationId as any, phase, role: role!, requiredPhotos: requiredPhotos as any, detailPhotos: detailPhotos as any, video360StorageId: video360StorageId as any });
      setSubmitted(phase);
    } catch (e) { Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue"); }
    finally { setSubmitting(false); }
  };

  // ── Success screen (premium) ──
  if (submitted) {
    const isCheckout = submitted === "checkout";
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28 }}>
          {/* Success icon */}
          <View style={{
            width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center",
            backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#ECFDF5",
          }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
              backgroundColor: "#10B981",
            }}>
              <Ionicons name="checkmark" size={36} color="#FFF" />
            </View>
          </View>

          <KText variant="h2" bold style={{ marginTop: 24, textAlign: "center" }}>
            {isCheckout ? "Constat retour enregistré" : "Constat départ enregistré"}
          </KText>
          <KText variant="body" color="textSecondary" style={{ marginTop: 10, textAlign: "center", lineHeight: 22, maxWidth: 300 }}>
            Les preuves photo sont verrouillées et horodatées. Elles serviront de référence en cas de besoin.
          </KText>

          {/* Checkout-specific dispute prompt */}
          {isCheckout && (
            <View style={{
              marginTop: 28, width: "100%", padding: 18, borderRadius: 18,
              backgroundColor: isDark ? "rgba(239,68,68,0.06)" : "#FEF2F2",
              borderWidth: 1, borderColor: isDark ? "rgba(239,68,68,0.15)" : "rgba(239,68,68,0.1)",
            }}>
              <KRow gap={10} style={{ alignItems: "center", marginBottom: 8 }}>
                <View style={{
                  width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
                  backgroundColor: isDark ? "rgba(239,68,68,0.12)" : "#FEE2E2",
                }}>
                  <Ionicons name="warning-outline" size={18} color="#EF4444" />
                </View>
                <KVStack style={{ flex: 1 }}>
                  <KText variant="label" bold>Un problème à signaler ?</KText>
                  <KText variant="caption" color="textSecondary" style={{ lineHeight: 16 }}>
                    Dégât, saleté, pièce manquante…
                  </KText>
                </KVStack>
              </KRow>
              <KPressable
                onPress={() => { router.back(); setTimeout(() => router.push(`/dispute/${reservationId}`), 300); }}
                style={{
                  alignItems: "center", justifyContent: "center",
                  paddingVertical: 13, borderRadius: 14,
                  backgroundColor: "#EF4444",
                }}
              >
                <KText variant="label" bold style={{ color: "#FFF" }}>Ouvrir un litige</KText>
              </KPressable>
            </View>
          )}

          {/* Main CTA */}
          <KPressable
            onPress={() => router.back()}
            style={{
              marginTop: isCheckout ? 16 : 32, width: "100%", alignItems: "center", justifyContent: "center",
              paddingVertical: 15, borderRadius: 14,
              backgroundColor: isCheckout
                ? (isDark ? colors.bgTertiary : "#F3F4F6")
                : colors.primary,
            }}
          >
            <KText variant="label" bold style={{ color: isCheckout ? colors.text : "#FFF" }}>
              {isCheckout ? "Tout est en ordre, fermer" : "Retour"}
            </KText>
          </KPressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Guards ──
  if (!reservationId) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}><KText color="textSecondary">Réservation introuvable</KText></SafeAreaView>;
  if (role === undefined || can === undefined) return <ReportSkeleton />;

  if (role === null) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <NavHeader title="Accès refusé" onBack={() => router.back()} />
      <KVStack align="center" justify="center" style={{ flex: 1, padding: 32, gap: 14, marginTop: -60 }}>
        <View style={styles.guardCircleRed}><Ionicons name="lock-closed-outline" size={28} color="#EF4444" /></View>
        <KText variant="label" bold center>Tu n'es pas autorisé</KText>
        <KText variant="bodySmall" color="textSecondary" center style={{ lineHeight: 19 }}>Ce constat appartient à une réservation qui ne te concerne pas.</KText>
      </KVStack>
    </SafeAreaView>
  );

  if (can.canSubmit === false && can.reason) return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <NavHeader title="Constat indisponible" onBack={() => router.back()} />
      <KVStack align="center" justify="center" style={{ flex: 1, padding: 32, gap: 14, marginTop: -60 }}>
        <View style={styles.guardCircleWarn}><Ionicons name="alert-circle-outline" size={28} color="#F59E0B" /></View>
        <KText variant="label" bold center>Ce constat n'est pas disponible</KText>
        <KText variant="bodySmall" color="textSecondary" center style={{ lineHeight: 19 }}>La réservation n'est pas dans le bon statut pour ce constat.</KText>
      </KVStack>
    </SafeAreaView>
  );

  // ── Viewer Mode (locked) ──
  if (isLocked) return (
    <SafeAreaView testID="report-viewer" style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />
      <NavHeader title="Constat" subtitle="Preuves verrouillées" onBack={() => router.back()}
        right={<KRow gap={4} style={styles.lockedBadge}><Ionicons name="lock-closed" size={12} color="#10B981" /><KText variant="caption" bold style={{ fontSize: 11, color: "#10B981" }}>Verrouillé</KText></KRow>} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <KRow gap="sm" style={styles.lockedInfo}>
          <Ionicons name="shield-checkmark" size={18} color="#10B981" style={{ marginTop: 1 }} />
          <KText variant="bodySmall" color="textSecondary" style={{ flex: 1, lineHeight: 19 }}>Ce constat a été enregistré et verrouillé.</KText>
        </KRow>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP }}>
          {ALL_REQUIRED_SLOTS.map((s) => <RecapTile key={s.key} label={s.label} uri={report?.requiredUrls?.[s.key]} />)}
          <View style={styles.videoRecapTile}>
            <Ionicons name={report?.videoUrl ? "videocam" : "videocam-off-outline"} size={18} color={report?.videoUrl ? colors.primary : colors.textTertiary} />
            <KText variant="caption" bold style={{ fontSize: 9, color: report?.videoUrl ? colors.primary : colors.textTertiary }}>Vidéo 360°</KText>
          </View>
          {report?.detailUrls?.map((d: any, idx: number) => <RecapTile key={`detail-${idx}`} label={d.note || `Détail ${idx + 1}`} uri={d.url} />)}
        </View>
      </ScrollView>
    </SafeAreaView>
  );

  // ── Wizard Capture Mode ──
  const currentStep = STEPS[step];
  const extCount = EXTERIOR_SLOTS.filter((s) => requiredLocal[s.key]).length;
  const intCount = INTERIOR_SLOTS.filter((s) => requiredLocal[s.key]).length;
  const goNext = () => { haptic.light(); setStep((s) => Math.min(s + 1, STEPS.length - 1)); };
  const goBack = () => { if (step === 0) router.back(); else setStep((s) => s - 1); };

  return (
    <SafeAreaView testID="report-wizard" style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KRow gap="sm" style={{ paddingHorizontal: 14, height: 52, alignItems: "center" }}>
        <KPressable onPress={goBack} style={styles.backBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></KPressable>
        <View style={{ flex: 1 }}><KText variant="label" bold style={{ fontSize: 17 }}>Constat</KText></View>
        <KText variant="bodySmall" bold color="textTertiary">{step + 1}/{STEPS.length}</KText>
      </KRow>

      <StepperBar current={step} total={STEPS.length} />

      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <StepHeader step={currentStep} />

        {/* STEP 0: Extérieur */}
        {step === 0 && (
          <View style={{ paddingHorizontal: 14 }}>
            <KRow justify="space-between" style={{ marginBottom: 12 }}>
              <KText variant="caption" bold color="textSecondary">Photos prises</KText>
              <KText variant="caption" bold style={{ color: extCount === 6 ? "#10B981" : colors.primary }}>{extCount}/6</KText>
            </KRow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP }}>
              {EXTERIOR_SLOTS.map((s) => <PhotoTile key={s.key} label={s.label} uri={requiredLocal[s.key]} onPress={() => takeSlotPhoto(s.key)} size={TILE_W} />)}
            </View>
          </View>
        )}

        {/* STEP 1: Intérieur */}
        {step === 1 && (
          <View style={{ paddingHorizontal: 14 }}>
            <KRow justify="space-between" style={{ marginBottom: 12 }}>
              <KText variant="caption" bold color="textSecondary">Photos prises</KText>
              <KText variant="caption" bold style={{ color: intCount === 3 ? "#10B981" : colors.primary }}>{intCount}/3</KText>
            </KRow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP }}>
              {INTERIOR_SLOTS.map((s) => <PhotoTile key={s.key} label={s.label} uri={requiredLocal[s.key]} onPress={() => takeSlotPhoto(s.key)} size={TILE_W} />)}
            </View>
          </View>
        )}

        {/* STEP 2: Vidéo */}
        {step === 2 && (
          <View style={{ paddingHorizontal: 14, alignItems: "center" }}>
            <KPressable onPress={async () => { const uri = await pickVideo(); if (uri) setVideoUri(uri); }}
              style={[styles.videoCaptureBox, { borderColor: videoUri ? "#10B981" : (isDark ? colors.cardBorder : "rgba(0,0,0,0.1)"), borderStyle: videoUri ? "solid" : "dashed" }]}>
              {videoUri ? (
                <KVStack align="center" justify="center" gap="sm" style={{ flex: 1, backgroundColor: isDark ? "rgba(16,185,129,0.08)" : "#F0FDF4" }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#10B981", alignItems: "center", justifyContent: "center" }}><Ionicons name="checkmark" size={32} color="#FFF" /></View>
                  <KText variant="h3" bold style={{ color: "#10B981" }}>Vidéo enregistrée</KText>
                  <KText variant="bodySmall" color="textSecondary">Appuie pour remplacer</KText>
                </KVStack>
              ) : (
                <KVStack align="center" justify="center" gap="sm" style={{ flex: 1, backgroundColor: isDark ? colors.bgTertiary : "#F8F9FA" }}>
                  <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.primaryLight, alignItems: "center", justifyContent: "center" }}><Ionicons name="videocam-outline" size={30} color={colors.primary} /></View>
                  <KText variant="h3" bold>Filmer le véhicule</KText>
                  <KText variant="bodySmall" color="textSecondary" center style={{ paddingHorizontal: 20 }}>Fais le tour complet en filmant tous les angles. 60 secondes max.</KText>
                </KVStack>
              )}
            </KPressable>
          </View>
        )}

        {/* STEP 3: Défauts */}
        {step === 3 && (
          <View style={{ paddingHorizontal: 14 }}>
            <KRow justify="space-between" style={{ marginBottom: 12 }}>
              <KText variant="caption" bold color="textSecondary">Défauts photographiés</KText>
              <KText variant="caption" bold color="textTertiary">{detailLocal.length}/6</KText>
            </KRow>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP }}>
              {detailLocal.map((d, idx) => (
                <View key={idx} style={{ width: TILE_W, height: TILE_W, borderRadius: 16, overflow: "hidden", borderWidth: 2, borderColor: "#10B981" }}>
                  <Image source={{ uri: d.uri }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                  <KPressable onPress={() => setDetailLocal((p) => p.filter((_, i) => i !== idx))} style={styles.detailRemove}><Ionicons name="close" size={14} color="#FFF" /></KPressable>
                  <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 5, paddingHorizontal: 8 }}>
                    <KText variant="caption" style={{ fontSize: 11, color: "#FFF" }} numberOfLines={1}>{d.note || "Sans note"}</KText>
                  </View>
                </View>
              ))}
              {detailLocal.length < 6 && (
                <KPressable onPress={takeDetailPhoto} style={styles.addDetailTile}>
                  <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
                  <KText variant="bodySmall" bold style={{ color: colors.primary }}>Ajouter</KText>
                </KPressable>
              )}
            </View>
            {detailLocal.length === 0 && (
              <KRow gap="sm" style={styles.infoHint}>
                <Ionicons name="information-circle-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
                <KText variant="caption" color="textSecondary" style={{ flex: 1, lineHeight: 17 }}>Rayures, impacts, fissures… Photographie chaque défaut existant pour te protéger.</KText>
              </KRow>
            )}
          </View>
        )}

        {/* STEP 4: Récap */}
        {step === 4 && (
          <View style={{ paddingHorizontal: 14 }}>
            <KRow gap="sm" style={styles.warnBox}>
              <Ionicons name="alert-circle" size={18} color="#F59E0B" style={{ marginTop: 1 }} />
              <KText variant="bodySmall" bold style={{ flex: 1, color: isDark ? "#FCD34D" : "#92400E", lineHeight: 19 }}>Vérifie que toutes les photos sont correctes. Après confirmation, plus aucune modification.</KText>
            </KRow>
            <KText variant="label" bold style={{ marginBottom: 10 }}>9 photos obligatoires</KText>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP, marginBottom: 20 }}>
              {ALL_REQUIRED_SLOTS.map((s) => <RecapTile key={s.key} label={s.label} uri={requiredLocal[s.key]} />)}
            </View>
            <KRow gap="md" style={{ marginBottom: 10 }}>
              <View style={styles.recapSummaryCard}>
                <Ionicons name={videoUri ? "checkmark-circle" : "close-circle-outline"} size={22} color={videoUri ? "#10B981" : colors.textTertiary} />
                <KText variant="bodySmall" bold style={{ color: videoUri ? "#10B981" : colors.textTertiary }}>Vidéo 360°</KText>
                <KText variant="caption" color="textTertiary">{videoUri ? "Ajoutée" : "Non ajoutée"}</KText>
              </View>
              <View style={styles.recapSummaryCard}>
                <Ionicons name={detailLocal.length > 0 ? "checkmark-circle" : "close-circle-outline"} size={22} color={detailLocal.length > 0 ? "#10B981" : colors.textTertiary} />
                <KText variant="bodySmall" bold style={{ color: detailLocal.length > 0 ? "#10B981" : colors.textTertiary }}>Défauts</KText>
                <KText variant="caption" color="textTertiary">{detailLocal.length > 0 ? `${detailLocal.length} photo${detailLocal.length > 1 ? "s" : ""}` : "Aucun"}</KText>
              </View>
            </KRow>
          </View>
        )}
      </ScrollView>

      {/* Bottom bars */}
      {step === 0 && <BottomBar primaryLabel="Continuer" primaryIcon="arrow-forward" primaryEnabled={extCount === 6} onPrimary={goNext} />}
      {step === 1 && <BottomBar primaryLabel="Continuer" primaryIcon="arrow-forward" primaryEnabled={intCount === 3} onPrimary={goNext} />}
      {step === 2 && <BottomBar primaryLabel={videoUri ? "Continuer" : "Passer cette étape"} primaryIcon="arrow-forward" primaryEnabled onPrimary={goNext} />}
      {step === 3 && <BottomBar primaryLabel={detailLocal.length > 0 ? "Continuer" : "Passer cette étape"} primaryIcon="arrow-forward" primaryEnabled onPrimary={goNext} />}
      {step === 4 && <BottomBar primaryLabel="Maintenir pour verrouiller" primaryIcon="shield-checkmark-outline" primaryEnabled={extCount === 6 && intCount === 3} onPrimary={submit} loading={submitting} longPress />}
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", alignItems: "center", justifyContent: "center" },
  guardCircleRed: { width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? colors.bgTertiary : "#FEF2F2", alignItems: "center", justifyContent: "center" },
  guardCircleWarn: { width: 64, height: 64, borderRadius: 32, backgroundColor: isDark ? colors.bgTertiary : "#FEF3C7", alignItems: "center", justifyContent: "center" },
  lockedBadge: { alignItems: "center", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#ECFDF5" },
  lockedInfo: { alignItems: "flex-start", backgroundColor: isDark ? colors.bgTertiary : "#F0FDF4", borderRadius: 14, padding: 14, marginBottom: 16 },
  videoRecapTile: {
    width: RECAP_TILE, height: RECAP_TILE, borderRadius: 12, overflow: "hidden",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
    backgroundColor: isDark ? colors.bgTertiary : "#F8F9FA", alignItems: "center", justifyContent: "center", gap: 4,
  },
  videoCaptureBox: { width: SCREEN_W - 28, height: SCREEN_W - 28, borderRadius: 20, overflow: "hidden", borderWidth: 2 },
  detailRemove: { position: "absolute", top: 6, right: 6, width: 26, height: 26, borderRadius: 13, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  addDetailTile: {
    width: TILE_W, height: TILE_W, borderRadius: 16, borderWidth: 1.5, borderStyle: "dashed",
    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.1)", alignItems: "center", justifyContent: "center", gap: 6,
  },
  infoHint: { marginTop: 16, backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8", borderRadius: 14, padding: 14, alignItems: "flex-start" },
  warnBox: { alignItems: "flex-start", backgroundColor: isDark ? "rgba(245,158,11,0.1)" : "#FEF3C7", borderRadius: 14, padding: 14, marginBottom: 16 },
  recapSummaryCard: {
    flex: 1, backgroundColor: colors.card, borderRadius: 14, padding: 14, borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)", alignItems: "center", gap: 6,
  },
}));
