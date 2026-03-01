import { useState, useRef } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { haptic } from "../../src/theme";
import { showSuccessToast, showErrorToast } from "../../src/presentation/components/Toast";
import {
  KText,
  KRow,
  KVStack,
  KPressable,
  KButton,
  createStyles,
} from "../../src/ui";

// ═══════════════════════════════════════════════════════
// REASONS
// ═══════════════════════════════════════════════════════
const REASONS = [
  { key: "damage", icon: "car-outline", label: "Dommage constaté", desc: "Rayures, bosses, pare-brise fissuré ou dégâts matériels" },
  { key: "dirty", icon: "water-outline", label: "Véhicule sale", desc: "Intérieur ou extérieur rendu dans un état de propreté insuffisant" },
  { key: "missing_part", icon: "search-outline", label: "Pièce manquante", desc: "Accessoire, document ou équipement absent au retour" },
  { key: "km_exceeded", icon: "speedometer-outline", label: "Kilométrage dépassé", desc: "Le locataire a dépassé le kilométrage convenu" },
  { key: "mechanical", icon: "construct-outline", label: "Problème mécanique", desc: "Panne, bruit suspect ou dysfonctionnement constaté" },
  { key: "other", icon: "chatbubble-outline", label: "Autre problème", desc: "Un problème qui ne correspond à aucune catégorie" },
];

const DESC_MIN = 10;
const DESC_MAX = 1000;

