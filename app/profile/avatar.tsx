import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Image, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { KText, KVStack, KRow, KPressable, createStyles } from "../../src/ui";

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function AvatarSkeleton() {
  const { colors } = useSkeletonStyles();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true })])).start(); }, []);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  return (
    <KVStack align="center" style={{ flex: 1, backgroundColor: colors.bg, paddingTop: 120 }}>
      <Animated.View style={{ width: 140, height: 140, borderRadius: 70, backgroundColor: colors.skeleton, opacity }} />
      <Animated.View style={{ width: 180, height: 18, borderRadius: 9, backgroundColor: colors.skeleton, opacity, marginTop: 20 }} />
    </KVStack>
  );
}
const useSkeletonStyles = createStyles((colors) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function AvatarScreen() {
  const { styles, colors, isDark } = useStyles();
  const avatarUrl = useQuery(api.userProfiles.getMyAvatarUrl);
  const [uploading, setUploading] = useState(false);

  const ensure = useMutation(api.userProfiles.ensureMyProfile);
  const genUrl = useMutation(api.uploads.generateSensitiveUploadUrl);
  const finalize = useMutation(api.uploads.finalizeSensitiveUpload);
  const setAvatar = useMutation(api.userProfiles.setMyAvatar);

  const hasAvatar = typeof avatarUrl === "string" && avatarUrl.length > 0;

  const pickAndUpload = async () => {
    try {
      setUploading(true);
      await ensure({});
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9 });
      if (res.canceled) { setUploading(false); return; }
      const asset = res.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 512 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      const mimeType = "image/jpeg";
      const byteSize = asset.fileSize ?? 0;
      const u = await genUrl({ kind: "avatar", mimeType, byteSize });
      if (!u.ok) { Alert.alert("Erreur", u.code ?? "Impossible de générer l'URL d'upload"); return; }
      const blob = await (await fetch(manipulated.uri)).blob();
      const uploadResp = await fetch(u.uploadUrl, { method: "POST", headers: { "Content-Type": mimeType }, body: blob });
      if (!uploadResp.ok) { Alert.alert("Erreur", "L'upload a échoué"); return; }
      const { storageId } = await uploadResp.json();
      const fin = await finalize({ kind: "avatar", storageId, mimeType, byteSize });
      if (!fin.ok) { Alert.alert("Erreur", "La finalisation a échoué"); return; }
      await setAvatar({ storageId });
      Alert.alert("Photo mise à jour", "Ta photo de profil a été enregistrée.", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) { Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue"); }
    finally { setUploading(false); }
  };

  if (avatarUrl === undefined) return <AvatarSkeleton />;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <KRow gap="sm" style={styles.header}>
        <KPressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></KPressable>
        <KText variant="label" bold style={{ fontSize: 17 }}>Photo de profil</KText>
      </KRow>

      {/* Content */}
      <KVStack align="center" justify="center" style={{ flex: 1, paddingHorizontal: 32, marginTop: -40 }}>
        <View style={{ position: "relative" }}>
          <View style={[styles.avatarCircle, { borderColor: hasAvatar ? "#10B981" : (isDark ? colors.cardBorder : "rgba(0,0,0,0.08)") }]}>
            {hasAvatar ? (
              <Image source={{ uri: avatarUrl }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
            ) : (
              <KVStack align="center" justify="center" style={{ flex: 1 }}>
                <Ionicons name="person-outline" size={56} color={isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"} />
              </KVStack>
            )}
          </View>
          <View style={styles.cameraBadge}><Ionicons name="camera" size={18} color="#FFF" /></View>
        </View>

        {/* Status */}
        <KVStack align="center" gap={4} style={{ marginTop: 20 }}>
          {hasAvatar ? (
            <>
              <KRow gap={6} style={{ alignItems: "center" }}><Ionicons name="checkmark-circle" size={16} color="#10B981" /><KText variant="label" bold style={{ color: "#10B981" }}>Photo ajoutée</KText></KRow>
              <KText variant="bodySmall" color="textSecondary">Appuie ci-dessous pour la changer</KText>
            </>
          ) : (
            <>
              <KText variant="label" bold>Aucune photo</KText>
              <KText variant="bodySmall" color="textSecondary" center style={{ lineHeight: 19 }}>Ajoute une photo pour inspirer confiance aux autres utilisateurs</KText>
            </>
          )}
        </KVStack>

        {/* Actions */}
        <KVStack gap="sm" style={{ marginTop: 32, width: "100%" }}>
          <KPressable onPress={pickAndUpload} disabled={uploading} style={[styles.primaryBtn, uploading && { backgroundColor: isDark ? colors.bgTertiary : "#E5E7EB" }]}>
            {uploading ? (
              <KRow gap="sm" style={{ alignItems: "center" }}><ActivityIndicator color={colors.textSecondary} /><KText variant="label" bold color="textSecondary">Upload en cours…</KText></KRow>
            ) : (
              <KRow gap="sm" style={{ alignItems: "center" }}><Ionicons name={hasAvatar ? "swap-horizontal-outline" : "cloud-upload-outline"} size={18} color="#FFF" /><KText variant="label" bold color="textInverse" style={{ fontSize: 16 }}>{hasAvatar ? "Changer la photo" : "Choisir une photo"}</KText></KRow>
            )}
          </KPressable>
          <KPressable onPress={() => router.back()} style={{ height: 48, alignItems: "center", justifyContent: "center" }}>
            <KText variant="label" color="textSecondary">Retour</KText>
          </KPressable>
        </KVStack>
      </KVStack>

      {/* Tip */}
      <KRow gap={6} style={styles.tipBar}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.textTertiary} />
        <KText variant="caption" color="textTertiary">Ton image est stockée de manière sécurisée</KText>
      </KRow>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  header: { alignItems: "center", paddingHorizontal: 14, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", alignItems: "center", justifyContent: "center" },
  avatarCircle: { width: 160, height: 160, borderRadius: 80, overflow: "hidden", borderWidth: 3, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6" },
  cameraBadge: { position: "absolute", bottom: 4, right: 4, width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.bg },
  primaryBtn: { backgroundColor: colors.primary, borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center" },
  tipBar: { paddingHorizontal: 20, paddingBottom: 34, alignItems: "center", justifyContent: "center", backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8", borderRadius: 12, marginHorizontal: 20, paddingVertical: 10, marginBottom: 20 },
}));
