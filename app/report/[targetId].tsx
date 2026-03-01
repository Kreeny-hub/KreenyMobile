import { useState } from "react";
import { Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation } from "convex/react";
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
  KDivider,
  KButton,
  createStyles,
} from "../../src/ui";

// ═══════════════════════════════════════════════════════
// REASONS CONFIG
// ═══════════════════════════════════════════════════════
const VEHICLE_REASONS = [
  { key: "fake", icon: "alert-circle-outline", label: "Annonce frauduleuse", desc: "Photos trompeuses, véhicule inexistant ou informations fausses" },
  { key: "inappropriate", icon: "ban-outline", label: "Contenu inapproprié", desc: "Photos ou description choquantes ou offensantes" },
  { key: "dangerous", icon: "warning-outline", label: "Véhicule dangereux", desc: "Problèmes de sécurité, pneus usés, freins défaillants…" },
  { key: "fraud", icon: "card-outline", label: "Tentative d'arnaque", desc: "Demande de paiement hors plateforme, faux profil" },
  { key: "other", icon: "chatbubble-outline", label: "Autre problème", desc: "Un problème qui ne rentre dans aucune catégorie" },
];

const USER_REASONS = [
  { key: "fraud", icon: "person-remove-outline", label: "Profil frauduleux", desc: "Fausse identité, photos volées ou compte usurpé" },
  { key: "inappropriate", icon: "ban-outline", label: "Comportement inapproprié", desc: "Propos offensants, harcèlement ou menaces" },
  { key: "dangerous", icon: "warning-outline", label: "Utilisateur dangereux", desc: "Comportement mettant en danger la sécurité" },
  { key: "other", icon: "chatbubble-outline", label: "Autre problème", desc: "Un problème qui ne rentre dans aucune catégorie" },
];

const COMMENT_MAX = 500;

// ═══════════════════════════════════════════════════════
// REASON CARD
// ═══════════════════════════════════════════════════════
function ReasonCard({ reason, selected, onPress }: {
  reason: typeof VEHICLE_REASONS[0]; selected: boolean; onPress: () => void;
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
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function ReportScreen() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const { targetId, targetType, targetLabel } = useLocalSearchParams<{
    targetId: string;
    targetType: string;
    targetLabel?: string;
  }>();

  const [selectedReason, setSelectedReason] = useState("");
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const reportMut = useMutation(api.reports.submitReport);

  const reasons = targetType === "user" ? USER_REASONS : VEHICLE_REASONS;
  const canSend = selectedReason !== "";

  const onSubmit = async () => {
    if (!canSend || sending) return;
    Keyboard.dismiss();
    setSending(true);
    try {
      await reportMut({
        targetType: (targetType || "vehicle") as any,
        targetId: targetId!,
        reason: selectedReason as any,
        comment: comment.trim() || undefined,
      });
      haptic.success();
      setSent(true);
    } catch (e: any) {
      if (e?.message?.includes("AlreadyReported")) {
        Alert.alert("Déjà signalé", "Tu as déjà signalé cet élément. Notre équipe va l'examiner.");
        router.back();
      } else {
        showErrorToast(e);
      }
    } finally {
      setSending(false);
    }
  };

  // ── Success state ──
  if (sent) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark" size={40} color="#FFF" />
          </View>
          <KText variant="h2" bold style={{ marginTop: 24, textAlign: "center" }}>Signalement envoyé</KText>
          <KText variant="body" color="textSecondary" style={{ marginTop: 10, textAlign: "center", lineHeight: 22 }}>
            Merci d'aider à garder Kreeny sûr. Notre équipe va examiner ce signalement dans les plus brefs délais.
          </KText>
          <KButton
            title="Retour"
            onPress={() => router.back()}
            fullWidth
            size="lg"
            style={{ marginTop: 32 }}
          />
        </View>
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
          <KText variant="label" bold style={{ fontSize: 16 }}>Signaler</KText>
        </View>
        <View style={{ width: 36 }} />
      </KRow>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 100 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Context ── */}
          <View style={styles.contextBox}>
            <Ionicons
              name={targetType === "user" ? "person-outline" : "car-outline"}
              size={18}
              color={colors.primary}
            />
            <KVStack flex={1} gap={2}>
              <KText variant="caption" color="textTertiary">
                {targetType === "user" ? "Utilisateur signalé" : "Annonce signalée"}
              </KText>
              <KText variant="label" bold numberOfLines={1}>{targetLabel || targetId}</KText>
            </KVStack>
          </View>

          {/* ── Reason selection ── */}
          <KText variant="h3" bold style={{ marginTop: 24, marginBottom: 6 }}>
            Quel est le problème ?
          </KText>
          <KText variant="bodySmall" color="textSecondary" style={{ marginBottom: 16, lineHeight: 20 }}>
            Sélectionne la raison qui correspond le mieux. Ton signalement est confidentiel.
          </KText>

          <KVStack gap="sm">
            {reasons.map((r) => (
              <ReasonCard
                key={r.key}
                reason={r}
                selected={selectedReason === r.key}
                onPress={() => setSelectedReason(selectedReason === r.key ? "" : r.key)}
              />
            ))}
          </KVStack>

          {/* ── Comment ── */}
          {selectedReason !== "" && (
            <KVStack gap="sm" style={{ marginTop: 24 }}>
              <KText variant="label" bold>Détails supplémentaires</KText>
              <KText variant="caption" color="textTertiary">Optionnel — aide notre équipe à mieux comprendre la situation</KText>
              <View style={styles.textareaWrap}>
                <TextInput
                  value={comment}
                  onChangeText={setComment}
                  placeholder="Décris ce que tu as observé…"
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  maxLength={COMMENT_MAX}
                  style={styles.textarea}
                />
              </View>
              <KText variant="caption" color="textTertiary" style={{ alignSelf: "flex-end" }}>
                {comment.length}/{COMMENT_MAX}
              </KText>
            </KVStack>
          )}

          {/* ── Trust note ── */}
          <KRow gap="sm" style={styles.trustNote}>
            <Ionicons name="lock-closed-outline" size={14} color={colors.textTertiary} />
            <KText variant="caption" color="textTertiary" style={{ flex: 1, lineHeight: 17 }}>
              Ton signalement est anonyme. La personne signalée ne saura pas qui a envoyé le signalement.
            </KText>
          </KRow>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Sticky submit ── */}
      <View style={[styles.stickyBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <KButton
          title={sending ? "Envoi en cours…" : "Envoyer le signalement"}
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
  contextBox: {
    flexDirection: "row", alignItems: "center", gap: 12,
    padding: 14, borderRadius: 14,
    backgroundColor: isDark ? colors.bgTertiary : "#F7F8FA",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
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
    minHeight: 100, padding: 14, fontSize: 15, color: colors.text,
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
