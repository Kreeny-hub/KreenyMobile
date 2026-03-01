import { useState } from "react";
import { Dimensions, Image, Modal, ScrollView, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import {
  KText,
  KRow,
  KVStack,
  KPressable,
  createStyles,
} from "../../src/ui";

const { width: SCREEN_W } = Dimensions.get("window");
const PHOTO_SIZE = (SCREEN_W - 18 * 2 - 8 * 2) / 3; // 3 columns

// ═══════════════════════════════════════════════════════
// SLOT LABELS (human-readable)
// ═══════════════════════════════════════════════════════
const SLOT_LABELS: Record<string, string> = {
  front: "Avant", front_left: "Avant gauche", front_right: "Avant droit",
  back: "Arrière", back_left: "Arrière gauche", back_right: "Arrière droit",
  left_side: "Côté gauche", right_side: "Côté droit",
  dashboard: "Tableau de bord", interior_front: "Intérieur avant",
  interior_rear: "Intérieur arrière", trunk: "Coffre",
  roof: "Toit", mileage: "Compteur km", fuel: "Jauge carburant",
};

// ═══════════════════════════════════════════════════════
// PHOTO GRID (with optional labels)
// ═══════════════════════════════════════════════════════
function PhotoGrid({ photos, onPress }: {
  photos: { url: string; label?: string }[];
  onPress: (url: string) => void;
}) {
  const { colors, isDark } = useStyles();
  if (!photos.length) return (
    <KText variant="caption" color="textTertiary" style={{ fontStyle: "italic", paddingVertical: 8 }}>
      Aucune photo
    </KText>
  );
  return (
    <KRow gap={8} wrap>
      {photos.map((p, i) => (
        <KPressable key={i} onPress={() => onPress(p.url)}>
          <View>
            <Image source={{ uri: p.url }} style={{ width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: 10 }} />
            {p.label && (
              <View style={{
                position: "absolute", bottom: 0, left: 0, right: 0,
                backgroundColor: "rgba(0,0,0,0.55)", borderBottomLeftRadius: 10, borderBottomRightRadius: 10,
                paddingHorizontal: 6, paddingVertical: 3,
              }}>
                <KText variant="caption" style={{ color: "#FFF", fontSize: 9 }}>{p.label}</KText>
              </View>
            )}
          </View>
        </KPressable>
      ))}
    </KRow>
  );
}

// ═══════════════════════════════════════════════════════
// REPORT SECTION (one phase + role)
// ═══════════════════════════════════════════════════════
function ReportSection({ report, onPhotoPress }: { report: any; onPhotoPress: (url: string) => void }) {
  const { styles, colors, isDark } = useStyles();

  const requiredPhotos = Object.entries(report.requiredUrls || {})
    .filter(([, url]) => url)
    .map(([slot, url]) => ({ url: url as string, label: SLOT_LABELS[slot] ?? slot }));

  const detailPhotos = (report.detailPhotos || [])
    .filter((d: any) => d.url)
    .map((d: any) => ({ url: d.url, label: d.note || "Détail" }));

  const date = new Date(report.completedAt);
  const dateStr = date.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <View style={styles.section}>
      {/* Header */}
      <KRow gap={8} style={{ alignItems: "center", marginBottom: 10 }}>
        <View style={[styles.roleBadge, { backgroundColor: report.role === "owner" ? "#3B82F620" : "#10B98120" }]}>
          <Ionicons
            name={report.role === "owner" ? "person" : "car"}
            size={12}
            color={report.role === "owner" ? "#3B82F6" : "#10B981"}
          />
          <KText variant="caption" bold style={{ color: report.role === "owner" ? "#3B82F6" : "#10B981", fontSize: 11 }}>
            {report.role === "owner" ? "Propriétaire" : "Locataire"}
          </KText>
        </View>
        <KText variant="caption" color="textTertiary">{report.submittedBy}</KText>
        <View style={{ flex: 1 }} />
        <KText variant="caption" color="textTertiary" style={{ fontSize: 10 }}>{dateStr}</KText>
      </KRow>

      {/* Required photos */}
      <KText variant="caption" bold style={{ marginBottom: 6 }}>
        Photos obligatoires ({requiredPhotos.length})
      </KText>
      <PhotoGrid photos={requiredPhotos} onPress={onPhotoPress} />

      {/* Detail photos */}
      {detailPhotos.length > 0 && (
        <>
          <KText variant="caption" bold style={{ marginTop: 12, marginBottom: 6 }}>
            Photos détails ({detailPhotos.length})
          </KText>
          <PhotoGrid photos={detailPhotos} onPress={onPhotoPress} />
        </>
      )}

      {/* Video */}
      {report.videoUrl && (
        <KRow gap={6} style={{ marginTop: 10, alignItems: "center" }}>
          <Ionicons name="videocam-outline" size={14} color={colors.primary} />
          <KText variant="caption" color="primary">Vidéo 360° disponible</KText>
        </KRow>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function ConditionReportsViewer() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const { reservationId, vehicleTitle } = useLocalSearchParams<{ reservationId: string; vehicleTitle?: string }>();

  const reports = useQuery(
    api.conditionReports.adminGetAllConditionReports,
    reservationId ? { reservationId: reservationId as any } : "skip"
  );

  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null);

  // Group reports
  const checkinOwner = reports?.find((r) => r.phase === "checkin" && r.role === "owner");
  const checkinRenter = reports?.find((r) => r.phase === "checkin" && r.role === "renter");
  const checkoutOwner = reports?.find((r) => r.phase === "checkout" && r.role === "owner");
  const checkoutRenter = reports?.find((r) => r.phase === "checkout" && r.role === "renter");

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <KRow gap={8} style={styles.header}>
        <KPressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <KVStack style={{ flex: 1 }}>
          <KText variant="label" bold style={{ fontSize: 16 }}>Constats d'état</KText>
          {vehicleTitle && <KText variant="caption" color="textSecondary" numberOfLines={1}>{vehicleTitle}</KText>}
        </KVStack>
      </KRow>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}
      >
        {/* Loading */}
        {reports === undefined && (
          <KVStack align="center" style={{ paddingVertical: 40 }}>
            <KText variant="bodySmall" color="textTertiary">Chargement…</KText>
          </KVStack>
        )}

        {/* Empty */}
        {reports && reports.length === 0 && (
          <KVStack align="center" style={{ paddingVertical: 40 }}>
            <Ionicons name="camera-outline" size={40} color={colors.textTertiary} />
            <KText variant="bodySmall" color="textTertiary" style={{ marginTop: 8 }}>Aucun constat soumis</KText>
          </KVStack>
        )}

        {/* ══ CHECKIN (Départ) ══ */}
        {(checkinOwner || checkinRenter) && (
          <>
            <KRow gap={8} style={{ alignItems: "center", marginBottom: 14 }}>
              <View style={[styles.phaseBadge, { backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "#EFF6FF" }]}>
                <Ionicons name="log-in-outline" size={16} color="#3B82F6" />
              </View>
              <KVStack>
                <KText variant="label" bold>Constat de départ</KText>
                <KText variant="caption" color="textTertiary">
                  {[checkinOwner, checkinRenter].filter(Boolean).length} rapport{[checkinOwner, checkinRenter].filter(Boolean).length > 1 ? "s" : ""}
                </KText>
              </KVStack>
            </KRow>

            {checkinOwner && <ReportSection report={checkinOwner} onPhotoPress={setFullscreenUrl} />}
            {checkinRenter && <ReportSection report={checkinRenter} onPhotoPress={setFullscreenUrl} />}
          </>
        )}

        {/* Separator */}
        {(checkinOwner || checkinRenter) && (checkoutOwner || checkoutRenter) && (
          <View style={{ height: 1, backgroundColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)", marginVertical: 20 }} />
        )}

        {/* ══ CHECKOUT (Retour) ══ */}
        {(checkoutOwner || checkoutRenter) && (
          <>
            <KRow gap={8} style={{ alignItems: "center", marginBottom: 14 }}>
              <View style={[styles.phaseBadge, { backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2" }]}>
                <Ionicons name="log-out-outline" size={16} color="#EF4444" />
              </View>
              <KVStack>
                <KText variant="label" bold>Constat de retour</KText>
                <KText variant="caption" color="textTertiary">
                  {[checkoutOwner, checkoutRenter].filter(Boolean).length} rapport{[checkoutOwner, checkoutRenter].filter(Boolean).length > 1 ? "s" : ""}
                </KText>
              </KVStack>
            </KRow>

            {checkoutOwner && <ReportSection report={checkoutOwner} onPhotoPress={setFullscreenUrl} />}
            {checkoutRenter && <ReportSection report={checkoutRenter} onPhotoPress={setFullscreenUrl} />}
          </>
        )}
      </ScrollView>

      {/* ── Fullscreen photo viewer ── */}
      <Modal visible={!!fullscreenUrl} transparent animationType="fade" onRequestClose={() => setFullscreenUrl(null)}>
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.92)", justifyContent: "center", alignItems: "center" }}>
          <KPressable onPress={() => setFullscreenUrl(null)} style={{ position: "absolute", top: insets.top + 12, right: 16, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="close" size={22} color="#FFF" />
          </KPressable>
          {fullscreenUrl && (
            <Image
              source={{ uri: fullscreenUrl }}
              style={{ width: SCREEN_W - 32, height: SCREEN_W - 32, borderRadius: 12 }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
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
  phaseBadge: {
    width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  section: {
    padding: 14, borderRadius: 14, marginBottom: 12,
    backgroundColor: isDark ? colors.bgTertiary : "#FAFBFC",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  roleBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
}));
