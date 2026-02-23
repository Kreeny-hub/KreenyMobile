import { useState } from "react";
import { Text, TextInput, View, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useVehicleSearch } from "../../src/presentation/hooks/useVehicleSearch";

export default function Search() {
  const [city, setCity] = useState("Casablanca");
  const [maxPrice, setMaxPrice] = useState("300");

  const maxPriceNumber = maxPrice.trim() ? Number(maxPrice) : undefined;

  const { vehicles, loading, error } = useVehicleSearch(
    city.trim() ? city.trim() : undefined,
    Number.isFinite(maxPriceNumber as number) ? (maxPriceNumber as number) : undefined
  );

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Search</Text>

      <View style={{ gap: 8 }}>
        <Text>Ville (Maroc)</Text>
        <TextInput
          value={city}
          onChangeText={setCity}
          style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
          placeholder="Ex: Casablanca"
        />

        <Text>Prix max (MAD/jour)</Text>
        <TextInput
          value={maxPrice}
          onChangeText={setMaxPrice}
          keyboardType="numeric"
          style={{ borderWidth: 1, padding: 10, borderRadius: 8 }}
          placeholder="Ex: 300"
        />
      </View>

      {loading && <Text>Loading...</Text>}
      {error && <Text>Error: {error}</Text>}

      {!loading &&
        !error &&
        vehicles.map((v) => (
          <Pressable
            key={v._id}
            onPress={() => router.push(`/vehicle/${v._id}`)}
            style={{ paddingVertical: 8, borderBottomWidth: 1 }}
          >
            <Text style={{ fontWeight: "600" }}>{v.title}</Text>
            <Text>
              {v.city} • {v.pricePerDay} MAD/jour
            </Text>
          </Pressable>
        ))}
    </SafeAreaView>
  );
}
