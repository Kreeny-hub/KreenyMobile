import { useState } from "react";
import { Alert, Image, ScrollView, View } from "react-native";
import { router, Stack } from "expo-router";
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
  createStyles,
} from "../../src/ui";

// ═══════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════
const REPORT_REASON_LABELS: Record<string, string> = {
  inappropriate: "Contenu inapproprié", fraud: "Fraude suspectée",
  dangerous: "Dangereux", fake: "Fausse annonce", other: "Autre",
};
const REPORT_STATUS_CFG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "En attente", color: "#F59E0B", icon: "time-outline" },
  reviewed: { label: "Traité", color: "#10B981", icon: "checkmark-circle-outline" },
  dismissed: { label: "Rejeté", color: "#6B7280", icon: "close-circle-outline" },
};
const TARGET_LABELS: Record<string, string> = { vehicle: "Annonce", user: "Utilisateur", reservation: "Réservation", message: "Message" };

const DISPUTE_REASON_LABELS: Record<string, string> = {
  damage: "Dommage constaté", dirty: "Véhicule sale", missing_part: "Pièce manquante",
  km_exceeded: "Km dépassés", mechanical: "Problème mécanique", other: "Autre",
};
const DISPUTE_STATUS_CFG: Record<string, { label: string; color: string }> = {
  open: { label: "Ouvert", color: "#F59E0B" },
  resolved_no_penalty: { label: "Résolu — sans retenue", color: "#10B981" },
  resolved_partial: { label: "Résolu — retenue partielle", color: "#3B82F6" },
  resolved_full: { label: "Résolu — retenue totale", color: "#EF4444" },
};

const REPORT_FILTERS = [
  { key: "", label: "Tous" }, { key: "pending", label: "En attente" },
  { key: "reviewed", label: "Traités" }, { key: "dismissed", label: "Rejetés" },
];
const DISPUTE_FILTERS = [
  { key: "", label: "Tous" }, { key: "open", label: "Ouverts" },
];

