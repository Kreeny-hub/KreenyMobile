import { useState } from "react";
import { Alert, Button, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { authClient } from "../src/lib/auth-client";

export default function SignupScreen() {
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password123");
  const [name, setName] = useState("Ayoub");
  const [loading, setLoading] = useState(false);

  const onSignup = async () => {
    setLoading(true);
    try {
      const res = await authClient.signUp.email({
        email: email.trim(),
        password,
        name: name.trim(), // ✅ better-auth demande souvent un name
      } as any);

      if (res?.error) {
        Alert.alert("Erreur", String(res.error.message ?? "Inscription impossible"));
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
      <Text style={{ fontSize: 22, fontWeight: "700" }}>Créer un compte</Text>

      <View style={{ gap: 8 }}>
        <Text>Nom</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          style={{ borderWidth: 1, padding: 10, borderRadius: 10 }}
        />
      </View>

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

      <Button title={loading ? "Création..." : "Créer le compte"} onPress={onSignup} disabled={loading} />
      <Button title="Se connecter" onPress={() => router.push("/login")} />
    </SafeAreaView>
  );
}