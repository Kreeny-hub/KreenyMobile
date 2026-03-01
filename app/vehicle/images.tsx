import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Dimensions, Image, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { KText, KVStack, KRow, KPressable, createStyles } from "../../src/ui";

const MAX_IMAGES = 6;
const { width: SCREEN_W } = Dimensions.get("window");
const GAP = 10;
const TILE = (SCREEN_W - 14 * 2 - GAP * 2) / 3;

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function ImagesSkeleton() {
  const { colors } = useSkeletonStyles();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true })])).start(); }, []);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const Box = ({ w, h, r = 10, style: s }: any) => <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, s]} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 18, paddingTop: 80 }}>
      <Box w="50%" h={22} /><Box w="35%" h={14} style={{ marginTop: 6 }} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP, marginTop: 20 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => <Box key={i} w={TILE} h={TILE} r={14} />)}
      </View>
    </View>
  );
}
const useSkeletonStyles = createStyles((colors) => ({ _: {} }));

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function VehicleImagesScreen() {
  const { styles, colors, isDark } = useStyles();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const [uploading, setUploading] = useState(false);

  const vehicle = useQuery(api.vehicles.getVehicleWithImages, vehicleId ? { id: vehicleId as any } : "skip");
  const genUrl = useMutation(api.vehicles.generateVehicleImageUploadUrl);
  const addImage = useMutation(api.vehicles.addVehicleImage);
  const removeImage = useMutation(api.vehicles.removeVehicleImage);

  if (!vehicleId) return <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}><KText color="textSecondary">Véhicule introuvable</KText></SafeAreaView>;
  if (!vehicle) return <ImagesSkeleton />;

  const imageCount = vehicle.resolvedImageUrls.length;
  const canAddMore = imageCount < MAX_IMAGES;

  const pickAndUpload = async () => {
    if (!canAddMore) { Alert.alert("Limite atteinte", `Tu peux ajouter ${MAX_IMAGES} photos maximum.`); return; }
    try {
      setUploading(true);
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.9, allowsMultipleSelection: false });
      if (res.canceled) { setUploading(false); return; }
      const asset = res.assets[0];
      const manipulated = await ImageManipulator.manipulateAsync(asset.uri, [{ resize: { width: 1200 } }], { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG });
      const mimeType = "image/jpeg";
      const u = await genUrl({ vehicleId: vehicleId as any, mimeType, byteSize: asset.fileSize ?? 0 });
      if (!u.ok) { Alert.alert("Erreur", "Impossible de générer l'URL d'upload"); return; }
      const blob = await (await fetch(manipulated.uri)).blob();
      const resp = await fetch(u.uploadUrl, { method: "POST", headers: { "Content-Type": mimeType }, body: blob });
      if (!resp.ok) { Alert.alert("Erreur", "L'upload a échoué"); return; }
      await addImage({ vehicleId: vehicleId as any, storageId: String((await resp.json()).storageId) });
    } catch (e) { Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue"); }
    finally { setUploading(false); }
  };

  const handleRemove = (storageId: string, index: number) => {
    Alert.alert("Supprimer", `Supprimer la photo ${index + 1} ?`, [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
        try { await removeImage({ vehicleId: vehicleId as any, storageId }); }
        catch (e) { Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue"); }
      }},
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      <KRow gap="sm" style={styles.header}>
        <KPressable onPress={() => router.back()} style={styles.backBtn}><Ionicons name="chevron-back" size={20} color={colors.text} /></KPressable>
        <View style={{ flex: 1 }}>
          <KText variant="label" bold style={{ fontSize: 17 }}>Photos de l'annonce</KText>
          <KText variant="caption" color="textSecondary" style={{ marginTop: 1 }}>{vehicle.title}</KText>
        </View>
        <View style={[styles.countBadge, { backgroundColor: imageCount === MAX_IMAGES ? (isDark ? "rgba(16,185,129,0.12)" : "#ECFDF5") : colors.primaryLight }]}>
          <KText variant="caption" bold style={{ color: imageCount === MAX_IMAGES ? "#10B981" : colors.primary }}>{imageCount}/{MAX_IMAGES}</KText>
        </View>
      </KRow>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 8, paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: GAP }}>
          {vehicle.resolvedImageUrls.map((url, i) => (
            <KPressable key={`${url}-${i}`} onPress={() => handleRemove(vehicle.imageUrls[i], i)}>
              <View style={styles.imageTile}>
                <Image source={{ uri: url }} style={{ width: "100%", height: "100%" }} resizeMode="cover" />
                <View style={styles.numberBadge}><KText variant="caption" bold style={{ color: "#FFF", fontSize: 10 }}>{i + 1}</KText></View>
                <View style={styles.deleteHint}><Ionicons name="trash-outline" size={12} color="#FFF" /></View>
              </View>
            </KPressable>
          ))}

          {canAddMore && !uploading && (
            <KPressable onPress={pickAndUpload} style={styles.addTile}>
              <Ionicons name="add-circle-outline" size={24} color={colors.primary} />
              <KText variant="caption" bold style={{ color: colors.primary }}>Ajouter</KText>
            </KPressable>
          )}

          {uploading && (
            <KVStack align="center" justify="center" style={styles.uploadingTile}>
              <ActivityIndicator color={colors.primary} />
              <KText variant="caption" color="textTertiary" style={{ marginTop: 6 }}>Upload…</KText>
            </KVStack>
          )}
        </View>

        {imageCount === 0 && (
          <KRow gap="sm" style={styles.tipBox}>
            <Ionicons name="bulb-outline" size={16} color={colors.primary} style={{ marginTop: 1 }} />
            <KText variant="caption" color="textSecondary" style={{ flex: 1, lineHeight: 17 }}>
              Ajoute des photos de qualité pour recevoir plus de demandes. La première photo sera la couverture de ton annonce.
            </KText>
          </KRow>
        )}

        {imageCount > 0 && imageCount < MAX_IMAGES && (
          <KRow gap={6} style={{ marginTop: 16, alignItems: "center" }}>
            <Ionicons name="information-circle-outline" size={14} color={colors.textTertiary} />
            <KText variant="caption" color="textTertiary">Appuie sur une photo pour la supprimer</KText>
          </KRow>
        )}
      </ScrollView>

      {/* Sticky done */}
      <View style={styles.stickyBar}>
        <KPressable onPress={() => router.back()} style={styles.doneBtn}>
          <Ionicons name="checkmark-circle-outline" size={18} color="#FFF" />
          <KText variant="label" bold color="textInverse" style={{ fontSize: 16 }}>Terminé</KText>
        </KPressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  header: { alignItems: "center", paddingHorizontal: 14, height: 56 },
  backBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6", alignItems: "center", justifyContent: "center" },
  countBadge: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  imageTile: { width: TILE, height: TILE, borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)" },
  numberBadge: { position: "absolute", top: 6, left: 6, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  deleteHint: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)", paddingVertical: 4, alignItems: "center" },
  addTile: { width: TILE, height: TILE, borderRadius: 14, borderWidth: 1.5, borderStyle: "dashed", borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.12)", alignItems: "center", justifyContent: "center", gap: 6 },
  uploadingTile: { width: TILE, height: TILE, borderRadius: 14, backgroundColor: isDark ? colors.bgTertiary : "#F8F9FA" },
  tipBox: { marginTop: 20, backgroundColor: isDark ? colors.bgTertiary : "#F7F7F8", borderRadius: 14, padding: 14, alignItems: "flex-start" },
  stickyBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: 14, paddingBottom: 34, paddingTop: 12, backgroundColor: colors.bg, borderTopWidth: 1, borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)" },
  doneBtn: { backgroundColor: colors.primary, borderRadius: 16, height: 54, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
}));