// ═══════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════
function StatCard({ icon, label, value, accent }: { icon: string; label: string; value: number; accent?: boolean }) {
  const { colors, isDark } = useStyles();
  return (
    <View style={{
      flex: 1, padding: 14, borderRadius: 14,
      backgroundColor: isDark ? colors.bgTertiary : "#F9FAFB",
      borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
    }}>
      <Ionicons name={icon as any} size={18} color={colors.textTertiary} />
      <KText variant="h2" bold style={{ marginTop: 6, color: accent && value > 0 ? "#F59E0B" : colors.text }}>{value}</KText>
      <KText variant="caption" color="textTertiary">{label}</KText>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// TIME AGO
// ═══════════════════════════════════════════════════════
function getTimeAgo(date: Date): string {
  const diff = Date.now() - date.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

// ═══════════════════════════════════════════════════════
// REPORT CARD
// ═══════════════════════════════════════════════════════
function ReportCard({ report, onMarkReviewed, onDismiss, onDeactivate }: {
  report: any; onMarkReviewed: () => void; onDismiss: () => void; onDeactivate: () => void;
}) {
  const { styles, colors, isDark } = useStyles();
  const status = REPORT_STATUS_CFG[report.status] ?? REPORT_STATUS_CFG.pending;

  return (
    <View style={styles.card}>
      <KRow gap="sm" style={{ alignItems: "center", marginBottom: 10 }}>
        <View style={[styles.statusPill, { backgroundColor: status.color + "18" }]}>
          <Ionicons name={status.icon as any} size={12} color={status.color} />
          <KText variant="caption" bold style={{ color: status.color, fontSize: 11 }}>{status.label}</KText>
        </View>
        <View style={styles.typePill}>
          <KText variant="caption" bold color="textTertiary" style={{ fontSize: 11 }}>
            {TARGET_LABELS[report.targetType] ?? report.targetType}
          </KText>
        </View>
        <View style={{ flex: 1 }} />
        <KText variant="caption" color="textTertiary" style={{ fontSize: 10 }}>{getTimeAgo(new Date(report.createdAt))}</KText>
      </KRow>

      <KText variant="label" bold style={{ marginBottom: 4 }}>{report.targetLabel}</KText>
      <KText variant="bodySmall" color="textSecondary" style={{ marginBottom: 4 }}>
        {REPORT_REASON_LABELS[report.reason] ?? report.reason}
      </KText>

      {report.comment && (
        <View style={styles.commentBox}>
          <KText variant="caption" color="textSecondary" style={{ fontStyle: "italic", lineHeight: 18 }}>
            « {report.comment} »
          </KText>
        </View>
      )}

      {(report as any).messageText && (
        <View style={[styles.commentBox, { borderLeftColor: "#EF4444", borderLeftWidth: 3 }]}>
          <KText variant="caption" bold color="textSecondary" style={{ fontSize: 10, marginBottom: 2 }}>
            Contenu du message signalé :
          </KText>
          <KText variant="bodySmall" style={{ lineHeight: 18 }}>
            {(report as any).messageText}
          </KText>
        </View>
      )}

      <KText variant="caption" color="textTertiary" style={{ marginTop: 6, fontSize: 11 }}>
        Signalé par {report.reporterName}
      </KText>

      {report.status === "pending" && (
        <KRow gap="sm" style={{ marginTop: 12 }}>
          <KPressable onPress={onMarkReviewed} style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(16,185,129,0.1)" : "#ECFDF5" }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
            <KText variant="caption" bold style={{ color: "#10B981" }}>Traité</KText>
          </KPressable>
          <KPressable onPress={onDismiss} style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(107,114,128,0.1)" : "#F3F4F6" }]}>
            <Ionicons name="close-circle-outline" size={16} color="#6B7280" />
            <KText variant="caption" bold color="textTertiary">Rejeter</KText>
          </KPressable>
          {report.targetType === "vehicle" && (
            <KPressable onPress={onDeactivate} style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2" }]}>
              <Ionicons name="ban-outline" size={16} color="#EF4444" />
              <KText variant="caption" bold style={{ color: "#EF4444" }}>Désactiver</KText>
            </KPressable>
          )}
        </KRow>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// DISPUTE CARD
// ═══════════════════════════════════════════════════════
function DisputeCard({ dispute, onResolve }: {
  dispute: any;
  onResolve: (resolution: "no_penalty" | "partial" | "full") => void;
}) {
  const { styles, colors, isDark } = useStyles();
  const status = DISPUTE_STATUS_CFG[dispute.status] ?? DISPUTE_STATUS_CFG.open;
  const isOpen = dispute.status === "open";

  return (
    <View style={styles.card}>
      {/* Header */}
      <KRow gap="sm" style={{ alignItems: "center", marginBottom: 10 }}>
        <View style={[styles.statusPill, { backgroundColor: status.color + "18" }]}>
          <KText variant="caption" bold style={{ color: status.color, fontSize: 11 }}>{status.label}</KText>
        </View>
        <View style={{ flex: 1 }} />
        <KText variant="caption" color="textTertiary" style={{ fontSize: 10 }}>{getTimeAgo(new Date(dispute.createdAt))}</KText>
      </KRow>

      {/* Vehicle */}
      <KText variant="label" bold style={{ marginBottom: 4 }}>{dispute.vehicleTitle}</KText>
      <KText variant="caption" color="textTertiary" style={{ marginBottom: 8 }}>{dispute.dates}</KText>

      {/* Reason */}
      <KText variant="bodySmall" color="textSecondary" style={{ marginBottom: 4 }}>
        {DISPUTE_REASON_LABELS[dispute.reason] ?? dispute.reason}
      </KText>

      {/* Description */}
      <View style={styles.commentBox}>
        <KText variant="caption" color="textSecondary" style={{ lineHeight: 18 }}>
          {dispute.description}
        </KText>
      </View>

      {/* Photos litige */}
      {dispute.photoUrls?.length > 0 && (
        <>
          <KText variant="caption" bold style={{ marginTop: 12, marginBottom: 6 }}>Photos jointes au litige</KText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <KRow gap={8}>
              {dispute.photoUrls.map((url: string, i: number) => (
                <Image key={`d-${i}`} source={{ uri: url }} style={{ width: 80, height: 80, borderRadius: 10 }} />
              ))}
            </KRow>
          </ScrollView>
        </>
      )}

      {/* Constats résumé */}
      {(dispute.checkinPhotos?.length > 0 || dispute.checkoutPhotos?.length > 0) && (
        <KRow gap={8} style={{ marginTop: 10, alignItems: "center" }}>
          <Ionicons name="camera-outline" size={14} color={colors.textTertiary} />
          <KText variant="caption" color="textSecondary">
            {dispute.checkinPhotos?.length ?? 0} photos départ · {dispute.checkoutPhotos?.length ?? 0} photos retour
          </KText>
        </KRow>
      )}

      {/* Parties */}
      <View style={[styles.partiesBox, { marginTop: 12 }]}>
        <KText variant="caption" bold style={{ marginBottom: 6 }}>Parties concernées</KText>
        <KRow gap={4} style={{ alignItems: "center", marginBottom: 4 }}>
          <Ionicons name="person-outline" size={12} color={colors.textTertiary} />
          <KText variant="caption" color="textSecondary">
            Propriétaire : {dispute.ownerName}{dispute.ownerPhone ? ` · ${dispute.ownerPhone}` : ""}
          </KText>
        </KRow>
        <KRow gap={4} style={{ alignItems: "center", marginBottom: 4 }}>
          <Ionicons name="person-outline" size={12} color={colors.textTertiary} />
          <KText variant="caption" color="textSecondary">
            Locataire : {dispute.renterName}{dispute.renterPhone ? ` · ${dispute.renterPhone}` : ""}
          </KText>
        </KRow>
        <KRow gap={4} style={{ alignItems: "center" }}>
          <Ionicons name="shield-outline" size={12} color={colors.textTertiary} />
          <KText variant="caption" color="textSecondary">
            Caution : {dispute.depositAmount ? `${dispute.depositAmount.toLocaleString("fr-FR")} MAD` : "Non définie"}
          </KText>
        </KRow>
        <KText variant="caption" color="textTertiary" style={{ marginTop: 4, fontSize: 10 }}>
          Ouvert par {dispute.openerName} ({dispute.openedByRole === "renter" ? "locataire" : "propriétaire"})
        </KText>
      </View>

      {/* Admin note (if resolved) */}
      {dispute.adminNote && (
        <View style={[styles.commentBox, { marginTop: 8 }]}>
          <KText variant="caption" bold style={{ marginBottom: 2 }}>Note admin</KText>
          <KText variant="caption" color="textSecondary" style={{ lineHeight: 18 }}>{dispute.adminNote}</KText>
        </View>
      )}

      {dispute.retainedAmount > 0 && (
        <KText variant="caption" bold style={{ marginTop: 6, color: "#EF4444" }}>
          Retenu : {dispute.retainedAmount.toLocaleString("fr-FR")} MAD
        </KText>
      )}

      {/* Voir les constats */}
      <KPressable
        onPress={() => router.push({ pathname: "/admin/condition-reports", params: { reservationId: dispute.reservationId, vehicleTitle: dispute.vehicleTitle } })}
        style={[styles.actionBtn, { marginTop: 12, justifyContent: "center", backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "#EFF6FF", borderWidth: 1, borderColor: isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.15)" }]}
      >
        <Ionicons name="images-outline" size={16} color="#3B82F6" />
        <KText variant="caption" bold style={{ color: "#3B82F6" }}>Voir les constats photo</KText>
      </KPressable>

      {/* Actions */}
      {isOpen && (
        <KVStack gap="sm" style={{ marginTop: 14 }}>
          <KRow gap="sm">
            <KPressable
              onPress={() => onResolve("no_penalty")}
              style={[styles.actionBtn, { flex: 1, justifyContent: "center", backgroundColor: isDark ? "rgba(16,185,129,0.1)" : "#ECFDF5" }]}
            >
              <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
              <KText variant="caption" bold style={{ color: "#10B981" }}>Pas de retenue</KText>
            </KPressable>
            <KPressable
              onPress={() => onResolve("full")}
              style={[styles.actionBtn, { flex: 1, justifyContent: "center", backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2" }]}
            >
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <KText variant="caption" bold style={{ color: "#EF4444" }}>Retenue totale</KText>
            </KPressable>
          </KRow>
          <KPressable
            onPress={() => onResolve("partial")}
            style={[styles.actionBtn, { justifyContent: "center", backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "#EFF6FF" }]}
          >
            <Ionicons name="remove-circle-outline" size={16} color="#3B82F6" />
            <KText variant="caption" bold style={{ color: "#3B82F6" }}>Retenue partielle…</KText>
          </KPressable>
        </KVStack>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// FILTER CHIPS
// ═══════════════════════════════════════════════════════
function FilterChips({ filters, active, onChange, pendingCount }: {
  filters: { key: string; label: string }[]; active: string; onChange: (k: string) => void; pendingCount?: number;
}) {
  const { styles, colors, isDark } = useStyles();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
      <KRow gap="sm">
        {filters.map((f) => (
          <KPressable
            key={f.key}
            onPress={() => onChange(f.key)}
            style={[styles.filterChip, { backgroundColor: active === f.key ? colors.primary : (isDark ? colors.bgTertiary : "#F3F4F6") }]}
          >
            <KText variant="caption" bold style={{ color: active === f.key ? "#FFF" : colors.textSecondary, fontSize: 12 }}>
              {f.label}{(f.key === "pending" || f.key === "open") && pendingCount ? ` (${pendingCount})` : ""}
            </KText>
          </KPressable>
        ))}
      </KRow>
    </ScrollView>
  );
}

// ═══════════════════════════════════════════════════════
// KYC CARD (admin review)
// ═══════════════════════════════════════════════════════
const KYC_STATUS_CFG: Record<string, { label: string; color: string; icon: string }> = {
  pending: { label: "En attente", color: "#F59E0B", icon: "time-outline" },
  verified: { label: "Vérifié", color: "#10B981", icon: "checkmark-circle" },
  rejected: { label: "Refusé", color: "#EF4444", icon: "close-circle-outline" },
};

const DOC_LABELS: Record<string, string> = {
  "cin-recto": "CIN Recto",
  "cin-verso": "CIN Verso",
  "permis-recto": "Permis Recto",
  "permis-verso": "Permis Verso",
};

function KycCard({ item, onApprove, onReject }: {
  item: any;
  onApprove: () => void;
  onReject: () => void;
}) {
  const { styles, colors, isDark } = useStyles();
  const sc = KYC_STATUS_CFG[item.kycStatus] ?? KYC_STATUS_CFG.pending;

  return (
    <View style={styles.card}>
      {/* ── Header ── */}
      <KRow gap="sm" style={{ alignItems: "center", marginBottom: 10 }}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={{ width: 32, height: 32, borderRadius: 16 }} />
        ) : (
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? colors.bgTertiary : "#E5E7EB", alignItems: "center", justifyContent: "center" }}>
            <Ionicons name="person" size={14} color={colors.textTertiary} />
          </View>
        )}
        <KText variant="label" bold style={{ flex: 1, fontSize: 15 }}>{item.displayName}</KText>
        <View style={[styles.statusPill, { backgroundColor: sc.color + "18" }]}>
          <Ionicons name={sc.icon as any} size={12} color={sc.color} />
          <KText variant="caption" bold style={{ color: sc.color, fontSize: 11 }}>{sc.label}</KText>
        </View>
      </KRow>

      {/* ── Documents grid ── */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {(item.documents ?? []).map((doc: any, i: number) => (
          <View key={i} style={{ width: "48%", borderRadius: 10, overflow: "hidden", backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6" }}>
            {doc.url ? (
              <Image source={{ uri: doc.url }} style={{ width: "100%", height: 90 }} resizeMode="cover" />
            ) : (
              <View style={{ width: "100%", height: 90, alignItems: "center", justifyContent: "center" }}>
                <Ionicons name="image-outline" size={24} color={colors.textTertiary} />
              </View>
            )}
            <KText variant="caption" bold style={{ textAlign: "center", paddingVertical: 4, fontSize: 10, color: colors.textSecondary }}>
              {DOC_LABELS[`${doc.docType}-${doc.side}`] ?? `${doc.docType} ${doc.side}`}
            </KText>
          </View>
        ))}
      </View>

      <KText variant="caption" color="textTertiary" style={{ fontSize: 11 }}>
        Soumis {getTimeAgo(new Date(item.updatedAt))}
      </KText>

      {/* ── Actions ── */}
      {item.kycStatus === "pending" && (
        <KRow gap="sm" style={{ marginTop: 12 }}>
          <KPressable onPress={onApprove} style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(16,185,129,0.1)" : "#ECFDF5", flex: 1 }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color="#10B981" />
            <KText variant="caption" bold style={{ color: "#10B981" }}>Approuver</KText>
          </KPressable>
          <KPressable onPress={onReject} style={[styles.actionBtn, { backgroundColor: isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2", flex: 1 }]}>
            <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
            <KText variant="caption" bold style={{ color: "#EF4444" }}>Refuser</KText>
          </KPressable>
        </KRow>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function AdminPanel() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();

  const [tab, setTab] = useState<"reports" | "disputes" | "kyc">("reports");
  const [reportFilter, setReportFilter] = useState("");
  const [disputeFilter, setDisputeFilter] = useState("");
  const [kycFilter, setKycFilter] = useState("pending");

  const isAdmin = useQuery(api.reports.isAdmin, {});
  const reportStats = useQuery(api.reports.adminGetStats, isAdmin ? {} : "skip");
  const disputeStats = useQuery(api.disputes.adminGetDisputeStats, isAdmin ? {} : "skip");
  const reports = useQuery(api.reports.adminListReports, isAdmin && tab === "reports" ? { statusFilter: reportFilter || undefined } : "skip");
  const disputes = useQuery(api.disputes.adminListDisputes, isAdmin && tab === "disputes" ? { statusFilter: disputeFilter || undefined } : "skip");
  const kycList = useQuery(api.kyc.adminListKyc, isAdmin && tab === "kyc" ? { statusFilter: kycFilter || undefined } : "skip");

  const updateReportStatus = useMutation(api.reports.adminUpdateReportStatus);
  const deactivateVehicle = useMutation(api.reports.adminDeactivateVehicle);
  const resolveDispute = useMutation(api.disputes.adminResolveDispute);
  const reviewKyc = useMutation(api.kyc.adminReviewKyc);

  const onReportAction = async (reportId: any, status: "reviewed" | "dismissed") => {
    haptic.medium();
    try {
      await updateReportStatus({ reportId, status });
      showSuccessToast(status === "reviewed" ? "Marqué comme traité" : "Signalement rejeté");
    } catch (e) { showErrorToast(e); }
  };

  const onDeactivate = (report: any) => {
    Alert.alert("Désactiver l'annonce ?", `"${report.targetLabel}" sera masquée.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Désactiver", style: "destructive",
        onPress: async () => {
          try {
            await deactivateVehicle({ vehicleId: report.targetId as any });
            await updateReportStatus({ reportId: report._id, status: "reviewed" });
            haptic.success();
            showSuccessToast("Annonce désactivée");
          } catch (e) { showErrorToast(e); }
        },
      },
    ]);
  };

  const onResolveDispute = (dispute: any, resolution: "no_penalty" | "partial" | "full") => {
    if (resolution === "partial") {
      Alert.prompt(
        "Montant à retenir",
        `Caution : ${dispute.depositAmount?.toLocaleString("fr-FR") ?? "?"} MAD\nMontant à retenir :`,
        [
          { text: "Annuler", style: "cancel" },
          {
            text: "Confirmer",
            onPress: async (value?: string) => {
              const amt = parseInt(value || "0", 10);
              if (!amt || amt <= 0) return Alert.alert("Montant invalide");
              if (amt > (dispute.depositAmount ?? 0)) return Alert.alert("Montant supérieur à la caution");
              try {
                await resolveDispute({ disputeId: dispute._id, resolution: "partial", retainedAmount: amt });
                haptic.success();
                showSuccessToast(`Retenue partielle : ${amt} MAD`);
              } catch (e) { showErrorToast(e); }
            },
          },
        ],
        "plain-text", "", "number-pad"
      );
      return;
    }

    const labels = {
      no_penalty: "Libérer la caution et fermer le litige ?",
      full: `Retenir la totalité (${dispute.depositAmount?.toLocaleString("fr-FR") ?? "?"} MAD) ?`,
    };

    Alert.alert("Confirmer", labels[resolution], [
      { text: "Annuler", style: "cancel" },
      {
        text: "Confirmer", style: resolution === "full" ? "destructive" : "default",
        onPress: async () => {
          try {
            await resolveDispute({
              disputeId: dispute._id, resolution,
              retainedAmount: resolution === "full" ? (dispute.depositAmount ?? 0) : 0,
            });
            haptic.success();
            showSuccessToast(resolution === "no_penalty" ? "Caution libérée" : "Caution retenue");
          } catch (e) { showErrorToast(e); }
        },
      },
    ]);
  };

  // ── KYC actions ──
  const onApproveKyc = (item: any) => {
    Alert.alert("Approuver ce profil ?", `${item.displayName} sera vérifié.`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Approuver", onPress: async () => {
          haptic.success();
          try {
            await reviewKyc({ profileId: item._id, decision: "verified" });
            showSuccessToast("Profil vérifié !");
          } catch (e) { showErrorToast(e); }
        },
      },
    ]);
  };

  const onRejectKyc = (item: any) => {
    Alert.prompt?.(
      "Refuser la vérification",
      "Motif du refus (visible par l'utilisateur) :",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Refuser", style: "destructive",
          onPress: async (reason?: string) => {
            haptic.error();
            try {
              await reviewKyc({ profileId: item._id, decision: "rejected", rejectionReason: reason || undefined });
              showSuccessToast("Profil refusé");
            } catch (e) { showErrorToast(e); }
          },
        },
      ],
      "plain-text",
      "Documents illisibles"
    ) ?? Alert.alert("Refuser ?", `${item.displayName}`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Refuser", style: "destructive",
        onPress: async () => {
          haptic.error();
          try {
            await reviewKyc({ profileId: item._id, decision: "rejected", rejectionReason: "Documents non conformes" });
            showSuccessToast("Profil refusé");
          } catch (e) { showErrorToast(e); }
        },
      },
    ]);
  };

  // Not admin
  if (isAdmin === false) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Ionicons name="lock-closed-outline" size={48} color={colors.textTertiary} />
        <KText variant="h3" bold style={{ marginTop: 12 }}>Accès refusé</KText>
        <KPressable onPress={() => router.back()} style={{ marginTop: 16 }}>
          <KText variant="label" color="primary">Retour</KText>
        </KPressable>
      </SafeAreaView>
    );
  }

  const pendingReports = reportStats?.reports?.pending ?? 0;
  const openDisputes = disputeStats?.open ?? 0;
  const pendingKyc = (kycList ?? []).filter((k: any) => k.kycStatus === "pending").length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <KRow gap={8} style={styles.header}>
        <KPressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <View style={{ flex: 1 }}>
          <KText variant="label" bold style={{ fontSize: 17 }}>Administration</KText>
        </View>
        <View style={styles.adminBadge}>
          <Ionicons name="shield-checkmark" size={12} color="#FFF" />
          <KText variant="caption" bold style={{ color: "#FFF", fontSize: 10 }}>ADMIN</KText>
        </View>
      </KRow>

      {/* ── Tabs ── */}
      <KRow gap={0} style={styles.tabBar}>
        <KPressable onPress={() => setTab("reports")} style={[styles.tab, tab === "reports" && styles.tabActive]}>
          <KText variant="label" bold={tab === "reports"} style={{ color: tab === "reports" ? colors.primary : colors.textTertiary, fontSize: 14 }}>
            Signalements
          </KText>
          {pendingReports > 0 && (
            <View style={styles.tabBadge}>
              <KText variant="caption" bold style={{ color: "#FFF", fontSize: 10, lineHeight: 14 }}>{pendingReports}</KText>
            </View>
          )}
        </KPressable>
        <KPressable onPress={() => setTab("disputes")} style={[styles.tab, tab === "disputes" && styles.tabActive]}>
          <KText variant="label" bold={tab === "disputes"} style={{ color: tab === "disputes" ? colors.primary : colors.textTertiary, fontSize: 14 }}>
            Litiges
          </KText>
          {openDisputes > 0 && (
            <View style={styles.tabBadge}>
              <KText variant="caption" bold style={{ color: "#FFF", fontSize: 10, lineHeight: 14 }}>{openDisputes}</KText>
            </View>
          )}
        </KPressable>
        <KPressable onPress={() => setTab("kyc")} style={[styles.tab, tab === "kyc" && styles.tabActive]}>
          <KText variant="label" bold={tab === "kyc"} style={{ color: tab === "kyc" ? colors.primary : colors.textTertiary, fontSize: 14 }}>
            KYC
          </KText>
          {pendingKyc > 0 && (
            <View style={styles.tabBadge}>
              <KText variant="caption" bold style={{ color: "#FFF", fontSize: 10, lineHeight: 14 }}>{pendingKyc}</KText>
            </View>
          )}
        </KPressable>
      </KRow>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 30 }}>
        {/* ── Stats ── */}
        {reportStats && (
          <KRow gap="sm" style={{ marginBottom: 18 }}>
            <StatCard icon="alert-circle-outline" label="Signalements" value={pendingReports} accent />
            <StatCard icon="warning-outline" label="Litiges" value={openDisputes} accent />
            <StatCard icon="people-outline" label="Utilisateurs" value={reportStats.users} />
            <StatCard icon="car-outline" label="Annonces" value={reportStats.vehicles.active} />
          </KRow>
        )}

        {/* ══ REPORTS TAB ══ */}
        {tab === "reports" && (
          <>
            <FilterChips filters={REPORT_FILTERS} active={reportFilter} onChange={setReportFilter} pendingCount={pendingReports} />
            {reports === undefined && <KVStack align="center" style={{ paddingVertical: 40 }}><KText variant="bodySmall" color="textTertiary">Chargement…</KText></KVStack>}
            {reports && reports.length === 0 && (
              <KVStack align="center" style={{ paddingVertical: 40 }}>
                <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                <KText variant="bodySmall" color="textTertiary" style={{ marginTop: 8 }}>
                  {reportFilter === "pending" ? "Aucun signalement en attente" : "Aucun signalement"}
                </KText>
              </KVStack>
            )}
            {reports?.map((report) => (
              <ReportCard key={report._id} report={report}
                onMarkReviewed={() => onReportAction(report._id, "reviewed")}
                onDismiss={() => onReportAction(report._id, "dismissed")}
                onDeactivate={() => onDeactivate(report)}
              />
            ))}
          </>
        )}

        {/* ══ DISPUTES TAB ══ */}
        {tab === "disputes" && (
          <>
            <FilterChips filters={DISPUTE_FILTERS} active={disputeFilter} onChange={setDisputeFilter} pendingCount={openDisputes} />
            {disputes === undefined && <KVStack align="center" style={{ paddingVertical: 40 }}><KText variant="bodySmall" color="textTertiary">Chargement…</KText></KVStack>}
            {disputes && disputes.length === 0 && (
              <KVStack align="center" style={{ paddingVertical: 40 }}>
                <Ionicons name="checkmark-circle" size={40} color="#10B981" />
                <KText variant="bodySmall" color="textTertiary" style={{ marginTop: 8 }}>
                  {disputeFilter === "open" ? "Aucun litige ouvert" : "Aucun litige"}
                </KText>
              </KVStack>
            )}
            {disputes?.map((dispute) => (
              <DisputeCard key={dispute._id} dispute={dispute}
                onResolve={(resolution) => onResolveDispute(dispute, resolution)}
              />
            ))}
          </>
        )}

        {/* ══ KYC TAB ══ */}
        {tab === "kyc" && (
          <>
            <FilterChips
              filters={[
                { key: "pending", label: "En attente" },
                { key: "verified", label: "Vérifié" },
                { key: "rejected", label: "Refusé" },
                { key: "", label: "Tous" },
              ]}
              active={kycFilter}
              onChange={setKycFilter}
              pendingCount={pendingKyc}
            />
            {kycList === undefined && <KVStack align="center" style={{ paddingVertical: 40 }}><KText variant="bodySmall" color="textTertiary">Chargement…</KText></KVStack>}
            {kycList && kycList.length === 0 && (
              <KVStack align="center" style={{ paddingVertical: 40 }}>
                <Ionicons name="document-outline" size={40} color={colors.textTertiary} />
                <KText variant="bodySmall" color="textTertiary" style={{ marginTop: 8 }}>
                  Aucune demande KYC
                </KText>
              </KVStack>
            )}
            {kycList?.map((item: any) => (
              <KycCard
                key={item._id}
                item={item}
                onApprove={() => onApproveKyc(item)}
                onReject={() => onRejectKyc(item)}
              />
            ))}
          </>
        )}
      </ScrollView>
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
  adminBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
    backgroundColor: "#3B82F6",
  },
  tabBar: {
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  tab: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingVertical: 12, flexDirection: "row", gap: 6,
  },
  tabActive: {
    borderBottomWidth: 2, borderBottomColor: colors.primary,
  },
  tabBadge: {
    minWidth: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center",
    backgroundColor: "#EF4444", paddingHorizontal: 5,
  },
  filterChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
  },
  card: {
    padding: 16, borderRadius: 16, marginBottom: 12,
    backgroundColor: isDark ? colors.bgTertiary : "#FAFBFC",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  typePill: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  commentBox: {
    marginTop: 8, padding: 10, borderRadius: 10,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.02)",
    borderLeftWidth: 3, borderLeftColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
  },
  partiesBox: {
    padding: 12, borderRadius: 12,
    backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
  },
  actionBtn: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
  },
}));
