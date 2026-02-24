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
        {data.map((item) => {
          const photoCount = item.vehicle.imageUrls?.length ?? 0;

          return (
            <View
              key={item.vehicle._id}
              style={{
                borderWidth: 1,
                borderRadius: 12,
                padding: 12,
                gap: 8,
              }}
            >
              {/* Infos véhicule — tap pour voir les réservations */}
              <Pressable
                onPress={() =>
                  router.push(`/profile/listings/${item.vehicle._id}`)
                }
              >
                <Text style={{ fontWeight: "700", fontSize: 16 }}>
                  {item.vehicle.title}
                </Text>
                <Text style={{ opacity: 0.7 }}>
                  {item.vehicle.city} — {item.vehicle.pricePerDay} MAD/jour
                </Text>

                {item.requestCount > 0 && (
                  <Text style={{ color: "red", marginTop: 4 }}>
                    🔴 {item.requestCount} demande(s) en attente
                  </Text>
                )}
              </Pressable>

              {/* ✅ Lien vers la gestion des photos */}
              <Pressable
                onPress={() =>
                  router.push(`/vehicle/images?vehicleId=${item.vehicle._id}`)
                }
                style={{
                  backgroundColor: photoCount === 0 ? "#fee" : "#f5f5f5",
                  borderRadius: 8,
                  padding: 10,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontWeight: "600" }}>
                  📷 {photoCount > 0 ? `${photoCount} photo(s)` : "Aucune photo"}
                </Text>
                <Text style={{ opacity: 0.5 }}>Gérer →</Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </SafeAreaView>
  );
}
