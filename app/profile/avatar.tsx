import { useMutation, useQuery } from "convex/react";
import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";
import { useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";

export default function AvatarScreen() {
  const avatarUrl = useQuery(api.userProfiles.getMyAvatarUrl);
  const [uploading, setUploading] = useState(false);

  const ensure = useMutation(api.userProfiles.ensureMyProfile);
  const genUrl = useMutation(api.uploads.generateSensitiveUploadUrl);
  const finalize = useMutation(api.uploads.finalizeSensitiveUpload);
  const setAvatar = useMutation(api.userProfiles.setMyAvatar);

  const pickAndUpload = async () => {
    try {
      setUploading(true);

      await ensure({});

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.9,
      });

      if (res.canceled) {
        setUploading(false);
        return;
      }

      const asset = res.assets[0];

      // Convertir en JPEG + resize
      const manipulated = await ImageManipulator.manipulateAsync(
        asset.uri,
        [{ resize: { width: 512 } }],
        { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
      );

      const mimeType = "image/jpeg";
      const byteSize = asset.fileSize ?? 0;

      // Générer l'URL d'upload
      const u = await genUrl({ kind: "avatar", mimeType, byteSize });
      if (!u.ok) {
        Alert.alert("Erreur", u.code ?? "Impossible de générer l'URL d'upload");
        return;
      }

      // ✅ FIX : Convertir le fichier en blob brut, puis envoyer avec Content-Type explicite
      // (FormData encapsule dans du multipart, ce qui corrompt le fichier dans Convex Storage)
      const fileResp = await fetch(manipulated.uri);
      const blob = await fileResp.blob();

      const uploadResp = await fetch(u.uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: blob,
      });

      if (!uploadResp.ok) {
        Alert.alert("Erreur", "L'upload a échoué");
        return;
      }

      const json = await uploadResp.json();
      const storageId = json.storageId;

      // Enregistrer dans userFiles
      const fin = await finalize({ kind: "avatar", storageId, mimeType, byteSize });
      if (!fin.ok) {
        Alert.alert("Erreur", "La finalisation a échoué");
        return;
      }

      // Mettre à jour le profil
      await setAvatar({ storageId });
      Alert.alert("Succès", "Ta photo de profil a été mise à jour !");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setUploading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 20, alignItems: "center" }}>
      <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 24 }}>
        Photo de profil
      </Text>

      {typeof avatarUrl === "string" && avatarUrl.length > 0 ? (
        <Image
          key={avatarUrl}
          source={{ uri: avatarUrl }}
          resizeMode="cover"
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: "#f0f0f0",
          }}
        />
      ) : (
        <View
          style={{
            width: 140,
            height: 140,
            borderRadius: 70,
            backgroundColor: "#f0f0f0",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text style={{ fontSize: 48, opacity: 0.3 }}>👤</Text>
        </View>
      )}

      <Pressable
        onPress={pickAndUpload}
        disabled={uploading}
        style={{
          marginTop: 24,
          backgroundColor: uploading ? "#ccc" : "#222",
          borderRadius: 12,
          paddingVertical: 14,
          paddingHorizontal: 28,
        }}
      >
        {uploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>
            {avatarUrl ? "Changer la photo" : "Ajouter une photo"}
          </Text>
        )}
      </Pressable>
    </SafeAreaView>
  );
}
