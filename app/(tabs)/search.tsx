import { useState } from "react";
import { Text, TextInput, View, Pressable, Image, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function Search() {
  const [city, setCity] = useState("Casablanca");
  const [maxPrice, setMaxPrice] = useState("300");

  const maxPriceNumber = maxPrice.trim() ? Number(maxPrice) : undefined;

  // ✅ Utilise useQuery avec images de couverture (temps réel)
  const vehicles = useQuery(api.vehicles.searchVehiclesWithCover, {
    city: city.trim() || undefined,
    maxPricePerDay: Number.isFinite(maxPriceNumber as number)
      ? (maxPriceNumber as number)
      : undefined,
  });

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "800" }}>Explorer</Text>

        <View style={{ gap: 8 }}>
          <Text style={{ fontWeight: "600" }}>Ville</Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              padding: 12,
              borderRadius: 10,
              fontSize: 16,
            }}
            placeholder="Ex: Casablanca"
          />

          <Text style={{ fontWeight: "600" }}>Prix max (MAD/jour)</Text>
          <TextInput
            value={maxPrice}
            onChangeText={setMaxPrice}
            keyboardType="numeric"
            style={{
              borderWidth: 1,
              borderColor: "#ddd",
              padding: 12,
              borderRadius: 10,
              fontSize: 16,
            }}
            placeholder="Ex: 300"
          />
        </View>

        {!vehicles && <Text style={{ opacity: 0.5 }}>Chargement...</Text>}

        {vehicles && vehicles.length === 0 && (
          <Text style={{ opacity: 0.5 }}>Aucun résultat pour ces critères.</Text>
        )}

        {vehicles?.map((v) => (
          <Pressable
            key={v._id}
            onPress={() => router.push(`/vehicle/${v._id}`)}
            style={{
              borderRadius: 14,
              overflow: "hidden",
              backgroundColor: "#fff",
              borderWidth: 1,
              borderColor: "#eee",
            }}
          >
            {v.coverUrl ? (
              <Image
                source={{ uri: v.coverUrl }}
                style={{ width: "100%", height: 160, backgroundColor: "#f0f0f0" }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: 100,
                  backgroundColor: "#f5f5f5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 28, opacity: 0.15 }}>🚗</Text>
              </View>
            )}

            <View style={{ padding: 12, gap: 4 }}>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>{v.title}</Text>
              <Text style={{ opacity: 0.6 }}>{v.city}</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4 }}>
                <Text style={{ fontWeight: "800", fontSize: 17 }}>{v.pricePerDay} MAD</Text>
                <Text style={{ opacity: 0.5, fontSize: 13 }}>/jour</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
