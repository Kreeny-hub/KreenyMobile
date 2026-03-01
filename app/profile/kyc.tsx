import { useMutation, useQuery } from "convex/react";
import { Stack, router } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, Alert, Image, ScrollView, View, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../convex/_generated/api";
import { KText, KVStack, KRow, KPressable, createStyles } from "../../src/ui";
import { KButton } from "../../src/theme/components/KButton";
import { KScreen } from "../../src/ui/primitives/KScreen";
import { KHeader } from "../../src/ui/patterns/KHeader";
import { haptic } from "../../src/theme/haptics";
import { DocumentCamera } from "./DocumentCamera";

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════
type DocSlot = {
  key: string;
  label: string;
  sublabel: string;
  icon: string;
};

const DOC_SLOTS: DocSlot[] = [
  { key: "cinRecto", label: "CIN / Passeport", sublabel: "Recto (face avant)", icon: "id-card-outline" },
  { key: "cinVerso", label: "CIN / Passeport", sublabel: "Verso (face arrière)", icon: "id-card-outline" },
  { key: "permisRecto", label: "Permis de conduire", sublabel: "Recto (face avant)", icon: "card-outline" },
  { key: "permisVerso", label: "Permis de conduire", sublabel: "Verso (face arrière)", icon: "card-outline" },
];

// ══════════════════════════════════════════════════════════
// Status Banner
// ══════════════════════════════════════════════════════════
const STATUS_CONFIG: Record<string, { icon: string; color: string; bg: string; title: string }> = {
  pending: {
    icon: "time-outline", color: "#3B82F6", bg: "rgba(59,130,246,0.08)",
    title: "Vérification en cours",
  },
  verified: {
    icon: "checkmark-circle", color: "#10B981", bg: "rgba(16,185,129,0.08)",
    title: "Identité vérifiée",
  },
  rejected: {
    icon: "close-circle-outline", color: "#EF4444", bg: "rgba(239,68,68,0.08)",
    title: "Vérification refusée",
  },
};

// ══════════════════════════════════════════════════════════
// Photo Slot Component
// ══════════════════════════════════════════════════════════
function PhotoSlot({
  slot, uri, onPick, disabled,
}: {
  slot: DocSlot; uri: string | null; onPick: () => void; disabled: boolean;
}) {
  const { styles: s, colors } = useSlotStyles();

  return (
    <KPressable onPress={disabled ? undefined : onPick} style={s.card}>
      {uri ? (
        <View style={s.imgWrap}>
          <Image source={{ uri }} style={s.img} resizeMode="cover" />
          {!disabled && (
            <View style={s.editBadge}>
              <Ionicons name="pencil" size={12} color="#FFF" />
            </View>
          )}
        </View>
      ) : (
        <View style={s.placeholder}>
          <Ionicons name="camera-outline" size={24} color={colors.primary} />
        </View>
      )}
      <KVStack gap={2} style={{ flex: 1 }}>
        <KRow gap={6} style={{ alignItems: "center" }}>
          <Ionicons name={slot.icon as any} size={16} color={colors.text} />
          <KText variant="label" bold style={{ fontSize: 14 }}>{slot.label}</KText>
        </KRow>
        <KText variant="caption" color="textSecondary">{slot.sublabel}</KText>
      </KVStack>
      {uri ? (
        <Ionicons name="checkmark-circle" size={22} color="#10B981" />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
      )}
    </KPressable>
  );
}