// ═══════════════════════════════════════════════════════
// REASON CARD
// ═══════════════════════════════════════════════════════
function ReasonCard({ reason, selected, onPress }: {
  reason: typeof REASONS[0]; selected: boolean; onPress: () => void;
}) {
  const { styles, colors, isDark } = useStyles();
  return (
    <KPressable onPress={onPress} style={[
      styles.reasonCard,
      selected && styles.reasonCardSelected,
    ]}>
      <View style={[
        styles.reasonIcon,
        { backgroundColor: selected ? colors.primary + "14" : (isDark ? "rgba(255,255,255,0.04)" : "#F3F4F6") },
      ]}>
        <Ionicons name={reason.icon as any} size={20} color={selected ? colors.primary : colors.textTertiary} />
      </View>
      <KVStack flex={1} gap={2}>
        <KText variant="label" bold={selected}>{reason.label}</KText>
        <KText variant="caption" color="textTertiary" style={{ lineHeight: 17 }}>{reason.desc}</KText>
      </KVStack>
      <View style={[
        styles.radio,
        selected && { borderColor: colors.primary, backgroundColor: colors.primary },
      ]}>
        {selected && <View style={styles.radioInner} />}
      </View>
    </KPressable>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function DisputeScreen() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();

  const [selectedReason, setSelectedReason] = useState("");
  const [description, setDescription] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const canDisputeResult = useQuery(
    api.disputes.canDispute,
    reservationId ? { reservationId: reservationId as any } : "skip"
  );
  const openDispute = useMutation(api.disputes.openDispute);

  const canSend = selectedReason !== "" && description.trim().length >= DESC_MIN;

  const onSubmit = async () => {
    if (!canSend || sending) return;
    Keyboard.dismiss();
    setSending(true);
    try {
      await openDispute({
        reservationId: reservationId as any,
        reason: selectedReason as any,
        description: description.trim(),
      });
      haptic.success();
      setSent(true);
    } catch (e: any) {
      if (e?.message?.includes("DisputeAlreadyOpen")) {
        Alert.alert("Litige déjà ouvert", "Un litige est déjà en cours pour cette réservation.");
        router.back();
      } else if (e?.message?.includes("DisputeWindowExpired")) {
        Alert.alert("Délai expiré", "Le délai de 48h pour ouvrir un litige est dépassé.");
        router.back();
      } else if (e?.message?.includes("NoCheckoutReport")) {
        Alert.alert("Constat retour requis", "Tu dois réaliser le constat retour avant de pouvoir ouvrir un litige.");
        router.back();
      } else if (e?.message?.includes("DescriptionTooShort")) {
        Alert.alert("Description trop courte", "Décris le problème en au moins 10 caractères.");
      } else {
        showErrorToast(e);
      }
    } finally {
      setSending(false);
    }
  };

  // ── Success state (MUST be before canDisputeResult — reactive query flips after submit) ──
  if (sent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={40} color="#FFF" />
          </View>
          <KText variant="h2" bold style={{ marginTop: 24, textAlign: "center" }}>Litige ouvert</KText>
          <KText variant="body" color="textSecondary" style={{ marginTop: 10, textAlign: "center", lineHeight: 22 }}>
            Notre équipe va examiner ton signalement et les constats d'état. Tu seras notifié de la décision. La caution reste bloquée en attendant.
          </KText>
          <KButton
            title="Retour aux réservations"
            onPress={() => { router.back(); router.push("/profile/reservations"); }}
            fullWidth
            size="lg"
            style={{ marginTop: 32 }}
          />
        </View>
      </SafeAreaView>
    );
  }

  // ── Can't open ──
  if (canDisputeResult && !canDisputeResult.canOpen) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 32 }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="information-circle-outline" size={48} color={colors.textTertiary} />
        <KText variant="h3" bold style={{ marginTop: 12, textAlign: "center" }}>
          {canDisputeResult.reason === "expired" ? "Délai expiré" : canDisputeResult.reason === "already_open" ? "Litige déjà ouvert" : canDisputeResult.reason === "no_checkout" ? "Constat retour requis" : "Litige impossible"}
        </KText>
        <KText variant="bodySmall" color="textSecondary" style={{ marginTop: 8, textAlign: "center", lineHeight: 20 }}>
          {canDisputeResult.reason === "expired"
            ? "Le délai de 48h après la fin de la location est dépassé."
            : canDisputeResult.reason === "already_open"
              ? "Un litige est déjà en cours pour cette réservation."
              : canDisputeResult.reason === "no_checkout"
                ? "Tu dois d'abord réaliser le constat retour avant de pouvoir ouvrir un litige."
                : "Cette réservation n'est pas éligible à un litige."}
        </KText>
        <KButton title="Retour" onPress={() => router.back()} style={{ marginTop: 24 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <KRow gap={8} style={styles.header}>
        <KPressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={20} color={colors.text} />
        </KPressable>
        <View style={{ flex: 1, alignItems: "center" }}>
          <KText variant="label" bold style={{ fontSize: 16 }}>Signaler un problème</KText>
        </View>
        <View style={{ width: 36 }} />
      </KRow>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 160 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Intro ── */}
          <View style={styles.infoBox}>
            <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            <KVStack flex={1} gap={4}>
              <KText variant="label" bold>Protection Kreeny</KText>
              <KText variant="caption" color="textSecondary" style={{ lineHeight: 18 }}>
                Si tu constates un problème, ouvre un litige. La caution sera bloquée le temps que notre équipe examine la situation. Les constats photo serviront de preuve.
              </KText>
            </KVStack>
          </View>

          {/* ── Reason selection ── */}
          <KText variant="h3" bold style={{ marginTop: 24, marginBottom: 6 }}>
            Quel problème as-tu constaté ?
          </KText>
          <KText variant="bodySmall" color="textSecondary" style={{ marginBottom: 16, lineHeight: 20 }}>
            Sélectionne la raison la plus proche de ta situation.
          </KText>

          <KVStack gap="sm">
            {REASONS.map((r) => (
              <ReasonCard
                key={r.key}
                reason={r}
                selected={selectedReason === r.key}
                onPress={() => setSelectedReason(selectedReason === r.key ? "" : r.key)}
              />
            ))}
          </KVStack>

          {/* ── Description ── */}
          {selectedReason !== "" && (
            <KVStack gap="sm" style={{ marginTop: 24 }}>
              <KText variant="label" bold>Décris le problème</KText>
              <KText variant="caption" color="textTertiary">Minimum 10 caractères — sois précis pour aider notre équipe</KText>
              <View style={styles.textareaWrap}>
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Décris ce que tu as constaté, quand, et si possible les circonstances…"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  maxLength={DESC_MAX}
                  style={styles.textarea}
                  onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                />
              </View>
              <KText variant="caption" color={description.trim().length < DESC_MIN ? "error" : "textTertiary"} style={{ alignSelf: "flex-end" }}>
                {description.length}/{DESC_MAX}
              </KText>
            </KVStack>
          )}

          {/* ── Trust note ── */}
          <KRow gap="sm" style={styles.trustNote}>
            <Ionicons name="camera-outline" size={14} color={colors.textTertiary} />
            <KText variant="caption" color="textTertiary" style={{ flex: 1, lineHeight: 17 }}>
              Les constats photo de départ et retour seront utilisés comme preuves pour examiner le litige.
            </KText>
          </KRow>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Sticky submit ── */}
      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <KButton
          title={sending ? "Envoi en cours…" : "Ouvrir le litige"}
          onPress={onSubmit}
          disabled={!canSend || sending}
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
  infoBox: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    padding: 16, borderRadius: 16,
    backgroundColor: isDark ? "rgba(59,130,246,0.06)" : "#F0F6FF",
    borderWidth: 1, borderColor: isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.1)",
  },
  reasonCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    padding: 16, borderRadius: 16,
    backgroundColor: isDark ? colors.bgTertiary : "#FAFBFC",
    borderWidth: 1.5, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  reasonCardSelected: {
    borderColor: colors.primary,
    backgroundColor: isDark ? "rgba(59,130,246,0.06)" : "#F0F6FF",
  },
  reasonIcon: {
    width: 42, height: 42, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
  },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)",
    alignItems: "center", justifyContent: "center",
  },
  radioInner: {
    width: 10, height: 10, borderRadius: 5, backgroundColor: "#FFF",
  },
  textareaWrap: {
    backgroundColor: isDark ? colors.bgTertiary : "#F7F8FA",
    borderRadius: 14, borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  textarea: {
    minHeight: 120, padding: 14, fontSize: 15, color: colors.text,
    textAlignVertical: "top",
  },
  trustNote: {
    marginTop: 24, padding: 12, borderRadius: 12,
    backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
    alignItems: "center",
  },
  successCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#10B981",
    alignItems: "center", justifyContent: "center",
  },
  stickyBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingHorizontal: 18, paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
}));
