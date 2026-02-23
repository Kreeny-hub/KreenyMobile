import { Text, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "../../convex/_generated/api";

export default function MyListings() {
  const data = useQuery(api.vehicles.listMyListingsWithRequestCount, {});

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (data.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text style={{ fontSize: 20, fontWeight: "700" }}>Mes annonces</Text>
        <Text style={{ marginTop: 8 }}>Aucune annonce pour le moment.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
        Mes annonces
      </Text>

      <View style={{ gap: 10 }}>
        {data.map((item) => (
          <Pressable
            key={item.vehicle._id}
            onPress={() =>
              router.push(`/profile/listings/${item.vehicle._id}`)
            }
            style={{
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Text style={{ fontWeight: "600" }}>{item.vehicle.title}</Text>
            <Text>{item.vehicle.city}</Text>

            {item.requestCount > 0 && (
              <Text style={{ color: "red", marginTop: 6 }}>
                🔴 {item.requestCount} demande(s)
              </Text>
            )}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}