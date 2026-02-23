import { View, Text, Pressable, FlatList } from "react-native";
import { Link, router } from "expo-router";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Messages() {
  const { isLoading, isAuthenticated } = useAuthStatus();

  const threads = useQuery(api.chat.listMyThreads, isAuthenticated ? {} : "skip");

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Loading...</Text>
      </View>
    );
  }

  if (!isAuthenticated) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 18, fontWeight: "600" }}>
          Connecte-toi pour accéder à la messagerie
        </Text>

        <Link href={{ pathname: "/login" }} style={{ fontSize: 16 }}>
          Se connecter
        </Link>

        <Link href={{ pathname: "/signup" }} style={{ fontSize: 16 }}>
          Créer un compte
        </Link>
      </View>
    );
  }

  if (!threads) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>Chargement…</Text>
      </View>
    );
  }

  if (threads.length === 0) {
    return (
      <View style={{ flex: 1, padding: 16, justifyContent: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>Messages</Text>
        <Text style={{ marginTop: 8, opacity: 0.8 }}>
          Aucun message pour l’instant.
        </Text>
      </View>
    );
  }

  return (
  <SafeAreaView style={{ flex: 1, padding: 16 }} edges={["top"]}>
    <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>Messages</Text>

    <FlatList
      data={threads}
      keyExtractor={(t) => String(t._id)}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => router.push(`/messages/${String(item._id)}`)}
          style={{
            paddingVertical: 12,
            borderBottomWidth: 1,
          }}
        >
          <Text style={{ fontWeight: "700" }}>Conversation</Text>
          <Text style={{ opacity: 0.8, marginTop: 4 }}>
            Réservation: {String(item.reservationId)}
          </Text>
        </Pressable>
      )}
    />
  </SafeAreaView>
);
}