import { Tabs } from "expo-router";
import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { usePushNotifications } from "../../src/presentation/hooks/usePushNotifications";
import { useTheme, haptic } from "../../src/theme";
import { KText } from "../../src/ui";

function MessagesIcon({ color }: { color: string }) {
  const { isAuthenticated } = useAuthStatus();
  const unread = useQuery(api.chat.getUnreadCount, isAuthenticated ? {} : "skip") ?? 0;

  return (
    <View style={{ width: 28, height: 28 }}>
      <Ionicons name="chatbubble-outline" size={22} color={color} />
      {unread > 0 && (
        <View style={{
          position: "absolute", top: -4, right: -8,
          minWidth: 18, height: 18, borderRadius: 9,
          backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "#FFF",
          alignItems: "center", justifyContent: "center", paddingHorizontal: 4,
        }}>
          <KText variant="caption" bold style={{ color: "#FFF", fontSize: 10, lineHeight: 13 }}>
            {unread > 99 ? "99+" : unread}
          </KText>
        </View>
      )}
    </View>
  );
}

function ProfileIcon({ color }: { color: string }) {
  const { isAuthenticated } = useAuthStatus();

  const badge = useQuery(
    api.badges.getProfileBadge,
    isAuthenticated ? {} : "skip"
  );

  const showDot = !!badge?.show;

  return (
    <View style={{ width: 28, height: 28 }}>
      <Ionicons name="person-outline" size={24} color={color} />
      {showDot && (
        <View
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            width: 9,
            height: 9,
            borderRadius: 5,
            backgroundColor: "#EF4444",
            borderWidth: 1.5,
            borderColor: "#FFF",
          }}
        />
      )}
    </View>
  );
}

export default function TabsLayout() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated } = useAuthStatus();
  usePushNotifications(isAuthenticated);

  return (
    <Tabs
      screenListeners={{ tabPress: () => haptic.light() }}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: isDark ? 0.5 : 0.5,
          paddingTop: 4,
          height: 88,
        },
        tabBarActiveTintColor: colors.tabBarActive,
        tabBarInactiveTintColor: colors.tabBarInactive,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ href: null }} />

      <Tabs.Screen
        name="home"
        options={{
          title: "Accueil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: "Explorer",
          tabBarIcon: ({ color }) => (
            <Ionicons name="search-outline" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="publish"
        options={{
          title: "Publier",
          tabBarIcon: ({ color }) => (
            <Ionicons name="add-circle-outline" size={26} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="messages"
        options={{
          title: "Messages",
          tabBarIcon: ({ color }) => <MessagesIcon color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color }) => <ProfileIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
