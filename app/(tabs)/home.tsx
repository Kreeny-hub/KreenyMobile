import { Text, Button, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useVehicles } from "../../src/presentation/hooks/useVehicles";

export default function Home() {
  const { vehicles, loading, error, seed } = useVehicles();

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Home</Text>

      <Button title="Seed demo vehicles" onPress={seed} />

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
