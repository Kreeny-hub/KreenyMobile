import { useQuery, useMutation } from "convex/react";
import { Image, Pressable, ScrollView, Text, View, Button } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "../../convex/_generated/api";

export default function Home() {
  // ✅ Utilise useQuery pour des mises à jour temps réel + images résolues
  const vehicles = useQuery(api.vehicles.listVehiclesWithCover);
  const seedVehicles = useMutation(api.vehicles.seedVehicles);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
        <Text style={{ fontSize: 24, fontWeight: "800" }}>Découvrir</Text>

        {__DEV__ && (
          <Button title="Seed demo vehicles (DEV)" onPress={() => seedVehicles({})} />
        )}

        {!vehicles && <Text style={{ opacity: 0.5 }}>Chargement...</Text>}

        {vehicles && vehicles.length === 0 && (
          <Text style={{ opacity: 0.5 }}>Aucun véhicule disponible pour le moment.</Text>
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
            {/* ✅ Image de couverture */}
            {v.coverUrl ? (
              <Image
                source={{ uri: v.coverUrl }}
                style={{ width: "100%", height: 180, backgroundColor: "#f0f0f0" }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  width: "100%",
                  height: 120,
                  backgroundColor: "#f5f5f5",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontSize: 32, opacity: 0.15 }}>🚗</Text>
              </View>
            )}

            <View style={{ padding: 12, gap: 4 }}>
              <Text style={{ fontWeight: "700", fontSize: 16 }}>{v.title}</Text>
              <Text style={{ opacity: 0.6 }}>{v.city}</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", gap: 4, marginTop: 2 }}>
                <Text style={{ fontWeight: "800", fontSize: 17 }}>
                  {v.pricePerDay} MAD
                </Text>
                <Text style={{ opacity: 0.5, fontSize: 13 }}>/jour</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
