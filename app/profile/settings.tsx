import { router } from "expo-router";
import { Alert, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { authClient } from "../../src/lib/auth-client";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";

export default function SettingsScreen() {
  const { isLoading, isAuthenticated, session } = useAuthStatus();
  const user = session?.data?.user;

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, justifyContent: "center" }}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "700" }}>Paramètres</Text>
        <Text style={{ opacity: 0.8 }}>
          Connecte-toi pour accéder aux paramètres de ton compte.
        </Text>

        <Pressable
          onPress={() => router.push("/login")}
          style={{ padding: 14, borderWidth: 1, borderRadius: 12 }}
        >
          <Text style={{ fontWeight: "700" }}>Se connecter</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/signup")}
          style={{ padding: 14, borderWidth: 1, borderRadius: 12 }}
        >
          <Text style={{ fontWeight: "700" }}>Créer un compte</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 24, fontWeight: "700", marginBottom: 6 }}>
        Paramètres
      </Text>

      <Text style={{ marginBottom: 20, opacity: 0.8 }}>
        {user?.email ?? "Utilisateur connecté"}
      </Text>

      <View style={{ gap: 12 }}>
        <Pressable
          onPress={() => router.push("/profile/avatar")}
          style={{ padding: 14, borderWidth: 1, borderRadius: 12 }}
        >
          <Text style={{ fontWeight: "600" }}>🖼️ Changer la photo de profil</Text>
        </Pressable>

        <Pressable
          onPress={() => router.push("/profile")}
          style={{ padding: 14, borderWidth: 1, borderRadius: 12 }}
        >
          <Text style={{ fontWeight: "600" }}>👤 Retour au profil</Text>
        </Pressable>

        <Pressable
          onPress={async () => {
            try {
              await authClient.signOut();
              Alert.alert("OK", "Déconnecté");
              router.replace("/profile");
            } catch (e) {
              Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
            }
          }}
          style={{ padding: 14, borderWidth: 1, borderRadius: 12 }}
        >
          <Text style={{ fontWeight: "700" }}>Se déconnecter</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}