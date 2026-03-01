import { Ionicons } from "@expo/vector-icons";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, Image, Keyboard, Linking, Share, TextInput, View } from "react-native";
import { useMutation, useQuery } from "convex/react";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { api } from "../../convex/_generated/api";
import { authClient } from "../../src/lib/auth-client";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { useThemePrefs, type ThemeMode } from "../../src/theme/ThemePrefsProvider";
import { spacing, radius } from "../../src/theme";

// UI Kit
import {
  KScreen,
  KText,
  KRow,
  KVStack,
  KSpacer,
  KDivider,
  KPressable,
  KSection,
  KHeader,
  KListItem,
  KBottomSheet,
  KBadge,
  createStyles,
} from "../../src/ui";

const APP_VERSION = "1.0.0";
const SUPPORT_EMAIL = "support@kreeny.ma";

// ═══════════════════════════════════════════════════════
// Editable Field (local — too specific to generalize)
// ═══════════════════════════════════════════════════════
function EditableField({ label, value, placeholder, onSave, hint, disabled, disabledReason, keyboardType, maxLength }: {
  label: string; value: string; placeholder: string; onSave: (v: string) => Promise<void>;
  hint?: string; disabled?: boolean; disabledReason?: string; keyboardType?: string; maxLength?: number;
}) {
  const { styles, colors } = useEditableStyles();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (!editing) setDraft(value || ""); }, [value]);

  const doSave = async () => {
    if (draft.trim() === (value || "").trim()) { setEditing(false); return; }
    try {
      setSaving(true);
      await onSave(draft.trim());
      setEditing(false);
      Keyboard.dismiss();
    } catch (e: any) {
      Alert.alert("Erreur", e?.data || e?.message || "Impossible de sauvegarder");
    } finally { setSaving(false); }
  };

  return (
    <View style={styles.container}>
      <KText variant="labelSmall" color="textTertiary" style={styles.label}>{label}</KText>

      {!editing ? (
        <KPressable onPress={() => {
          if (disabled) { if (disabledReason) Alert.alert("Information", disabledReason); return; }
          setEditing(true);
        }}>
          <KRow justify="space-between">
            <KText variant="label" color={value ? "text" : "textTertiary"} style={{ fontSize: 16 }}>
              {value || placeholder}
            </KText>
            {!disabled && (
              <KText variant="bodySmall" bold style={{ textDecorationLine: "underline" }}>Modifier</KText>
            )}
          </KRow>
        </KPressable>
      ) : (
        <KRow gap="sm">
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={placeholder}
            placeholderTextColor={colors.textTertiary}
            keyboardType={(keyboardType as any) || "default"}
            maxLength={maxLength || 50}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={doSave}
            style={styles.input}
          />
          <KPressable onPress={doSave} style={styles.okBtn}>
            <KText variant="labelSmall" color="textInverse">{saving ? "…" : "OK"}</KText>
          </KPressable>
          <KPressable onPress={() => { setEditing(false); setDraft(value || ""); }}>
            <Ionicons name="close-circle" size={24} color={colors.textTertiary} />
          </KPressable>
        </KRow>
      )}

      {hint && <KText variant="caption" color="textTertiary" style={{ marginTop: 6 }}>{hint}</KText>}
    </View>
  );
}

const useEditableStyles = createStyles((colors) => ({
  container: { paddingHorizontal: 20, paddingVertical: 14 },
  label: { marginBottom: 8 },
  input: {
    flex: 1, fontSize: 16, fontWeight: "600", color: colors.text,
    backgroundColor: colors.inputBg, borderRadius: radius.md,
    paddingHorizontal: 14, paddingVertical: 11,
    borderWidth: 1.5, borderColor: colors.borderFocused,
  },
  okBtn: {
    backgroundColor: colors.primary, borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 11,
  },
}));

