import { useQuery } from "convex/react";
import { router } from "expo-router";
import { Alert, Button, Image, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { authClient } from "../../src/lib/auth-client";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";

export default function ProfileTab() {
  const { isLoading, isAuthenticated, session } = useAuthStatus();
  const user = session?.data?.user;

  // ✅ Récupérer l'URL avatar via Convex Storage (CDN)
  const avatarUrl = useQuery(
    api.userProfiles.getMyAvatarUrl,
    isAuthenticated ? {} : "skip"
  );

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, justifyContent: "center" }}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  // -----------------------
  // MODE INVITÉ
  // -----------------------
  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Bienvenue 👋</Text>

        <Text>
          Connecte-toi pour gérer tes réservations, publier des annonces et accéder à toutes les fonctionnalités.
        </Text>

        <Button title="Se connecter" onPress={() => router.push("/login")} />
        <Button title="Créer un compte" onPress={() => router.push("/signup")} />
      </SafeAreaView>
    );
  }

  // -----------------------
  // MODE CONNECTÉ
  // -----------------------
  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      {/* ✅ Avatar + nom */}
      <Pressable
        onPress={() => router.push("/profile/avatar")}
        style={{ alignItems: "center", marginBottom: 20 }}
      >
        {avatarUrl ? (
          <Image
            source={{ uri: avatarUrl }}
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#f0f0f0",
            }}
          />
        ) : (
          <View
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: "#f0f0f0",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 32, opacity: 0.3 }}>👤</Text>
          </View>
        )}
        <Text style={{ marginTop: 8, opacity: 0.6, fontSize: 13 }}>
          Modifier la photo
        </Text>
      </Pressable>

      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 6 }}>
        Mon profil
      </Text>

      <Text style={{ marginBottom: 20, opacity: 0.8 }}>
        {user?.email ?? "Utilisateur connecté"}
      </Text>

      <View style={{ gap: 12 }}>
        <Pressable
          onPress={() => router.push("/profile/reservations")}
          style={{ padding: 14, borderWidth: 1, borderRadius: 12 }}
        >
          <Text style={{ fontWeight: "600" }}>📅 Mes réservations</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/profile/listings")}
          style={{ padding: 14, borderWidth: 1, borderRadius: 12 }}
        >
          <Text style={{ fontWeight: "600" }}>🚗 Mes annonces</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/profile/settings")}
          style={{ padding: 14, borderWidth: 1, borderRadius: 12 }}
        >
          <Text style={{ fontWeight: "600" }}>⚙️ Paramètres</Text>
        </Pressable>

        <Pressable onPress={() => router.push("/profile/dashboard")} style={{ paddingVertical: 10 }}>
          <Text style={{ fontSize: 16, fontWeight: "700" }}>Tableau de bord</Text>
        </Pressable>

        <Button
          title="Se déconnecter"
          onPress={async () => {
            try {
              await authClient.signOut();
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
            }
          }}
        />
      </View>
    </SafeAreaView>
  );
}