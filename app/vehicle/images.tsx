import { useMutation, useQuery } from "convex/react";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";

const MAX_IMAGES = 6;

export default function VehicleImagesScreen() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const [uploading, setUploading] = useState(false);

  // ✅ Récupère le véhicule avec ses URLs d'images résolues
  const vehicle = useQuery(
    api.vehicles.getVehicleWithImages,
    vehicleId ? { id: vehicleId as any } : "skip"
  );

  const genUrl = useMutation(api.vehicles.generateVehicleImageUploadUrl);
  const addImage = useMutation(api.vehicles.addVehicleImage);
  const removeImage = useMutation(api.vehicles.removeVehicleImage);

  if (!vehicleId) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Véhicule introuvable</Text>
      </SafeAreaView>
    );
  }

  if (!vehicle) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 12 }}>Chargement...</Text>
      </SafeAreaView>
    );
  }

  const imageCount = vehicle.resolvedImageUrls.length;
  const canAddMore = imageCount < MAX_IMAGES;

  const pickAndUpload = async () => {
    if (!canAddMore) {
      Alert.alert("Limite atteinte", `Tu peux ajouter ${MAX_IMAGES} photos maximum.`);
      return;
    }

    try {
      setUploading(true);

      // 1. Ouvrir la galerie
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
        allowsMultipleSelection: false,
      });

      if (res.canceled) {
        setUploading(false);
        return;
      }

      const asset = res.assets[0];

      // 2. Convertir en JPEG + redimensionner
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 1200 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      const uploadUri = manipulated.uri;
      const mimeType = "image/jpeg";
      const byteSize = asset.fileSize ?? 0;

      // 3. Générer une URL d'upload sécurisée
      const u = await genUrl({
        vehicleId: vehicleId as any,
        mimeType,
        byteSize,
      });

      if (!u.ok) {
        Alert.alert("Erreur", "Impossible de générer l'URL d'upload");
        return;
      }

      // 4. ✅ FIX : Upload en blob brut (pas FormData, sinon Convex stocke du multipart)
      const fileResp = await fetch(manipulated.uri);
      const blob = await fileResp.blob();

      const resp = await fetch(u.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: blob,
      });
      if (!resp.ok) {
        Alert.alert("Erreur", "L'upload a échoué");
        return;
      }

      const json = await resp.json();
      const storageId = json.storageId;

      // 5. Enregistrer le storageId sur le véhicule
      await addImage({
        vehicleId: vehicleId as any,
        storageId: String(storageId),
      });

    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = (storageId: string, index: number) => {
    Alert.alert("Supprimer", `Supprimer la photo ${index + 1} ?`, [
      { text: "Annuler", style: "cancel" },
      {
        text: "Supprimer",
        style: "destructive",
        onPress: async () => {
          try {
            await removeImage({
              vehicleId: vehicleId as any,
              storageId,
            });
          } catch (e) {
            Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Text style={{ fontSize: 22, fontWeight: "800" }}>
          Photos de l'annonce
        </Text>
        <Text style={{ opacity: 0.7 }}>
          {vehicle.title} — {vehicle.city}
        </Text>
        <Text style={{ opacity: 0.6 }}>
          {imageCount}/{MAX_IMAGES} photos
        </Text>

        {/* ✅ Grille de photos */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {vehicle.resolvedImageUrls.map((url, i) => (
            <Pressable
              key={`${url}-${i}`}
              onLongPress={() => handleRemove(vehicle.imageUrls[i], i)}
              style={{ position: "relative" }}
            >
              <Image
                source={{ uri: url }}
                style={{
                  width: 160,
                  height: 120,
                  borderRadius: 10,
                  backgroundColor: "#f0f0f0",
                }}
              />
              {/* Badge numéro */}
              <View
                style={{
                  position: "absolute",
                  top: 6,
                  left: 6,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderRadius: 10,
                  paddingHorizontal: 6,
                  paddingVertical: 2,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>
                  {i + 1}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>

        {imageCount > 0 && (
          <Text style={{ opacity: 0.5, fontSize: 12 }}>
            Appui long sur une photo pour la supprimer
          </Text>
        )}

        {/* ✅ Bouton ajouter */}
        {canAddMore && (
          <Pressable
            onPress={pickAndUpload}
            disabled={uploading}
            style={{
              backgroundColor: uploading ? "#ccc" : "#222",
              borderRadius: 12,
              paddingVertical: 14,
              alignItems: "center",
            }}
          >
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
                + Ajouter une photo
              </Text>
            )}
          </Pressable>
        )}

        {/* ✅ Bouton terminer */}
        <Pressable
          onPress={() => router.back()}
          style={{
            borderWidth: 1,
            borderColor: "#222",
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ fontWeight: "700", fontSize: 16 }}>Terminé</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
