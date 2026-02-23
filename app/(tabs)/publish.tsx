import { useState } from "react";
import { Text, TextInput, Button, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { convex } from "../../src/shared/config/convex";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { ensureAuth } from "../../src/presentation/utils/ensureAuth";

export default function Publish() {
  const { isAuthenticated } = useAuthStatus();

  const [title, setTitle] = useState("Toyota Yaris");
  const [city, setCity] = useState("Casablanca");
  const [pricePerDay, setPricePerDay] = useState("250");
  const [loading, setLoading] = useState(false);

  const create = async () => {
    if (!ensureAuth(isAuthenticated)) return;

    const price = Number(pricePerDay);
    if (!title.trim() || !city.trim() || !Number.isFinite(price) || price <= 0) {
      Alert.alert("Erreur", "Vérifie le titre, la ville et le prix.");
      return;
    }

    setLoading(true);
    try {
      const res = await convex.mutation(api.vehicles.createVehicle, {
        title: title.trim(),
        city: city.trim(),
        pricePerDay: price,
      });

      Alert.alert("✅ Annonce créée", "Ton annonce est prête.");
      // Optionnel : aller voir “Mes annonces”
      router.push("/profile/listings");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur inconnue";
      // Message plus friendly pour la limite
      if (msg.includes("ListingLimitReached")) {
        Alert.alert(
          "Limite atteinte",
          "Tu peux publier jusqu’à 2 annonces avec un compte standard."
        );
        return;
      }
      Alert.alert("Erreur", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Publier</Text>

      <Text>Titre</Text>
      <TextInput
        value={title}
        onChangeText={setTitle}
        style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
      />

      <Text>Ville</Text>
      <TextInput
        value={city}
        onChangeText={setCity}
        style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
      />

      <Text>Prix / jour (MAD)</Text>
      <TextInput
        value={pricePerDay}
        onChangeText={setPricePerDay}
        keyboardType="numeric"
        style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
      />

      <Button title={loading ? "Création..." : "Créer l'annonce"} onPress={create} disabled={loading} />
    </SafeAreaView>
  );
}