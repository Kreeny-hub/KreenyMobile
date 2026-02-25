import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTheme, spacing, radius, shadows } from "../../src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ═══════════════════════════════════════════════════════
// Active chips helper
// ═══════════════════════════════════════════════════════
function makeActiveChips(city: string, maxPrice: string, q: string) {
  const chips: { key: string; label: string }[] = [];
  if (q.trim()) chips.push({ key: "q", label: `"${q.trim()}"` });
  if (city.trim()) chips.push({ key: "city", label: city.trim() });
  if (maxPrice.trim()) chips.push({ key: "maxPrice", label: `≤ ${maxPrice} MAD` });
  return chips;
}

// ═══════════════════════════════════════════════════════
// Chip
// ═══════════════════════════════════════════════════════
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 999,
        backgroundColor: active ? (isDark ? colors.primaryMuted : "rgba(0,0,0,0.08)") : colors.card,
        borderWidth: 1,
        borderColor: active ? (isDark ? colors.primary : "rgba(0,0,0,0.12)") : (isDark ? colors.cardBorder : "rgba(0,0,0,0.06)"),
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: active ? "700" : "600", color: active ? colors.text : colors.textSecondary }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Search Result Card (full-width, image carousel)
// ═══════════════════════════════════════════════════════
function SearchResultCard({ vehicle, onPress }: { vehicle: any; onPress: () => void }) {
  const { colors, isDark } = useTheme();
  const [page, setPage] = useState(0);
  const cardW = SCREEN_WIDTH - 32;
  const imgH = 220;

  // Images: on a coverUrl + potentiellement imageUrls
  // Pour l'instant on utilise coverUrl comme seule image visible
  // (le backend résout seulement la cover dans searchVehiclesWithCover)
  const images = vehicle.coverUrl ? [vehicle.coverUrl] : [];

  return (
    <View
      style={{
        alignSelf: "center",
        marginBottom: 16,
        borderRadius: 20,
        overflow: "hidden",
        backgroundColor: colors.card,
        borderWidth: isDark ? 1 : 1,
        borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
      }}
    >
      {/* Image carousel */}
      <Pressable onPress={onPress}>
        {images.length > 0 ? (
          <View style={{ width: cardW, height: imgH, backgroundColor: colors.bgTertiary }}>
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              decelerationRate="fast"
              snapToInterval={cardW}
              onScroll={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / cardW);
                if (idx !== page) setPage(idx);
              }}
              scrollEventThrottle={16}
            >
              {images.map((uri: string, i: number) => (
                <Image
                  key={`${uri}-${i}`}
                  source={{ uri }}
                  style={{ width: cardW, height: imgH }}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>

            {/* Dots */}
            {images.length > 1 && (
              <View style={{
                position: "absolute", bottom: 10, left: 0, right: 0,
                flexDirection: "row", justifyContent: "center", gap: 6,
              }}>
                {images.slice(0, 6).map((_: string, i: number) => (
                  <View key={i} style={{
                    width: 6, height: 6, borderRadius: 3,
                    backgroundColor: i === page ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.55)",
                  }} />
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={{
            width: cardW, height: imgH * 0.55,
            backgroundColor: colors.bgTertiary,
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="car-outline" size={36} color={colors.textTertiary} />
          </View>
        )}
      </Pressable>

      {/* Body */}
      <View style={{ paddingHorizontal: 14, paddingVertical: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 15, fontWeight: "800", color: colors.text }}>
            {vehicle.title}
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>
            {vehicle.pricePerDay} MAD <Text style={{ fontSize: 12, fontWeight: "400", color: colors.textSecondary }}>/jour</Text>
          </Text>
        </View>

        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text numberOfLines={1} style={{ fontSize: 13, color: colors.textSecondary }}>
              {vehicle.city || "—"}
            </Text>
          </View>
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textTertiary }}>Nouveau</Text>
        </View>
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Suggestion Mini Card
// ═══════════════════════════════════════════════════════
function SuggestionMiniCard({ vehicle }: { vehicle: any }) {
  const { colors, isDark } = useTheme();

  return (
    <Pressable
      onPress={() => router.push(`/vehicle/${vehicle._id}`)}
      style={({ pressed }) => ({
        width: 160, marginRight: 12,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      {vehicle.coverUrl ? (
        <Image
          source={{ uri: vehicle.coverUrl }}
          style={{ width: "100%", height: 110, borderRadius: 14, backgroundColor: colors.bgTertiary }}
          resizeMode="cover"
        />
      ) : (
        <View style={{
          width: "100%", height: 110, borderRadius: 14,
          backgroundColor: colors.bgTertiary,
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="car-outline" size={24} color={colors.textTertiary} />
        </View>
      )}
      <Text numberOfLines={1} style={{ marginTop: 6, fontWeight: "700", fontSize: 13, color: colors.text }}>
        {vehicle.title}
      </Text>
      <Text style={{ color: colors.textSecondary, marginTop: 2, fontSize: 12 }}>
        {vehicle.pricePerDay} MAD /jour
      </Text>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Filter Modal (bottom sheet)
// ═══════════════════════════════════════════════════════
function FilterModal({
  visible,
  onClose,
  city,
  setCity,
  maxPrice,
  setMaxPrice,
  suggestedCities,
}: {
  visible: boolean;
  onClose: () => void;
  city: string;
  setCity: (v: string) => void;
  maxPrice: string;
  setMaxPrice: (v: string) => void;
  suggestedCities: string[];
}) {
  const { colors, isDark } = useTheme();

  const [localCity, setLocalCity] = useState(city);
  const [localPrice, setLocalPrice] = useState(maxPrice);

  useEffect(() => {
    if (visible) {
      setLocalCity(city);
      setLocalPrice(maxPrice);
    }
  }, [visible]);

  const apply = () => {
    setCity(localCity);
    setMaxPrice(localPrice);
    onClose();
  };

  const reset = () => {
    setLocalCity("");
    setLocalPrice("");
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" }}
      >
        <View style={{
          backgroundColor: colors.bg,
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          paddingTop: 12, maxHeight: "88%",
        }}>
          {/* Header */}
          <View style={{
            paddingHorizontal: 16, paddingBottom: 10,
            flexDirection: "row", alignItems: "center", justifyContent: "space-between",
          }}>
            <Text style={{ fontWeight: "800", fontSize: 16, color: colors.text }}>Filtres</Text>
            <Pressable
              onPress={onClose}
              style={{
                width: 34, height: 34, borderRadius: 17,
                backgroundColor: colors.card,
                borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
                alignItems: "center", justifyContent: "center",
              }}
            >
              <Ionicons name="close" size={18} color={colors.text} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 18 }}
          >
            {/* Ville */}
            <View style={{ marginTop: 12 }}>
              <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text, marginBottom: 10 }}>Ville</Text>
              <View style={{
                flexDirection: "row", alignItems: "center", gap: 10,
                backgroundColor: colors.card, borderWidth: 1,
                borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
                borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10,
              }}>
                <Ionicons name="location-outline" size={18} color={colors.textTertiary} />
                <TextInput
                  value={localCity}
                  onChangeText={setLocalCity}
                  placeholder="Toutes villes"
                  placeholderTextColor={colors.inputPlaceholder}
                  autoCapitalize="words"
                  autoCorrect={false}
                  style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.inputText }}
                />
                {localCity.length > 0 && (
                  <Pressable onPress={() => setLocalCity("")}>
                    <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                  </Pressable>
                )}
              </View>

              {/* Suggested cities chips */}
              {suggestedCities.length > 0 && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                  {suggestedCities.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setLocalCity(c)}
                      style={{
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999,
                        backgroundColor: localCity.toLowerCase() === c.toLowerCase() ? colors.primaryLight : colors.card,
                        borderWidth: 1,
                        borderColor: localCity.toLowerCase() === c.toLowerCase()
                          ? colors.primary
                          : isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
                      }}
                    >
                      <Text style={{
                        fontSize: 13, fontWeight: "600",
                        color: localCity.toLowerCase() === c.toLowerCase() ? colors.primary : colors.text,
                      }}>
                        {c}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>

            {/* Budget */}
            <View style={{ marginTop: 22 }}>
              <Text style={{ fontWeight: "700", fontSize: 14, color: colors.text, marginBottom: 10 }}>Budget / jour (MAD)</Text>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "600", color: colors.textSecondary, marginBottom: 6 }}>Max</Text>
                  <View style={{
                    flexDirection: "row", alignItems: "center",
                    backgroundColor: colors.card, borderWidth: 1,
                    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
                    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10,
                  }}>
                    <TextInput
                      value={localPrice}
                      onChangeText={(t) => setLocalPrice(t.replace(/[^\d]/g, ""))}
                      keyboardType="number-pad"
                      placeholder="Pas de limite"
                      placeholderTextColor={colors.inputPlaceholder}
                      style={{ flex: 1, fontSize: 14, fontWeight: "600", color: colors.inputText }}
                    />
                  </View>
                </View>
              </View>

              {/* Quick price chips */}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
                {["200", "350", "500", "800"].map((p) => (
                  <Pressable
                    key={p}
                    onPress={() => setLocalPrice(localPrice === p ? "" : p)}
                    style={{
                      paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999,
                      backgroundColor: localPrice === p ? colors.primaryLight : colors.card,
                      borderWidth: 1,
                      borderColor: localPrice === p ? colors.primary : isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
                    }}
                  >
                    <Text style={{
                      fontSize: 13, fontWeight: "600",
                      color: localPrice === p ? colors.primary : colors.text,
                    }}>
                      ≤ {p} MAD
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={{
            paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16,
            flexDirection: "row", gap: 10,
            borderTopWidth: 1, borderTopColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
          }}>
            <Pressable
              onPress={reset}
              style={({ pressed }) => ({
                flex: 1, height: 48, borderRadius: 16,
                backgroundColor: colors.card,
                borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
                alignItems: "center", justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontWeight: "700", color: colors.text, fontSize: 13 }}>Réinitialiser</Text>
            </Pressable>

            <Pressable
              onPress={apply}
              style={({ pressed }) => ({
                flex: 1, height: 48, borderRadius: 16,
                backgroundColor: colors.primary,
                alignItems: "center", justifyContent: "center",
                opacity: pressed ? 0.85 : 1,
              })}
            >
              <Text style={{ fontWeight: "800", color: "#FFF", fontSize: 13 }}>Appliquer</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SEARCH SCREEN
// ═══════════════════════════════════════════════════════
export default function Search() {
  const { colors, isDark } = useTheme();

  const [city, setCity] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sort, setSort] = useState<"reco" | "priceAsc" | "priceDesc">("reco");

  // Debounce city
  const [debouncedCity, setDebouncedCity] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCity(city), 400);
    return () => clearTimeout(t);
  }, [city]);

  // Query
  const maxPriceNum = maxPrice.trim() ? Number(maxPrice) : undefined;
  const vehicles = useQuery(api.vehicles.searchVehiclesWithCover, {
    city: debouncedCity.trim() || undefined,
    maxPricePerDay: Number.isFinite(maxPriceNum as number) ? maxPriceNum : undefined,
    limit: 40,
  });

  // All vehicles (for suggestions)
  const allVehicles = useQuery(api.vehicles.listVehiclesWithCover);

  // Suggested cities
  const suggestedCities = useMemo(() => {
    if (!allVehicles?.length) return [];
    const seen = new Set<string>();
    const cities: string[] = [];
    for (const v of allVehicles) {
      const c = (v.city || "").trim();
      const k = c.toLowerCase();
      if (c && !seen.has(k)) { seen.add(k); cities.push(c); }
      if (cities.length >= 8) break;
    }
    return cities;
  }, [allVehicles]);

  // Local text filter + sort
  const filtered = useMemo(() => {
    if (!vehicles) return undefined;
    let list = [...vehicles];

    // Text filter
    if (q.trim()) {
      const qq = q.trim().toLowerCase();
      list = list.filter((v) => {
        const hay = `${v.title} ${v.city}`.toLowerCase();
        return hay.includes(qq);
      });
    }

    // Sort
    if (sort === "priceAsc") list.sort((a, b) => a.pricePerDay - b.pricePerDay);
    else if (sort === "priceDesc") list.sort((a, b) => b.pricePerDay - a.pricePerDay);

    return list;
  }, [vehicles, q, sort]);

  // Suggestions (vehicles not in results)
  const suggestions = useMemo(() => {
    if (!allVehicles || !filtered) return [];
    const ids = new Set(filtered.map((v: any) => v._id));
    return allVehicles.filter((v) => !ids.has(v._id)).slice(0, 8);
  }, [allVehicles, filtered]);

  const isLoading = vehicles === undefined;
  const resultCount = filtered?.length ?? 0;

  // Active chips
  const activeChips = makeActiveChips(debouncedCity, maxPrice, q);

  const clearChip = (key: string) => {
    if (key === "q") setQ("");
    else if (key === "city") { setCity(""); setDebouncedCity(""); }
    else if (key === "maxPrice") setMaxPrice("");
  };

  const cycleSortLabel = () => {
    if (sort === "reco") return "Prix ↑";
    if (sort === "priceAsc") return "Prix ↓";
    return "Pertinence";
  };

  const cycleSort = () => {
    if (sort === "reco") setSort("priceAsc");
    else if (sort === "priceAsc") setSort("priceDesc");
    else setSort("reco");
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <FlatList
        data={filtered ?? []}
        keyExtractor={(item: any) => item._id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 24 }}
        keyboardShouldPersistTaps="handled"

        ListHeaderComponent={
          <>
            {/* Results count */}
            <View style={{ marginBottom: 8 }}>
              <Text style={{ fontSize: 22, fontWeight: "800", color: colors.text }}>Explorer</Text>
              {!isLoading && (
                <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
                  {resultCount} véhicule{resultCount > 1 ? "s" : ""} disponible{resultCount > 1 ? "s" : ""}
                </Text>
              )}
            </View>

            {/* Search input */}
            <View style={{
              flexDirection: "row", alignItems: "center", gap: 10,
              backgroundColor: colors.card, borderWidth: 1,
              borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
              borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10,
              marginBottom: 10,
            }}>
              <Ionicons name="search-outline" size={18} color={colors.primary} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Marque, modèle, mot-clé…"
                placeholderTextColor={colors.inputPlaceholder}
                style={{ flex: 1, fontWeight: "600", color: colors.inputText, fontSize: 14 }}
              />
              {q.length > 0 && (
                <Pressable onPress={() => setQ("")} style={{
                  width: 30, height: 30, borderRadius: 15,
                  backgroundColor: colors.bgTertiary,
                  alignItems: "center", justifyContent: "center",
                }}>
                  <Ionicons name="close" size={14} color={colors.text} />
                </Pressable>
              )}
            </View>

            {/* Actions row: Filtres + Tri */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8, gap: 10 }}>
              <Pressable
                onPress={() => setFiltersOpen(true)}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", gap: 8,
                  paddingHorizontal: 14, height: 40, borderRadius: 20,
                  backgroundColor: colors.card, borderWidth: 1,
                  borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Ionicons name="options-outline" size={16} color={colors.text} />
                <Text style={{ fontWeight: "600", fontSize: 14, color: colors.text }}>Filtres</Text>
                {(debouncedCity.trim() || maxPrice.trim()) && (
                  <View style={{
                    minWidth: 20, height: 20, borderRadius: 10,
                    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
                    paddingHorizontal: 5,
                  }}>
                    <Text style={{ fontWeight: "800", color: "#FFF", fontSize: 11 }}>
                      {(debouncedCity.trim() ? 1 : 0) + (maxPrice.trim() ? 1 : 0)}
                    </Text>
                  </View>
                )}
              </Pressable>

              <Pressable
                onPress={cycleSort}
                style={({ pressed }) => ({
                  flexDirection: "row", alignItems: "center", gap: 8,
                  paddingHorizontal: 14, height: 40, borderRadius: 20,
                  backgroundColor: colors.card, borderWidth: 1,
                  borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
                  opacity: pressed ? 0.85 : 1,
                })}
              >
                <Ionicons name="swap-vertical-outline" size={16} color={colors.text} />
                <Text style={{ fontWeight: "600", fontSize: 14, color: colors.text }}>{cycleSortLabel()}</Text>
              </Pressable>
            </View>

            {/* Active filter chips */}
            {activeChips.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ gap: 8, paddingBottom: 10 }}
              >
                {activeChips.map((c) => (
                  <Pressable
                    key={c.key}
                    onPress={() => clearChip(c.key)}
                    style={{
                      flexDirection: "row", alignItems: "center", gap: 6,
                      backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)",
                      borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8,
                      borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
                    }}
                  >
                    <Text style={{ fontWeight: "700", color: colors.text, fontSize: 12 }}>{c.label}</Text>
                    <Ionicons name="close" size={14} color={colors.text} />
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        }

        renderItem={({ item }: { item: any }) => (
          <SearchResultCard
            vehicle={item}
            onPress={() => router.push(`/vehicle/${item._id}`)}
          />
        )}

        ListEmptyComponent={
          isLoading ? (
            <LoadingSkeleton />
          ) : (
            <View style={{
              marginTop: 18, backgroundColor: colors.card,
              borderRadius: 18, padding: 16, gap: 6,
              borderWidth: isDark ? 1 : 0, borderColor: colors.cardBorder,
            }}>
              <Text style={{ fontWeight: "800", color: colors.text, fontSize: 14 }}>
                Aucun véhicule trouvé
              </Text>
              <Text style={{ color: colors.textSecondary, lineHeight: 18, fontSize: 13 }}>
                Essaie d'élargir tes filtres ou changer de ville.
              </Text>
              <Pressable
                onPress={() => setFiltersOpen(true)}
                style={({ pressed }) => ({
                  marginTop: 10, paddingVertical: 12, borderRadius: 14,
                  backgroundColor: colors.primary,
                  alignItems: "center", opacity: pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ fontWeight: "800", color: "#FFF", fontSize: 13 }}>Modifier les filtres</Text>
              </Pressable>
            </View>
          )
        }

        ListFooterComponent={
          suggestions.length > 0 && !isLoading ? (
            <View style={{ marginTop: 18 }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: colors.text, marginBottom: 12 }}>
                Découvrir aussi
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {suggestions.map((v: any) => (
                  <SuggestionMiniCard key={v._id} vehicle={v} />
                ))}
              </ScrollView>
            </View>
          ) : null
        }
      />

      <FilterModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        city={city}
        setCity={(c) => { setCity(c); setDebouncedCity(c); }}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        suggestedCities={suggestedCities}
      />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════════
function LoadingSkeleton() {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const Box = ({ w, h, r = 8, style }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />
  );

  return (
    <View style={{ gap: 16 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ borderRadius: 20, overflow: "hidden", backgroundColor: colors.card }}>
          <Box w="100%" h={220} r={0} />
          <View style={{ padding: 14, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Box w="60%" h={16} />
              <Box w="25%" h={16} />
            </View>
            <Box w="35%" h={14} />
          </View>
        </View>
      ))}
    </View>
  );
}
