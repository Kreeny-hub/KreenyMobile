import { Text, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { api } from "../../convex/_generated/api";

function Card({
  title,
  subtitle,
  onPress,
}: {
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderRadius: 14,
        padding: 14,
        gap: 6,
      }}
    >
      <Text style={{ fontSize: 16, fontWeight: "700" }}>{title}</Text>
      <Text style={{ opacity: 0.8 }}>{subtitle}</Text>
    </Pressable>
  );
}

export default function DashboardScreen() {
  const data = useQuery(api.dashboard.getOwnerDashboard, {});

  if (!data) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  const c = data.counts;

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Tableau de bord</Text>
      <Text style={{ opacity: 0.7 }}>
        Standard : actions essentielles (stats avancées disponibles en Pro).
      </Text>

      <View style={{ gap: 10, marginTop: 8 }}>
        <Card
          title={`Demandes reçues (${c.requested})`}
          subtitle="Voir et répondre aux nouvelles demandes"
          onPress={() => router.push("/profile/listings")}
        />

        <Card
          title={`Actions urgentes (${c.pickupPending + c.dropoffPending})`}
          subtitle="Constats départ/retour à compléter"
          onPress={() => router.push("/profile/listings")}
        />

        <Card
          title={`Réservations en cours (${c.inProgress})`}
          subtitle="Suivre les locations actuellement actives"
          onPress={() => router.push("/profile/listings")}
        />
      </View>
    </SafeAreaView>
  );
}