const useSlotStyles = createStyles((colors, isDark) => ({
  card: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 12,
    padding: 12, borderRadius: 14,
    backgroundColor: isDark ? colors.bgTertiary : "#FAFBFC",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  imgWrap: { width: 64, height: 48, borderRadius: 8, overflow: "hidden" as const },
  img: { width: 64, height: 48 },
  editBadge: {
    position: "absolute" as const, bottom: 2, right: 2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  placeholder: {
    width: 64, height: 48, borderRadius: 8,
    borderWidth: 1.5, borderColor: colors.primary, borderStyle: "dashed" as const,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
}));

// ══════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════
export default function KycScreen() {
  const { styles, colors, isDark } = useStyles();

  const kycData = useQuery(api.kyc.getMyKycStatus);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const submitKyc = useMutation(api.kyc.submitKyc);

  const [photos, setPhotos] = useState<Record<string, string>>({});
  const [storageIds, setStorageIds] = useState<Record<string, any>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cameraSlot, setCameraSlot] = useState<string | null>(null);

  const status = kycData?.status ?? "none";
  const isLocked = status === "pending" || status === "verified";

  // Pre-fill with existing docs
  const existingDocs = kycData?.documents ?? [];

  const getUri = (key: string): string | null => {
    if (photos[key]) return photos[key];
    // Map key to docType + side
    const map: Record<string, { docType: string; side: string }> = {
      cinRecto: { docType: "cin", side: "recto" },
      cinVerso: { docType: "cin", side: "verso" },
      permisRecto: { docType: "permis", side: "recto" },
      permisVerso: { docType: "permis", side: "verso" },
    };
    const m = map[key];
    if (!m) return null;
    const existing = existingDocs.find((d: any) => d.docType === m.docType && d.side === m.side);
    return existing?.url ?? null;
  };

  const pickPhoto = useCallback((key: string) => {
    if (isLocked) return;
    setCameraSlot(key);
  }, [isLocked]);

  const handleCameraCapture = useCallback(async (uri: string) => {
    const key = cameraSlot;
    setCameraSlot(null);
    if (!key) return;

    setUploading(key);
    try {
      const uploadUrl = await generateUploadUrl();
      const blob = await (await fetch(uri)).blob();
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: blob,
      });
      if (!resp.ok) throw new Error("Upload failed");
      const { storageId } = await resp.json();

      setPhotos((prev) => ({ ...prev, [key]: uri }));
      setStorageIds((prev) => ({ ...prev, [key]: storageId }));
    } catch {
      Alert.alert("Erreur", "Impossible d'uploader la photo.");
    } finally {
      setUploading(null);
    }
  }, [cameraSlot, generateUploadUrl]);

  const allUploaded = DOC_SLOTS.every((s) => storageIds[s.key]);

  const handleSubmit = useCallback(async () => {
    if (!allUploaded || submitting) return;
    setSubmitting(true);
    try {
      await submitKyc({
        cinRecto: storageIds.cinRecto,
        cinVerso: storageIds.cinVerso,
        permisRecto: storageIds.permisRecto,
        permisVerso: storageIds.permisVerso,
      });
      haptic.success();
      Alert.alert(
        "Documents envoyés !",
        "Notre équipe va vérifier tes documents. Tu recevras une notification dès que c'est fait.",
        [{ text: "OK", onPress: () => router.back() }]
      );
    } catch (e: any) {
      if (e?.data === "AlreadyPending") {
        Alert.alert("Déjà en cours", "Ta vérification est déjà en cours d'examen.");
      } else if (e?.data === "AlreadyVerified") {
        Alert.alert("Déjà vérifié", "Ton identité est déjà vérifiée !");
      } else {
        Alert.alert("Erreur", "Impossible d'envoyer les documents.");
      }
    } finally {
      setSubmitting(false);
    }
  }, [allUploaded, submitting, storageIds, submitKyc]);

  if (kycData === undefined) {
    return (
      <KScreen edges={["top"]} noPadding>
        <Stack.Screen options={{ headerShown: false }} />
        <KHeader title="Vérification d'identité" />
        <KVStack align="center" justify="center" style={{ flex: 1 }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </KVStack>
      </KScreen>
    );
  }

  const sc = STATUS_CONFIG[status];

  return (
    <KScreen edges={["top"]} noPadding bottomInset={120}>
      <Stack.Screen options={{ headerShown: false }} />
      <KHeader title="Vérification d'identité" />

      <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>

        {/* ── Status banner ── */}
        {sc && (
          <View style={[styles.statusBanner, { backgroundColor: sc.bg }]}>
            <Ionicons name={sc.icon as any} size={24} color={sc.color} />
            <KVStack gap={4} style={{ flex: 1 }}>
              <KText variant="label" bold style={{ color: sc.color }}>{sc.title}</KText>
              {status === "pending" && (
                <KText variant="caption" color="textSecondary">
                  Nos équipes examinent tes documents. Tu seras notifié du résultat.
                </KText>
              )}
              {status === "verified" && (
                <KText variant="caption" color="textSecondary">
                  Ton identité est vérifiée. Un badge de confiance apparaît sur ton profil.
                </KText>
              )}
              {status === "rejected" && (
                <KText variant="caption" style={{ color: "#EF4444" }}>
                  {kycData?.rejectionReason || "Documents non conformes. Tu peux resoumettre."}
                </KText>
              )}
            </KVStack>
          </View>
        )}

        {/* ── Info card ── */}
        {(status === "none" || status === "rejected") && (
          <View style={styles.infoCard}>
            <KText variant="label" bold style={{ marginBottom: 6 }}>Documents requis</KText>
            <KText variant="bodySmall" color="textSecondary" style={{ lineHeight: 20 }}>
              Pour vérifier ton identité, nous avons besoin de photos recto/verso de ta carte d'identité nationale (CIN) ou passeport, et de ton permis de conduire.
            </KText>
            <KRow gap={8} style={{ marginTop: 10 }}>
              <View style={styles.tipPill}>
                <Ionicons name="sunny-outline" size={12} color={colors.primary} />
                <KText variant="caption" style={{ color: colors.primary }}>Bonne lumière</KText>
              </View>
              <View style={styles.tipPill}>
                <Ionicons name="scan-outline" size={12} color={colors.primary} />
                <KText variant="caption" style={{ color: colors.primary }}>Bien cadré</KText>
              </View>
              <View style={styles.tipPill}>
                <Ionicons name="eye-outline" size={12} color={colors.primary} />
                <KText variant="caption" style={{ color: colors.primary }}>Lisible</KText>
              </View>
            </KRow>
          </View>
        )}

        {/* ── Document slots ── */}
        {DOC_SLOTS.map((slot) => (
          <View key={slot.key}>
            {uploading === slot.key ? (
              <View style={[styles.uploadingCard]}>
                <ActivityIndicator size="small" color={colors.primary} />
                <KText variant="caption" color="primary" bold>Upload en cours…</KText>
              </View>
            ) : (
              <PhotoSlot
                slot={slot}
                uri={getUri(slot.key)}
                onPick={() => pickPhoto(slot.key)}
                disabled={isLocked}
              />
            )}
          </View>
        ))}

        {/* ── Submit button ── */}
        {(status === "none" || status === "rejected") && (
          <View style={{ marginTop: 8 }}>
            <KButton
              title={submitting ? "Envoi en cours…" : "Envoyer mes documents"}
              onPress={handleSubmit}
              disabled={!allUploaded || submitting}
              loading={submitting}
              size="lg"
            />
            {!allUploaded && (
              <KText variant="caption" color="textTertiary" style={{ textAlign: "center", marginTop: 8 }}>
                Ajoute les 4 photos pour continuer
              </KText>
            )}
          </View>
        )}

      </ScrollView>

      {/* ── Camera overlay ── */}
      {cameraSlot && (
        <Modal visible animationType="slide" presentationStyle="fullScreen">
          <DocumentCamera
            title={DOC_SLOTS.find((s) => s.key === cameraSlot)?.label ?? "Document"}
            subtitle={DOC_SLOTS.find((s) => s.key === cameraSlot)?.sublabel ?? ""}
            onCapture={handleCameraCapture}
            onClose={() => setCameraSlot(null)}
          />
        </Modal>
      )}
    </KScreen>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  statusBanner: {
    flexDirection: "row" as const, alignItems: "flex-start" as const, gap: 12,
    padding: 16, borderRadius: 14,
  },
  infoCard: {
    padding: 16, borderRadius: 14,
    backgroundColor: isDark ? colors.bgTertiary : "#F8F9FB",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  tipPill: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 4,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
    backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.06)",
  },
  uploadingCard: {
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const, gap: 10,
    padding: 20, borderRadius: 14,
    backgroundColor: isDark ? colors.bgTertiary : "#FAFBFC",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
}));
