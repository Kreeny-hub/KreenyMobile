import { useMemo, useState } from "react";
import { Text, View, Pressable, TextInput, Button, Image, Alert, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "convex/react";

import { api } from "../../../convex/_generated/api";
import { convex } from "../../../src/shared/config/convex";
import { uploadToConvexStorage } from "../../../src/infrastructure/convex/uploadToConvexStorage";

type Phase = "checkin" | "checkout";
type Role = "owner" | "renter";

const REQUIRED_SLOTS = [
  { key: "front", label: "Avant" },
  { key: "front_left", label: "Avant gauche" },
  { key: "front_right", label: "Avant droit" },
  { key: "back", label: "Arrière" },
  { key: "back_left", label: "Arrière gauche" },
  { key: "back_right", label: "Arrière droit" },
  { key: "interior_front", label: "Intérieur avant" },
  { key: "interior_back", label: "Intérieur arrière" },
  { key: "dashboard", label: "Tableau de bord (km/fuel/voyants)" },
] as const;

type DetailLocal = { uri: string; note: string };

export default function ConditionReportScreen() {
  // -------------------------
  // Params
  // -------------------------
  const params = useLocalSearchParams<{
    reservationId: string;
    phase?: Phase;
  }>();

  const reservationId = params.reservationId;
  const phase = (params.phase ?? "checkin") as Phase;

  // -------------------------
  // Local state (toujours déclaré, jamais après un return)
  // -------------------------
  const [requiredLocal, setRequiredLocal] = useState<Record<string, string>>({});
  const [detailLocal, setDetailLocal] = useState<DetailLocal[]>([]);
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // -------------------------
  // Queries (toujours appelées, avec "skip" si besoin)
  // -------------------------
  const role = useQuery(
    api.reservations.getMyRoleForReservation,
    reservationId ? { reservationId: reservationId as any } : "skip"
  ) as Role | undefined;

  const can = useQuery(
    api.conditionReports.canSubmitConditionReport,
    reservationId ? { reservationId: reservationId as any, phase } : "skip"
  );

  const report = useQuery(
    api.conditionReports.getConditionReportWithUrls,
    reservationId && role
      ? { reservationId: reservationId as any, phase, role }
      : "skip"
  );

  // -------------------------
  // Derived
  // -------------------------
  const title = useMemo(() => {
    const p = phase === "checkin" ? "Départ" : "Retour";
    const r = role === "owner" ? "Loueur" : role === "renter" ? "Locataire" : "...";
    return `Constat ${p} — ${r}`;
  }, [phase, role]);

  const isLocked = !!report;

  // -------------------------
  // Early UI (après avoir appelé tous les hooks)
  // -------------------------
  if (!reservationId) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>ReservationId manquant</Text>
      </SafeAreaView>
    );
  }

  if (!role || !can) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (can.reason === "InvalidStatus") {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, justifyContent: "center" }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>Constat indisponible</Text>

        <Text style={{ marginTop: 10, opacity: 0.8 }}>
          Ce constat n’est pas disponible maintenant.
        </Text>

        <Text style={{ marginTop: 10, opacity: 0.8 }}>
          Statut actuel : {can.currentStatus}
        </Text>

        <Text style={{ marginTop: 6, opacity: 0.8 }}>
          Statut attendu : {can.expectedStatus}
        </Text>
      </SafeAreaView>
    );
  }

  // -------------------------
  // Helpers camera
  // -------------------------
  const pickPhotoFromCamera = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission caméra", "Autorise la caméra pour prendre des photos.");
      return null;
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });

    if (res.canceled) return null;
    return res.assets[0]?.uri ?? null;
  };

  const pickVideoFromCamera = async (): Promise<string | null> => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission caméra", "Autorise la caméra pour filmer.");
      return null;
    }

    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      videoMaxDuration: 60,
      quality: 0.7,
    });

    if (res.canceled) return null;
    return res.assets[0]?.uri ?? null;
  };

  const setSlotPhoto = async (slotKey: string) => {
    const uri = await pickPhotoFromCamera();
    if (!uri) return;
    setRequiredLocal((prev) => ({ ...prev, [slotKey]: uri }));
  };

  const addDetailPhoto = async () => {
    if (detailLocal.length >= 6) return;
    const uri = await pickPhotoFromCamera();
    if (!uri) return;
    setDetailLocal((prev) => [...prev, { uri, note: "" }]);
  };

  const submit = async () => {
    for (const s of REQUIRED_SLOTS) {
      if (!requiredLocal[s.key]) {
        Alert.alert("Photos manquantes", `Ajoute la photo obligatoire: ${s.label}`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const requiredPhotos: Record<string, string> = {};
      for (const s of REQUIRED_SLOTS) {
        const uri = requiredLocal[s.key];
        const storageId = await uploadToConvexStorage(convex, {
          uri,
          mimeType: "image/jpeg",
          name: `${phase}_${role}_${s.key}.jpg`,
        });
        requiredPhotos[s.key] = storageId;
      }

      const detailPhotos: any[] = [];
      for (let i = 0; i < detailLocal.length; i++) {
        const d = detailLocal[i];
        const storageId = await uploadToConvexStorage(convex, {
          uri: d.uri,
          mimeType: "image/jpeg",
          name: `${phase}_${role}_detail_${i + 1}.jpg`,
        });
        detailPhotos.push({ storageId, note: d.note?.trim() ? d.note.trim() : undefined });
      }

      let video360StorageId: string | undefined = undefined;
      if (videoUri) {
        video360StorageId = await uploadToConvexStorage(convex, {
          uri: videoUri,
          mimeType: "video/mp4",
          name: `${phase}_${role}_360.mp4`,
        });
      }

      await convex.mutation(api.conditionReports.submitConditionReport, {
        reservationId: reservationId as any,
        phase,
        role,
        requiredPhotos: requiredPhotos as any,
        detailPhotos: detailPhotos as any,
        video360StorageId: video360StorageId as any,
      });

      Alert.alert("✅ Enregistré", "Les preuves sont maintenant verrouillées (consultation uniquement).");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------
  // UI SPECTATEUR
  // -------------------------
  if (isLocked) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>{title}</Text>
        <Text style={{ marginTop: 8 }}>Mode spectateur (preuves verrouillées).</Text>

        <ScrollView style={{ marginTop: 12 }}>
          <Text style={{ fontWeight: "700", marginBottom: 8 }}>Photos obligatoires</Text>
          {REQUIRED_SLOTS.map((s) => {
            const url = report?.requiredUrls?.[s.key] ?? null;
            return (
              <View key={s.key} style={{ marginBottom: 12 }}>
                <Text>{s.label}</Text>
                {url ? (
                  <Image source={{ uri: url }} style={{ width: "100%", height: 180, borderRadius: 12 }} />
                ) : (
                  <Text>Non disponible</Text>
                )}
              </View>
            );
          })}

          <Text style={{ fontWeight: "700", marginVertical: 8 }}>Photos détails</Text>
          {report?.detailUrls?.length ? (
            report.detailUrls.map((d: any, idx: number) => (
              <View key={idx} style={{ marginBottom: 12 }}>
                {d.url ? (
                  <Image source={{ uri: d.url }} style={{ width: "100%", height: 180, borderRadius: 12 }} />
                ) : (
                  <Text>Non disponible</Text>
                )}
                {!!d.note && <Text style={{ marginTop: 6 }}>📝 {d.note}</Text>}
              </View>
            ))
          ) : (
            <Text>Aucune</Text>
          )}

          <Text style={{ fontWeight: "700", marginVertical: 8 }}>Vidéo 360</Text>
          <Text>{report?.videoUrl ? "Vidéo disponible (lecture UI à faire plus tard)" : "Aucune"}</Text>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // -------------------------
  // UI CAPTURE
  // -------------------------
  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>{title}</Text>

      <Text style={{ opacity: 0.85 }}>
        ⚠️ Une fois confirmées, les preuves ne pourront plus être modifiées.
      </Text>

      <Text style={{ opacity: 0.85 }}>
        🎥 Vidéo 360 (optionnelle) : recommandée — elle aide beaucoup en cas de litige.
      </Text>

      <ScrollView>
        <Text style={{ fontWeight: "700", marginBottom: 8 }}>Photos obligatoires</Text>

        {REQUIRED_SLOTS.map((s) => {
          const uri = requiredLocal[s.key];
          return (
            <View key={s.key} style={{ marginBottom: 12 }}>
              <Text>{s.label}</Text>
              <Pressable
                onPress={() => setSlotPhoto(s.key)}
                style={{
                  marginTop: 6,
                  borderWidth: 1,
                  borderRadius: 12,
                  height: 140,
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                }}
              >
                {uri ? (
                  <Image source={{ uri }} style={{ width: "100%", height: "100%" }} />
                ) : (
                  <Text>+ Prendre photo</Text>
                )}
              </Pressable>
            </View>
          );
        })}

        <Text style={{ fontWeight: "700", marginVertical: 8 }}>Vidéo 360 (optionnelle)</Text>
        <Button
          title={videoUri ? "✅ Vidéo ajoutée (remplacer)" : "Ajouter une vidéo 360"}
          onPress={async () => {
            const uri = await pickVideoFromCamera();
            if (uri) setVideoUri(uri);
          }}
        />

        <Text style={{ fontWeight: "700", marginVertical: 8 }}>Photos détails (optionnelles)</Text>
        <Text style={{ opacity: 0.8, marginBottom: 8 }}>
          Exemple : jante rayée, impact, fissure… Ajoute un commentaire court pour décrire le défaut.
        </Text>

        {detailLocal.map((d, idx) => (
          <View key={idx} style={{ marginBottom: 12 }}>
            <Image source={{ uri: d.uri }} style={{ width: "100%", height: 180, borderRadius: 12 }} />
            <TextInput
              value={d.note}
              onChangeText={(txt) =>
                setDetailLocal((prev) =>
                  prev.map((x, i) => (i === idx ? { ...x, note: txt } : x))
                )
              }
              maxLength={80}
              placeholder="Commentaire (ex: jante avant droite rayée)"
              style={{ borderWidth: 1, padding: 10, borderRadius: 8, marginTop: 8 }}
            />
          </View>
        ))}

        {detailLocal.length < 6 && (
          <Pressable
            onPress={addDetailPhoto}
            style={{
              borderWidth: 1,
              borderRadius: 12,
              height: 80,
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 20,
            }}
          >
            <Text>+ Ajouter une photo détail</Text>
          </Pressable>
        )}

        <Button
          title={submitting ? "Envoi..." : "Confirmer et verrouiller"}
          onPress={submit}
          disabled={submitting}
        />
      </ScrollView>
    </SafeAreaView>
  );
}