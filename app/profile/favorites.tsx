import { FlatList, View } from "react-native";
import { router, Stack } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { KText, KVStack, KRow, KPressable, VehicleCardLarge, createStyles } from "../../src/ui";

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function FavoritesScreen() {
  const { styles: s, colors, isDark } = useStyles();
  const favorites = useQuery(api.favorites.listMy);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <KRow gap={8} style={s.header}>
        <KPressable onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <View style={{ flex: 1 }}>
          <KText variant="label" bold style={{ fontSize: 17 }}>Mes favoris</KText>
          {favorites && favorites.length > 0 && (
            <KText variant="caption" color="textSecondary" style={{ marginTop: 2 }}>
              {favorites.length} véhicule{favorites.length > 1 ? "s" : ""}
            </KText>
          )}
        </View>
      </KRow>

      <FlatList
        data={favorites ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 40, gap: 16, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          favorites !== undefined ? (
            <KVStack align="center" style={{ paddingTop: 64, gap: 16 }}>
              <View style={s.emptyIcon}>
                <Ionicons name="heart-outline" size={24} color={colors.textTertiary} />
              </View>
              <KText variant="label" bold center>Aucun favori</KText>
              <KText variant="bodySmall" color="textSecondary" center style={{ maxWidth: 240, lineHeight: 20 }}>
                Tape sur le cœur d'une annonce pour la retrouver ici.
              </KText>
              <KPressable onPress={() => router.push("/(tabs)/search")} style={s.primaryBtn}>
                <KText variant="label" bold style={{ color: "#FFF" }}>Explorer les véhicules</KText>
              </KPressable>
            </KVStack>
          ) : null
        }
        ListFooterComponent={
          favorites && favorites.length > 0 ? (
            <KPressable onPress={() => router.push("/(tabs)/search")} style={s.ghostBtn}>
              <Ionicons name="compass-outline" size={16} color={colors.primary} />
              <KText variant="label" bold style={{ color: colors.primary }}>Explorer plus de véhicules</KText>
            </KPressable>
          ) : null
        }
        renderItem={({ item }) => (
          <VehicleCardLarge
            vehicleId={item.vehicleId}
            coverUrl={item.coverUrl}
            title={item.title}
            city={item.city}
            pricePerDay={item.pricePerDay}
            reviewAverage={item.reviewAverage}
            reviewCount={item.reviewCount}
            onPress={() => router.push(`/vehicle/${item.vehicleId}`)}
          />
        )}
      />
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  header: { alignItems: "center", paddingHorizontal: 16, height: 56 },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  emptyIcon: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center", justifyContent: "center",
  },
  primaryBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 13,
    borderRadius: 14, marginTop: 8,
  },
  ghostBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, marginTop: 8, borderRadius: 14,
    backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "#EBF0FF",
  },
}));