// ═══════════════════════════════════════════════════════
// KYC Badge (local)
// ═══════════════════════════════════════════════════════
function KycBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; icon: string }> = {
    none: { label: "Non vérifié", color: "#F59E0B", bg: "rgba(245,158,11,0.1)", icon: "alert-circle-outline" },
    pending: { label: "En cours", color: "#3B82F6", bg: "rgba(59,130,246,0.1)", icon: "time-outline" },
    verified: { label: "Vérifié", color: "#10B981", bg: "rgba(16,185,129,0.1)", icon: "checkmark-circle" },
    rejected: { label: "Refusé", color: "#EF4444", bg: "rgba(239,68,68,0.1)", icon: "close-circle-outline" },
  };
  const s = map[status] || map.none;
  return (
    <KRow gap={5} style={{ backgroundColor: s.bg, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 }}>
      <Ionicons name={s.icon as any} size={14} color={s.color} />
      <KText variant="labelSmall" color={s.color}>{s.label}</KText>
    </KRow>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function SettingsScreen() {
  const { styles, colors, isDark } = useStyles();
  const { mode, setMode } = useThemePrefs();
  const { isAuthenticated, session } = useAuthStatus();
  const user = session?.data?.user;

  const profile = useQuery(api.userProfiles.getMyProfile, isAuthenticated ? {} : "skip");
  const avatarUrl = useQuery(api.userProfiles.getMyAvatarUrl, isAuthenticated ? {} : "skip");

  const updateName = useMutation(api.userProfiles.updateMyDisplayName);
  const updatePhone = useMutation(api.userProfiles.updateMyPhone);
  const setAvatar = useMutation(api.userProfiles.setMyAvatar);
  const genUploadUrl = useMutation(api.files.generateUploadUrl);

  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarSheet, setAvatarSheet] = useState(false);

  const kycStatus = profile?.kycStatus || "none";

  // Name change cooldown
  const nameChangedAt = profile?.nameChangedAt;
  const nameChangeCooldown = (() => {
    if (!nameChangedAt) return null;
    const daysSince = (Date.now() - nameChangedAt) / (1000 * 60 * 60 * 24);
    if (daysSince >= 30) return null;
    return Math.ceil(30 - daysSince);
  })();

  // Avatar picker (useRef + useEffect to avoid Modal/Picker conflict)
  const avatarSourceRef = useRef<"gallery" | "camera" | null>(null);

  const pickAvatarFrom = (source: "gallery" | "camera") => {
    avatarSourceRef.current = source;
    setAvatarSheet(false);
  };

  useEffect(() => {
    if (avatarSheet) return;
    const source = avatarSourceRef.current;
    if (!source) return;
    avatarSourceRef.current = null;

    const timer = setTimeout(async () => {
      try {
        const res = source === "gallery"
          ? await ImagePicker.launchImageLibraryAsync({ quality: 0.9 })
          : await ImagePicker.launchCameraAsync({ quality: 0.9 });
        if (res.canceled) return;

        setAvatarUploading(true);
        const asset = res.assets[0];
        const manipulated = await ImageManipulator.manipulateAsync(
          asset.uri, [{ resize: { width: 500 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        );
        const uploadUrl = await genUploadUrl();
        const blob = await (await fetch(manipulated.uri)).blob();
        const resp = await fetch(uploadUrl, { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
        const { storageId } = await resp.json();
        await setAvatar({ storageId });
      } catch (e) {
        Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
      } finally {
        setAvatarUploading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [avatarSheet]);

  // Actions
  const onLogout = () => {
    Alert.alert("Se déconnecter", "Es-tu sûr ?", [
      { text: "Annuler", style: "cancel" },
      { text: "Déconnexion", style: "destructive", onPress: async () => {
        try { await authClient.signOut(); router.replace("/(tabs)/profile"); } catch {}
      }},
    ]);
  };

  const onDeleteAccount = () => {
    Alert.alert("Supprimer mon compte", "Toutes tes données seront supprimées. Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: () => Alert.alert("Bientôt", "La suppression sera disponible prochainement.") },
    ]);
  };

  const onKyc = () => {
    if (kycStatus === "verified") return;
    router.push("/profile/kyc");
  };

  const themes: { key: ThemeMode; label: string; icon: string }[] = [
    { key: "light", label: "Clair", icon: "sunny-outline" },
    { key: "dark", label: "Sombre", icon: "moon-outline" },
    { key: "auto", label: "Système", icon: "phone-portrait-outline" },
  ];

  return (
    <KScreen scroll edges={["top"]} noPadding bottomInset={50}>
      <Stack.Screen options={{ headerShown: false }} />

      <KHeader title="Paramètres" />

      {/* ─── AVATAR HERO ─── */}
      {isAuthenticated && (
        <KVStack align="center" py="sm">
          <KPressable onPress={() => setAvatarSheet(true)}>
            <View style={styles.avatarWrap}>
              {avatarUrl ? (
                <Image source={{ uri: avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarPlaceholder]}>
                  <Ionicons name="person" size={36} color={colors.textTertiary} />
                </View>
              )}
              <View style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color="#FFF" />
              </View>
            </View>
          </KPressable>
          {avatarUploading && <KText variant="caption" color="primary" bold style={{ marginTop: 8 }}>Upload en cours…</KText>}
          <KText variant="caption" color="textTertiary" style={{ marginTop: 8 }}>Appuie pour changer ta photo</KText>
        </KVStack>
      )}

      {/* ─── INFORMATIONS PERSONNELLES ─── */}
      {isAuthenticated && (
        <KSection title="Informations personnelles">
          <EditableField
            label="NOM AFFICHÉ"
            value={profile?.displayName || user?.name || ""}
            placeholder="Ton nom ou pseudo"
            onSave={(v) => updateName({ displayName: v })}
            hint={nameChangeCooldown ? `Prochain changement possible dans ${nameChangeCooldown} jour${nameChangeCooldown > 1 ? "s" : ""}` : "Visible sur tes annonces · Modifiable tous les 30 jours"}
            disabled={nameChangeCooldown !== null}
            disabledReason={nameChangeCooldown ? `Tu pourras modifier ton nom dans ${nameChangeCooldown} jour${nameChangeCooldown > 1 ? "s" : ""}` : undefined}
          />
          <KDivider mx={20} />
          <EditableField
            label="TÉLÉPHONE"
            value={profile?.phone || ""}
            placeholder="+XX XXX XXX XXX"
            onSave={(v) => updatePhone({ phone: v })}
            hint="Utilisé pour te contacter en cas d'urgence"
            keyboardType="phone-pad"
            maxLength={20}
          />
          <KDivider mx={20} />

          {/* Email (read-only) */}
          <View style={styles.fieldContainer}>
            <KText variant="labelSmall" color="textTertiary" style={{ marginBottom: 8 }}>ADRESSE EMAIL</KText>
            <KRow justify="space-between">
              <KText variant="label" style={{ fontSize: 16 }}>{user?.email || "—"}</KText>
              <KRow gap={4} style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                <KText variant="caption" bold color="#10B981">Vérifié</KText>
              </KRow>
            </KRow>
            <KText variant="caption" color="textTertiary" style={{ marginTop: 6 }}>Contacte le support pour modifier ton email</KText>
          </View>
        </KSection>
      )}

      {/* ─── VÉRIFICATION D'IDENTITÉ ─── */}
      {isAuthenticated && (
        <KSection title="Vérification d'identité">
          <KPressable onPress={onKyc} style={styles.kycCard}>
            <KRow justify="space-between" style={{ marginBottom: 10 }}>
              <KRow gap="sm">
                <Ionicons name="shield-checkmark-outline" size={22} color={colors.text} />
                <KText variant="h3" bold>Statut KYC</KText>
              </KRow>
              <KycBadge status={kycStatus} />
            </KRow>
            <KText variant="bodySmall" color="textSecondary" style={{ lineHeight: 19 }}>
              {kycStatus === "verified"
                ? "Ton identité est vérifiée. Les utilisateurs voient un badge de confiance sur ton profil."
                : "Vérifie ton identité pour débloquer toutes les fonctionnalités."}
            </KText>
            {kycStatus !== "verified" && (
              <KRow gap={6} style={{ marginTop: 12 }}>
                <KText variant="label" style={{ textDecorationLine: "underline" }}>Lancer la vérification</KText>
                <Ionicons name="arrow-forward" size={16} color={colors.text} />
              </KRow>
            )}
          </KPressable>
        </KSection>
      )}

      {/* ─── APPARENCE ─── */}
      <KSection title="Apparence" px={20}>
        <View style={styles.themeSelector}>
          {themes.map((t) => {
            const active = mode === t.key;
            return (
              <KPressable key={t.key} onPress={() => setMode(t.key)} style={[styles.themeBtn, active && styles.themeBtnActive]}>
                <Ionicons name={t.icon as any} size={16} color={active ? colors.text : colors.textTertiary} />
                <KText variant="labelSmall" color={active ? "text" : "textTertiary"}>{t.label}</KText>
              </KPressable>
            );
          })}
        </View>
      </KSection>

      {/* ─── SUPPORT & LÉGAL ─── */}
      <KSection title="Support & légal">
        <KListItem icon="help-circle-outline" label="Centre d'aide" onPress={() => Linking.openURL("https://kreeny.ma/aide")} />
        <KDivider mx={20} />
        <KListItem icon="chatbubble-ellipses-outline" label="Contacter le support" subtitle={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=Support Kreeny v${APP_VERSION}`)} />
        <KDivider mx={20} />
        <KListItem icon="document-text-outline" label="Conditions d'utilisation" onPress={() => router.push("/legal/terms")} />
        <KDivider mx={20} />
        <KListItem icon="shield-checkmark-outline" label="Confidentialité" onPress={() => router.push("/legal/privacy")} />
      </KSection>

      {/* ─── À PROPOS ─── */}
      <KSection title="À propos">
        <KListItem icon="share-outline" label="Partager Kreeny" onPress={async () => { try { await Share.share({ message: "Découvre Kreeny — location de voitures entre particuliers au Maroc ! 🚗 https://kreeny.ma" }); } catch {} }} />
        <KDivider mx={20} />
        <KListItem icon="star-outline" label="Évaluer l'app" onPress={() => Alert.alert("Merci !", "Tu seras redirigé vers le store bientôt.")} />
        <KDivider mx={20} />
        <KListItem icon="information-circle-outline" label="Version" chevron={false} right={<KText variant="bodySmall" color="textTertiary">v{APP_VERSION}</KText>} />
      </KSection>

      {/* ─── ZONE DANGER ─── */}
      {isAuthenticated && (
        <>
          <KSpacer size="3xl" />
          <KDivider mx={20} />
          <KListItem icon="log-out-outline" label="Se déconnecter" danger onPress={onLogout} />
          <KDivider mx={20} />
          <KListItem icon="trash-outline" label="Supprimer mon compte" danger onPress={onDeleteAccount} />
        </>
      )}

      {/* Footer */}
      <KSpacer size="3xl" />
      <KText variant="caption" color="textTertiary" center>Fait avec 💙 au Maroc</KText>

      {/* ─── AVATAR BOTTOM SHEET ─── */}
      <KBottomSheet visible={avatarSheet} onClose={() => setAvatarSheet(false)} title="Photo de profil">
        <KPressable onPress={() => pickAvatarFrom("gallery")} style={styles.sheetOption}>
          <View style={styles.sheetIcon}>
            <Ionicons name="images-outline" size={22} color={colors.primary} />
          </View>
          <KVStack flex={1}>
            <KText variant="label" style={{ fontSize: 16 }}>Choisir dans la galerie</KText>
            <KText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>Sélectionne une photo existante</KText>
          </KVStack>
          <Ionicons name="chevron-forward" size={18} color={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"} />
        </KPressable>

        <KDivider indent={70} />

        <KPressable onPress={() => pickAvatarFrom("camera")} style={styles.sheetOption}>
          <View style={styles.sheetIcon}>
            <Ionicons name="camera-outline" size={22} color={colors.primary} />
          </View>
          <KVStack flex={1}>
            <KText variant="label" style={{ fontSize: 16 }}>Prendre une photo</KText>
            <KText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>Utiliser l'appareil photo</KText>
          </KVStack>
          <Ionicons name="chevron-forward" size={18} color={isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"} />
        </KPressable>

        <KPressable onPress={() => setAvatarSheet(false)} style={styles.cancelBtn}>
          <KText variant="label" color="textSecondary">Annuler</KText>
        </KPressable>
      </KBottomSheet>
    </KScreen>
  );
}

// ═══════════════════════════════════════════════════════
// STYLES (via createStyles — theme-aware)
// ═══════════════════════════════════════════════════════
const useStyles = createStyles((colors, isDark) => ({
  // Avatar
  avatarWrap: { position: "relative" as const },
  avatar: { width: 96, height: 96, borderRadius: 48, backgroundColor: colors.bgTertiary },
  avatarPlaceholder: {
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  cameraBadge: {
    position: "absolute" as const, bottom: 0, right: 0,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: colors.primary,
    alignItems: "center" as const, justifyContent: "center" as const,
    borderWidth: 3, borderColor: colors.bg,
  },

  // Fields
  fieldContainer: { paddingHorizontal: 20, paddingVertical: 14 },
  verifiedBadge: {
    backgroundColor: isDark ? "rgba(16,185,129,0.1)" : "#F0FDF4",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999,
  },

  // KYC
  kycCard: {
    marginHorizontal: 20,
    backgroundColor: isDark ? colors.bgTertiary : "#F8F9FB",
    borderRadius: radius.lg, padding: 18,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },

  // Theme selector
  themeSelector: {
    flexDirection: "row" as const, gap: 10,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    borderRadius: radius.md, padding: 4,
  },
  themeBtn: {
    flex: 1, flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
    gap: 6, paddingVertical: 12, borderRadius: 11,
  },
  themeBtnActive: {
    backgroundColor: isDark ? colors.card : "#FFF",
    ...(isDark ? {} : {
      shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4,
    }),
  },

  // Bottom sheet
  sheetOption: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 16,
    paddingVertical: 16, paddingHorizontal: 6,
  },
  sheetIcon: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  cancelBtn: {
    marginTop: 12, alignItems: "center" as const,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
  },
}));
