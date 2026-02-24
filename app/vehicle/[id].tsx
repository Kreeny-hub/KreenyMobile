import { Text, Button, View, ScrollView, Image, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { ensureAuth } from "../../src/presentation/utils/ensureAuth";
import { useState, useRef } from "react";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const IMAGE_HEIGHT = 240;

export default function VehicleDetails() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [currentImage, setCurrentImage] = useState(0);

  if (!id) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Véhicule introuvable</Text>
      </SafeAreaView>
    );
  }

  // ✅ Utilise la nouvelle query avec URLs d'images résolues
  const vehicle = useQuery(api.vehicles.getVehicleWithImages, { id: id as any });
  const { isAuthenticated } = useAuthStatus();

  if (vehicle === undefined) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Chargement...</Text>
      </SafeAreaView>
    );
  }

  if (vehicle === null) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Véhicule introuvable</Text>
      </SafeAreaView>
    );
  }

  const images = vehicle.resolvedImageUrls;
  const hasImages = images.length > 0;

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView>
        {/* ✅ Carrousel d'images */}
        {hasImages ? (
          <View>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(
                  e.nativeEvent.contentOffset.x / SCREEN_WIDTH
                );
                setCurrentImage(index);
              }}
            >
              {images.map((url, i) => (
                <Image
                  key={`${url}-${i}`}
                  source={{ uri: url }}
                  style={{
                    width: SCREEN_WIDTH,
                    height: IMAGE_HEIGHT,
                    backgroundColor: "#f0f0f0",
                  }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
            {/* Indicateur de page */}
            {images.length > 1 && (
              <View
                style={{
                  position: "absolute",
                  bottom: 10,
                  right: 16,
                  backgroundColor: "rgba(0,0,0,0.6)",
                  borderRadius: 10,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                }}
              >
                <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>
                  {currentImage + 1}/{images.length}
                </Text>
              </View>
            )}
          </View>
        ) : (
          <View
            style={{
              width: SCREEN_WIDTH,
              height: IMAGE_HEIGHT,
              backgroundColor: "#f0f0f0",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 40, opacity: 0.2 }}>🚗</Text>
            <Text style={{ opacity: 0.4, marginTop: 4 }}>Pas de photos</Text>
          </View>
        )}

        {/* ✅ Infos véhicule */}
        <View style={{ padding: 16, gap: 12 }}>
          <Text style={{ fontSize: 24, fontWeight: "800" }}>{vehicle.title}</Text>
          <Text style={{ fontSize: 16, opacity: 0.7 }}>{vehicle.city}</Text>

          <View
            style={{
              flexDirection: "row",
              alignItems: "baseline",
              gap: 4,
              marginTop: 4,
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "800" }}>
              {vehicle.pricePerDay} MAD
            </Text>
            <Text style={{ opacity: 0.6 }}>/jour</Text>
          </View>

          {/* ✅ Caution info */}
          {vehicle.depositSelected && (
            <View
              style={{
                backgroundColor: "#f8f8f8",
                borderRadius: 10,
                padding: 12,
                marginTop: 4,
              }}
            >
              <Text style={{ fontWeight: "600" }}>Caution (empreinte)</Text>
              <Text style={{ opacity: 0.7, marginTop: 4 }}>
                {vehicle.depositSelected} MAD — non débitée, libérée après la location
              </Text>
            </View>
          )}

          <Button
            title="Réserver ce véhicule"
            onPress={() => {
              if (!ensureAuth(isAuthenticated)) return;
              router.push(`/reservation/${id}`);
            }}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
