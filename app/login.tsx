import { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { authClient } from "../src/lib/auth-client";

export default function LoginScreen() {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password123");
  const [loading, setLoading] = useState(false);

  const onLogin = async () => {
    setLoading(true);
    try {
      const res = await authClient.signIn.email({
        email: email.trim(),
        password,
      });

      if (res?.error) {
        Alert.alert("Erreur", String(res.error.message ?? "Connexion impossible"));
        return;
      }

      router.replace("/(tabs)/profile");
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, justifyContent: "center", gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Connexion</Text>

      <View style={{ gap: 8 }}>
        <Text>Email</Text>
        <TextInput
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
          style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
        />
      </View>

      <View style={{ gap: 8 }}>
        <Text>Mot de passe</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
        />
      </View>

      <Button title={loading ? "Connexion..." : "Se connecter"} onPress={onLogin} disabled={loading} />
      <Button title="Créer un compte" onPress={() => router.push("/signup")} />
    </SafeAreaView>
  );
}