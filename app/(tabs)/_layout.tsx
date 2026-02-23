import { Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";

function ProfileIcon({ focused }: { focused: boolean }) {
  const { isAuthenticated } = useAuthStatus();

  const badge = useQuery(
    api.badges.getProfileBadge,
    isAuthenticated ? {} : "skip"
  );

  const showDot = !!badge?.show;

  return (
    <View style={{ width: 28, height: 28 }}>
      <Ionicons name={focused ? "person" : "person-outline"} size={26} />
      {showDot && (
        <View
          style={{
            position: "absolute",
            top: 1,
            right: 1,
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: "red",
          }}
        />
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ href: null }} />
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={26} />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: "Explorer",
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? "search" : "search-outline"} size={26} />
          ),
        }}
      />

      <Tabs.Screen
        name="publish"
        options={{
          title: "Publier",
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? "add-circle" : "add-circle-outline"} size={28} />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ focused }) => (
            <Ionicons name={focused ? "chatbubble" : "chatbubble-outline"} size={26} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ focused }) => <ProfileIcon focused={focused} />,
        }}
      />
    </Tabs>
  );
}