import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { haptic, shadows, skeletonPulse, pulseOpacity } from "../../src/theme";
import { KFavoriteButton } from "../../src/components/KFavoriteButton";

import {
  KText,
  KRow,
  KVStack,
  KPressable,
  KImage,
  createStyles,
} from "../../src/ui";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ═══════════════════════════════════════════════════════
// Constants & helpers
// ═══════════════════════════════════════════════════════
const TRANSMISSION_LABELS: Record<string, string> = { auto: "Auto", manual: "Manuelle" };
const FUEL_LABELS: Record<string, string> = { essence: "Essence", diesel: "Diesel", hybrid: "Hybride", electric: "Électrique" };

function formatDateChip(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  const months = ["janv","fév","mars","avr","mai","juin","juil","août","sept","oct","nov","déc"];
  return `${d} ${months[(m || 1) - 1]}`;
}

const CATEGORIES = [
  { key: "suv", label: "SUV" },
  { key: "berline", label: "Berline" },
  { key: "sport", label: "Sport" },
  { key: "electric", label: "Électrique" },
  { key: "premium", label: "Premium" },
  { key: "utilitaire", label: "Utilitaire" },
] as const;

type Filters = {
  q: string; city: string; minPrice: string; maxPrice: string;
  transmission: string; fuel: string; minSeats: string;
};

function makeActiveChips(f: Filters) {
  const chips: { key: string; label: string }[] = [];
  if (f.q.trim()) chips.push({ key: "q", label: `"${f.q.trim()}"` });
  if (f.city.trim()) chips.push({ key: "city", label: f.city.trim() });
  if (f.minPrice && f.maxPrice) chips.push({ key: "price", label: `${f.minPrice}–${f.maxPrice} MAD` });
  else if (f.maxPrice) chips.push({ key: "maxPrice", label: `≤ ${f.maxPrice} MAD` });
  else if (f.minPrice) chips.push({ key: "minPrice", label: `≥ ${f.minPrice} MAD` });
  if (f.transmission) chips.push({ key: "transmission", label: TRANSMISSION_LABELS[f.transmission] ?? f.transmission });
  if (f.fuel) chips.push({ key: "fuel", label: FUEL_LABELS[f.fuel] ?? f.fuel });
  if (f.minSeats) chips.push({ key: "minSeats", label: `${f.minSeats}+ places` });
  return chips;
}



// ═══════════════════════════════════════════════════════
// Search Result Card — Conversion-optimized
// ═══════════════════════════════════════════════════════
function SearchResultCard({ vehicle, onPress }: { vehicle: any; onPress: () => void }) {
  const { styles, colors } = useResultCardStyles();
  const cardW = SCREEN_WIDTH - 32;
  const imgH = 200;
  const [activeImg, setActiveImg] = useState(0);

  const isNew = !vehicle.reviewCount || vehicle.reviewCount === 0;
  const hasReviews = vehicle.reviewCount > 0;
  const images: string[] = vehicle.allImageUrls?.length > 0
    ? vehicle.allImageUrls : vehicle.coverUrl ? [vehicle.coverUrl] : [];

  // Urgency signal — simulated based on data
  const urgencyText = hasReviews && vehicle.reviewCount >= 3
    ? "Très demandé" : hasReviews ? "Populaire" : null;

  return (
    <View style={styles.card}>
      {/* Image carousel — FlatList for reliable nested scroll */}
      <View style={styles.imageWrap}>
        {images.length > 0 ? (
          <>
            <FlatList
              data={images}
              keyExtractor={(_, i) => String(i)}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled
              bounces={false}
              onMomentumScrollEnd={(e) => {
                const idx = Math.round(e.nativeEvent.contentOffset.x / cardW);
                if (idx !== activeImg) haptic.light();
                setActiveImg(idx);
              }}
              scrollEventThrottle={16}
              renderItem={({ item: url }) => (
                <KPressable onPress={onPress} activeOpacity={0.95}>
                  <KImage source={{ uri: url }}
                    style={[styles.cardImage, { width: cardW, height: imgH }]} />
                </KPressable>
              )}
            />
            {/* Pagination: dots if ≤5 images, counter if more */}
            {images.length > 1 && (
              images.length <= 5 ? (
                <View style={styles.dotsRow} pointerEvents="none">
                  {images.map((_, i) => (
                    <View key={i}
                      style={[styles.dot, i === activeImg && styles.dotActive]} />
                  ))}
                </View>
              ) : (
                <View style={styles.imgCounter} pointerEvents="none">
                  <KText variant="caption" bold style={styles.imgCounterText}>
                    {activeImg + 1}/{images.length}
                  </KText>
                </View>
              )
            )}
          </>
        ) : (
          <KPressable onPress={onPress} activeOpacity={0.95}>
            <KVStack align="center" justify="center" style={[styles.noImage, { width: cardW, height: imgH * 0.6 }]}>
              <Ionicons name="car-outline" size={36} color={colors.textTertiary} />
            </KVStack>
          </KPressable>
        )}
        {/* Heart */}
        <View style={styles.cardHeart}>
          <KFavoriteButton vehicleId={vehicle._id} size={18} variant="overlay" />
        </View>
        {/* Top-left badge: urgency or new */}
        {urgencyText ? (
          <View style={styles.urgencyBadge} pointerEvents="none">
            <Ionicons name="flame" size={11} color="#FF6B35" />
            <KText variant="caption" bold style={styles.urgencyText}>{urgencyText}</KText>
          </View>
        ) : isNew ? (
          <View style={styles.newBadge} pointerEvents="none">
            <KText variant="caption" bold style={styles.newBadgeText}>Nouveau</KText>
          </View>
        ) : null}
      </View>

      {/* Info — tappable */}
      <KPressable onPress={onPress} activeOpacity={0.97} style={styles.cardBody}>
        {/* Row 1: Title + Rating */}
        <KRow justify="space-between" align="flex-start">
          <View style={styles.titleWrap}>
            <KText variant="h3" bold numberOfLines={1}>{vehicle.title}</KText>
            <KRow gap={4} align="center" style={styles.locationRow}>
              <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
              <KText variant="bodySmall" color="textSecondary">{vehicle.city || "—"}</KText>
            </KRow>
          </View>
          {hasReviews ? (
            <View style={styles.ratingPill}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <KText variant="labelSmall" bold>{vehicle.reviewAverage}</KText>
              <KText variant="caption" color="textTertiary">({vehicle.reviewCount})</KText>
            </View>
          ) : null}
        </KRow>

        {/* Row 2: Feature badges — scannable */}
        <KRow gap={6} wrap style={styles.featureRow}>
          {vehicle.year ? (
            <View style={styles.featureBadge}>
              <KText variant="caption" style={styles.featureText}>{vehicle.year}</KText>
            </View>
          ) : null}
          {vehicle.transmission === "auto" ? (
            <View style={styles.featureBadge}>
              <KText variant="caption" style={styles.featureText}>Auto</KText>
            </View>
          ) : vehicle.transmission === "manual" ? (
            <View style={styles.featureBadge}>
              <KText variant="caption" style={styles.featureText}>Manuelle</KText>
            </View>
          ) : null}
          {vehicle.fuel ? (
            <View style={styles.featureBadge}>
              <KText variant="caption" style={styles.featureText}>{FUEL_LABELS[vehicle.fuel] ?? vehicle.fuel}</KText>
            </View>
          ) : null}
          {vehicle.seats ? (
            <View style={styles.featureBadge}>
              <KText variant="caption" style={styles.featureText}>{vehicle.seats} pl.</KText>
            </View>
          ) : null}
        </KRow>

        {/* Row 3: Divider */}
        <View style={styles.divider} />

        {/* Row 4: Trust + DOMINANT Price + CTA arrow */}
        <KRow justify="space-between" align="center">
          <KRow gap={5} align="center">
            <Ionicons name="shield-checkmark" size={14} color={colors.primary} />
            <KText variant="caption" color="primary">Vérifié</KText>
          </KRow>
          <KRow gap={6} align="center">
            <KRow gap={2} align="baseline">
              <KText variant="price" bold style={styles.priceMain}>{vehicle.pricePerDay}</KText>
              <KText variant="bodySmall" color="textSecondary">MAD/j</KText>
            </KRow>
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          </KRow>
        </KRow>
      </KPressable>
    </View>
  );
}
const useResultCardStyles = createStyles((colors, isDark) => ({
  card: {
    marginHorizontal: 16, marginBottom: 16, borderRadius: 16, overflow: "hidden",
    backgroundColor: colors.card,
    borderWidth: isDark ? 1 : 0,
    borderColor: isDark ? colors.cardBorder : "transparent",
    // Subtle shadow instead of border (light mode)
    shadowColor: "#000",
    shadowOpacity: isDark ? 0 : 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: isDark ? 0 : 3,
  },
  imageWrap: { position: "relative" },
  cardImage: { backgroundColor: colors.bgTertiary },
  noImage: { backgroundColor: colors.bgTertiary },
  cardHeart: { position: "absolute", top: 10, right: 10 },
  dotsRow: {
    position: "absolute", bottom: 10,
    left: 0, right: 0,
    flexDirection: "row", justifyContent: "center",
    gap: 5,
  },
  dot: {
    width: 6, height: 6, borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  dotActive: {
    backgroundColor: "#FFF",
    width: 7, height: 7, borderRadius: 3.5,
  },
  imgCounter: {
    position: "absolute", bottom: 10, right: 10,
    backgroundColor: "rgba(0,0,0,0.6)", borderRadius: 10,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  imgCounterText: { color: "#FFF", fontSize: 11 },
  urgencyBadge: {
    position: "absolute", top: 10, left: 10,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(0,0,0,0.75)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  urgencyText: { color: "#FF6B35", fontSize: 11 },
  newBadge: {
    position: "absolute", top: 10, left: 10,
    backgroundColor: "rgba(0,0,0,0.7)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  newBadgeText: { color: "#FFF", fontSize: 11 },
  cardBody: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 14 },
  titleWrap: { flex: 1, marginRight: 10 },
  locationRow: { marginTop: 2 },
  ratingPill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)",
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8,
  },
  featureRow: { marginTop: 10 },
  featureBadge: {
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
    backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.03)",
  },
  featureText: { color: colors.textSecondary, fontSize: 11 },
  divider: {
    height: 1, marginVertical: 10,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  priceMain: { color: colors.text },
}));

// ═══════════════════════════════════════════════════════
// Suggestion Card — Airbnb-style horizontal
// ═══════════════════════════════════════════════════════
function SuggestionMiniCard({ vehicle }: { vehicle: any }) {
  const { styles, colors } = useSuggestionStyles();
  return (
    <KPressable onPress={() => router.push(`/vehicle/${vehicle._id}`)} activeOpacity={0.9} style={styles.miniCard}>
      <View style={styles.imgWrap}>
        {vehicle.coverUrl ? (
          <KImage source={{ uri: vehicle.coverUrl }} style={styles.img} />
        ) : (
          <KVStack align="center" justify="center" style={styles.noImg}>
            <Ionicons name="car-outline" size={24} color={colors.textTertiary} />
          </KVStack>
        )}
        <View style={styles.miniHeart}>
          <KFavoriteButton vehicleId={vehicle._id} size={14} variant="overlay" />
        </View>
      </View>
      <KText variant="labelSmall" bold numberOfLines={1} style={styles.miniTitle}>{vehicle.title}</KText>
      <KRow gap={4} align="center">
        <Ionicons name="location-outline" size={10} color={colors.textTertiary} />
        <KText variant="caption" color="textTertiary" numberOfLines={1}>{vehicle.city || "—"}</KText>
      </KRow>
      <KText variant="labelSmall" bold style={styles.miniPrice}>{vehicle.pricePerDay} MAD<KText variant="caption" color="textSecondary"> /jour</KText></KText>
    </KPressable>
  );
}
const useSuggestionStyles = createStyles((colors, isDark) => ({
  miniCard: { width: 180, marginRight: 12 },
  imgWrap: { position: "relative" },
  img: { width: "100%", height: 120, borderRadius: 14, backgroundColor: colors.bgTertiary },
  noImg: { width: "100%", height: 120, borderRadius: 14, backgroundColor: colors.bgTertiary },
  miniHeart: { position: "absolute", top: 6, right: 6 },
  miniTitle: { marginTop: 8 },
  miniPrice: { marginTop: 4 },
}));

// ═══════════════════════════════════════════════════════
// Filter Modal
// ═══════════════════════════════════════════════════════
function FilterModal({
  visible, onClose, filters, setFilters, suggestedCities,
}: {
  visible: boolean; onClose: () => void;
  filters: Filters; setFilters: (f: Filters) => void;
  suggestedCities: string[];
}) {
  const { styles, colors, isDark } = useFilterStyles();
  const [local, setLocal] = useState<Filters>(filters);
  const [moreOpen, setMoreOpen] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setLocal(filters);
      // Open "more" if any advanced filter is active
      const hasAdvanced = !!(filters.transmission || filters.fuel || filters.minSeats);
      setMoreOpen(hasAdvanced);
      expandAnim.setValue(hasAdvanced ? 1 : 0);
    }
  }, [visible]);

  const set = (key: keyof Filters, val: string) => setLocal((prev) => ({ ...prev, [key]: val }));
  const toggle = (key: keyof Filters, val: string) =>
    setLocal((prev) => ({ ...prev, [key]: prev[key] === val ? "" : val }));

  const toggleMore = () => {
    const opening = !moreOpen;
    setMoreOpen(opening);
    Animated.timing(expandAnim, {
      toValue: opening ? 1 : 0, duration: 280,
      useNativeDriver: false,
    }).start();
  };

  const apply = () => { setFilters(local); onClose(); };
  const reset = () => {
    setLocal({ q: filters.q, city: "", minPrice: "", maxPrice: "", transmission: "", fuel: "", minSeats: "" });
    setMoreOpen(false);
    expandAnim.setValue(0);
  };

  const advancedCount = [local.transmission, local.fuel, local.minSeats].filter(Boolean).length;
  const totalCount = [local.city, local.minPrice, local.maxPrice, local.transmission, local.fuel, local.minSeats].filter(Boolean).length;

  // Animated height for advanced section
  const moreHeight = expandAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 260] });
  const moreOpacity = expandAnim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0, 1] });

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.backdrop}
      >
        <View style={styles.sheet}>
          {/* Header */}
          <KRow px="lg" style={styles.sheetHeader} justify="space-between">
            <KText variant="h3" bold>Filtres</KText>
            <KPressable onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={colors.text} />
            </KPressable>
          </KRow>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.sheetContent}>

            {/* ── Ville ── */}
            <KText variant="label" bold style={styles.filterLabel}>Ville</KText>
            <KRow gap="sm" style={styles.filterInput}>
              <Ionicons name="location-outline" size={18} color={colors.textTertiary} />
              <TextInput
                value={local.city} onChangeText={(v) => set("city", v)}
                placeholder="Toutes villes" placeholderTextColor={colors.inputPlaceholder}
                autoCapitalize="words" autoCorrect={false}
                style={styles.inputText}
              />
              {local.city.length > 0 && (
                <KPressable onPress={() => set("city", "")}>
                  <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
                </KPressable>
              )}
            </KRow>
            {suggestedCities.length > 0 && (
              <KRow gap="sm" wrap style={styles.chipRow}>
                {suggestedCities.map((c) => {
                  const active = local.city.toLowerCase() === c.toLowerCase();
                  return (
                    <KPressable key={c} onPress={() => set("city", active ? "" : c)} style={[
                      styles.chip, active && styles.chipActive,
                    ]}>
                      <KText variant="labelSmall" color={active ? "primary" : "text"}>{c}</KText>
                    </KPressable>
                  );
                })}
              </KRow>
            )}

            {/* ── Budget ── */}
            <KText variant="label" bold style={styles.filterLabel}>Budget / jour (MAD)</KText>
            <KRow gap={10}>
              <KRow style={[styles.filterInput, styles.halfInput]}>
                <TextInput
                  value={local.minPrice} onChangeText={(t) => set("minPrice", t.replace(/[^\d]/g, ""))}
                  keyboardType="number-pad" placeholder="Min"
                  placeholderTextColor={colors.inputPlaceholder}
                  style={styles.inputText}
                />
              </KRow>
              <KText variant="bodySmall" color="textTertiary" style={styles.priceDash}>—</KText>
              <KRow style={[styles.filterInput, styles.halfInput]}>
                <TextInput
                  value={local.maxPrice} onChangeText={(t) => set("maxPrice", t.replace(/[^\d]/g, ""))}
                  keyboardType="number-pad" placeholder="Max"
                  placeholderTextColor={colors.inputPlaceholder}
                  style={styles.inputText}
                />
              </KRow>
            </KRow>
            <KRow gap="sm" wrap style={styles.chipRow}>
              {[
                { label: "≤ 200", min: "", max: "200" },
                { label: "200–500", min: "200", max: "500" },
                { label: "500–800", min: "500", max: "800" },
                { label: "800+", min: "800", max: "" },
              ].map((p) => {
                const active = local.minPrice === p.min && local.maxPrice === p.max;
                return (
                  <KPressable key={p.label} onPress={() => {
                    if (active) setLocal((prev) => ({ ...prev, minPrice: "", maxPrice: "" }));
                    else setLocal((prev) => ({ ...prev, minPrice: p.min, maxPrice: p.max }));
                  }} style={[styles.chip, active && styles.chipActive]}>
                    <KText variant="labelSmall" color={active ? "primary" : "text"}>{p.label} MAD</KText>
                  </KPressable>
                );
              })}
            </KRow>

            {/* ── Plus de filtres (collapsible) ── */}
            <KPressable onPress={toggleMore} style={styles.moreToggle}>
              <KRow gap={8} align="center">
                <Ionicons name={moreOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.primary} />
                <KText variant="label" bold style={styles.moreToggleText}>
                  Plus de filtres{advancedCount > 0 ? ` (${advancedCount})` : ""}
                </KText>
              </KRow>
            </KPressable>

            <Animated.View style={[styles.moreSection, { maxHeight: moreHeight, opacity: moreOpacity }]}>

              {/* Transmission */}
              <KText variant="label" bold style={styles.filterLabelCompact}>Transmission</KText>
              <KRow gap="sm" wrap>
                {[
                  { key: "auto", label: "Automatique" },
                  { key: "manual", label: "Manuelle" },
                ].map((t) => {
                  const active = local.transmission === t.key;
                  return (
                    <KPressable key={t.key} onPress={() => toggle("transmission", t.key)}
                      style={[styles.chip, active && styles.chipActive]}>
                      <KText variant="labelSmall" color={active ? "primary" : "text"}>{t.label}</KText>
                    </KPressable>
                  );
                })}
              </KRow>

              {/* Carburant */}
              <KText variant="label" bold style={styles.filterLabelCompact}>Carburant</KText>
              <KRow gap="sm" wrap>
                {[
                  { key: "essence", label: "Essence" },
                  { key: "diesel", label: "Diesel" },
                  { key: "hybrid", label: "Hybride" },
                  { key: "electric", label: "Électrique" },
                ].map((f) => {
                  const active = local.fuel === f.key;
                  return (
                    <KPressable key={f.key} onPress={() => toggle("fuel", f.key)}
                      style={[styles.chip, active && styles.chipActive]}>
                      <KText variant="labelSmall" color={active ? "primary" : "text"}>{f.label}</KText>
                    </KPressable>
                  );
                })}
              </KRow>

              {/* Places */}
              <KText variant="label" bold style={styles.filterLabelCompact}>Places minimum</KText>
              <KRow gap="sm" wrap>
                {["2", "4", "5", "7"].map((s) => {
                  const active = local.minSeats === s;
                  return (
                    <KPressable key={s} onPress={() => toggle("minSeats", s)}
                      style={[styles.chip, active && styles.chipActive]}>
                      <KText variant="labelSmall" color={active ? "primary" : "text"}>{s}+ places</KText>
                    </KPressable>
                  );
                })}
              </KRow>
            </Animated.View>

          </ScrollView>

          {/* Footer */}
          <KRow gap="sm" style={styles.footer}>
            <KPressable onPress={reset} style={styles.resetBtn}>
              <KText variant="label" center style={styles.resetLabel}>Réinitialiser</KText>
            </KPressable>
            <KPressable onPress={apply} style={styles.applyBtn}>
              <KText variant="label" bold color="textInverse" center style={styles.applyLabel}>
                Appliquer{totalCount > 0 ? ` (${totalCount})` : ""}
              </KText>
            </KPressable>
          </KRow>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
const useFilterStyles = createStyles((colors, isDark) => ({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingTop: 12, maxHeight: "88%",
  },
  sheetHeader: { paddingBottom: 10 },
  sheetContent: { paddingHorizontal: 16, paddingBottom: 18 },
  closeBtn: {
    width: 34, height: 34, borderRadius: 17, backgroundColor: colors.card,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  filterLabel: { marginTop: 20, marginBottom: 10 },
  filterLabelCompact: { marginTop: 16, marginBottom: 8 },
  filterInput: {
    backgroundColor: colors.card, borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
    borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, alignItems: "center",
  },
  inputText: { flex: 1, fontSize: 14, fontWeight: "600", color: colors.inputText },
  halfInput: { flex: 1 },
  priceDash: { alignSelf: "center" },
  chipRow: { marginTop: 10 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
    backgroundColor: colors.card,
    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  chipActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  moreToggle: {
    marginTop: 22, paddingVertical: 12,
    borderTopWidth: 1, borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  moreToggleText: { color: colors.primary },
  moreSection: { overflow: "hidden" },
  footer: {
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16,
    borderTopWidth: 1, borderTopColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
  },
  resetBtn: {
    flex: 1, height: 48, borderRadius: 16, backgroundColor: colors.card,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
    alignItems: "center", justifyContent: "center",
  },
  resetLabel: { fontSize: 13 },
  applyBtn: {
    flex: 1, height: 48, borderRadius: 16, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  applyLabel: { fontSize: 13 },
}));

// ═══════════════════════════════════════════════════════
// MAIN SEARCH SCREEN
// ═══════════════════════════════════════════════════════
export default function Search() {
  const { styles, colors, isDark } = useStyles();
  const params = useLocalSearchParams<{ city?: string; startDate?: string; endDate?: string }>();

  const [filters, setFilters] = useState<Filters>({
    q: "", city: params.city || "", minPrice: "", maxPrice: "",
    transmission: "", fuel: "", minSeats: "",
  });
  const [dateRange, setDateRange] = useState<{ start: string; end: string } | null>(
    params.startDate && params.endDate ? { start: params.startDate, end: params.endDate } : null
  );
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Re-read params when they change (e.g. navigating back from wizard)
  useEffect(() => {
    if (params.city) setFilters((f) => ({ ...f, city: params.city! }));
    if (params.startDate && params.endDate) {
      setDateRange({ start: params.startDate, end: params.endDate });
    }
  }, [params.city, params.startDate, params.endDate]);
  const [sort, setSort] = useState<"reco" | "priceAsc" | "priceDesc">("reco");
  const [category, setCategory] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  const [debouncedCity, setDebouncedCity] = useState(params.city || "");
  useEffect(() => { const t = setTimeout(() => setDebouncedCity(filters.city), 400); return () => clearTimeout(t); }, [filters.city]);

  const minPriceNum = filters.minPrice.trim() ? Number(filters.minPrice) : undefined;
  const maxPriceNum = filters.maxPrice.trim() ? Number(filters.maxPrice) : undefined;
  const minSeatsNum = filters.minSeats.trim() ? Number(filters.minSeats) : undefined;

  const vehicles = useQuery(api.vehicles.searchVehiclesWithCover, {
    city: debouncedCity.trim() || undefined,
    minPricePerDay: Number.isFinite(minPriceNum as number) ? minPriceNum : undefined,
    maxPricePerDay: Number.isFinite(maxPriceNum as number) ? maxPriceNum : undefined,
    transmission: filters.transmission || undefined,
    fuel: filters.fuel || undefined,
    minSeats: Number.isFinite(minSeatsNum as number) ? minSeatsNum : undefined,
    startDate: dateRange?.start || undefined,
    endDate: dateRange?.end || undefined,
    limit: 40,
  });

  const allVehicles = useQuery(api.vehicles.listVehiclesWithCover);

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

  const filtered = useMemo(() => {
    if (!vehicles) return undefined;
    let list = [...vehicles];
    if (filters.q.trim()) {
      const qq = filters.q.trim().toLowerCase();
      list = list.filter((v) => `${v.title} ${v.city} ${v.brand ?? ""} ${v.model ?? ""}`.toLowerCase().includes(qq));
    }
    // Category filter (client-side matching on title/fuel)
    if (category === "electric") list = list.filter((v) => v.fuel === "electric");
    else if (category === "suv") list = list.filter((v) => /suv|4x4|rav|tucson|tiguan|cr-v/i.test(v.title));
    else if (category === "sport") list = list.filter((v) => /sport|amg|m3|m4|gtr|rs|type.r|supra|corvette|mustang|gt/i.test(v.title));
    else if (category === "berline") list = list.filter((v) => /berline|sedan|série|class|accord|camry|passat/i.test(v.title) || (!v.title.match(/suv|4x4|utilitaire/i)));
    else if (category === "premium") list = list.filter((v) => /mercedes|bmw|audi|porsche|lexus|jaguar|maserati|bentley|range/i.test(v.title));
    else if (category === "utilitaire") list = list.filter((v) => /utilitaire|van|kangoo|berlingo|partner|transit|sprinter/i.test(v.title));

    if (sort === "priceAsc") list.sort((a, b) => a.pricePerDay - b.pricePerDay);
    else if (sort === "priceDesc") list.sort((a, b) => b.pricePerDay - a.pricePerDay);
    return list;
  }, [vehicles, filters.q, category, sort]);

  const suggestions = useMemo(() => {
    if (!allVehicles || !filtered) return [];
    const ids = new Set(filtered.map((v: any) => v._id));
    return allVehicles.filter((v) => !ids.has(v._id)).slice(0, 8);
  }, [allVehicles, filtered]);

  const isLoading = vehicles === undefined;
  const resultCount = filtered?.length ?? 0;
  const activeChips = makeActiveChips(filters);

  const clearChip = (key: string) => {
    if (key === "q") setFilters((prev) => ({ ...prev, q: "" }));
    else if (key === "city") { setFilters((prev) => ({ ...prev, city: "" })); setDebouncedCity(""); }
    else if (key === "maxPrice") setFilters((prev) => ({ ...prev, maxPrice: "" }));
    else if (key === "minPrice") setFilters((prev) => ({ ...prev, minPrice: "" }));
    else if (key === "price") setFilters((prev) => ({ ...prev, minPrice: "", maxPrice: "" }));
    else if (key === "transmission") setFilters((prev) => ({ ...prev, transmission: "" }));
    else if (key === "fuel") setFilters((prev) => ({ ...prev, fuel: "" }));
    else if (key === "minSeats") setFilters((prev) => ({ ...prev, minSeats: "" }));
  };

  const cycleSort = () => {
    if (sort === "reco") setSort("priceAsc");
    else if (sort === "priceAsc") setSort("priceDesc");
    else setSort("reco");
  };

  // Scroll-driven collapse
  const scrollY = useRef(new Animated.Value(0)).current;
  const SEARCH_BAR_H = 46;
  const COLLAPSE_AT = 40;

  const searchBarHeight = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT],
    outputRange: [SEARCH_BAR_H, 0],
    extrapolate: "clamp",
  });
  const searchBarOpacity = scrollY.interpolate({
    inputRange: [0, COLLAPSE_AT * 0.5],
    outputRange: [1, 0],
    extrapolate: "clamp",
  });

  // Sort label
  const sortLabel = sort === "reco" ? "Pertinence" : sort === "priceAsc" ? "Prix ↑" : "Prix ↓";

  // Result text (hide at 0, compact otherwise)
  const resultText = isLoading ? null
    : resultCount === 0 ? null
    : `${resultCount} résultat${resultCount > 1 ? "s" : ""}`;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top"]}>

      {/* ── Sticky header zone ── */}
      {/* Search bar — collapses on scroll */}
      <Animated.View style={[styles.searchSection, { height: searchBarHeight, opacity: searchBarOpacity }]}>
        <KPressable onPress={() => searchInputRef.current?.focus()} style={styles.searchBar}>
          <Ionicons name="search-outline" size={17} color={colors.primary} />
          <TextInput
            ref={searchInputRef}
            value={filters.q} onChangeText={(v) => setFilters((p) => ({ ...p, q: v }))}
            placeholder="Où voulez-vous rouler ?"
            placeholderTextColor={colors.inputPlaceholder}
            style={styles.searchInput}
          />
          {filters.q.length > 0 && (
            <KPressable onPress={() => setFilters((p) => ({ ...p, q: "" }))} style={styles.clearBtn}>
              <Ionicons name="close" size={13} color={colors.text} />
            </KPressable>
          )}
        </KPressable>
      </Animated.View>

      {/* Chips — always visible (sticky) */}
      <View style={styles.chipSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}>
          {/* Filter button */}
          <KPressable onPress={() => setFiltersOpen(true)} style={styles.filterIconBtn}>
            <Ionicons name="options-outline" size={16} color={colors.text} />
            {activeChips.filter((c) => c.key !== "q").length > 0 && (
              <View style={styles.filterBadge}>
                <KText variant="caption" bold color="textInverse" style={styles.filterBadgeText}>
                  {activeChips.filter((c) => c.key !== "q").length}
                </KText>
              </View>
            )}
          </KPressable>

          {/* Sort — dropdown style */}
          <KPressable onPress={cycleSort} style={styles.sortChip}>
            <KText variant="caption" style={styles.sortText}>{sortLabel}</KText>
            <Ionicons name="chevron-down" size={12} color={colors.textSecondary} />
          </KPressable>

          {/* Separator */}
          <View style={styles.chipSep} />

          {/* Category pills — smaller, distinct */}
          {CATEGORIES.map((c) => {
            const active = category === c.key;
            return (
              <KPressable key={c.key}
                onPress={() => setCategory(active ? "" : c.key)}
                style={[styles.catPill, active && styles.catPillActive]}>
                <KText variant="caption" bold={active}
                  style={active ? styles.catPillTextActive : styles.catPillText}>{c.label}</KText>
              </KPressable>
            );
          })}

          {/* Active filter chips */}
          {activeChips.map((c) => (
            <KPressable key={c.key} onPress={() => clearChip(c.key)} style={styles.activeChip}>
              <KText variant="caption" bold>{c.label}</KText>
              <Ionicons name="close-circle" size={12} color={colors.textSecondary} />
            </KPressable>
          ))}
          {/* Date range chip */}
          {dateRange && (
            <KPressable onPress={() => setDateRange(null)} style={styles.activeChip}>
              <Ionicons name="calendar-outline" size={12} color={colors.primary} />
              <KText variant="caption" bold>
                {formatDateChip(dateRange.start)} → {formatDateChip(dateRange.end)}
              </KText>
              <Ionicons name="close-circle" size={12} color={colors.textSecondary} />
            </KPressable>
          )}
        </ScrollView>
      </View>

      {/* ── Scrollable content ── */}
      <Animated.FlatList
        data={filtered ?? []}
        keyExtractor={(item: any) => item._id}
        contentContainerStyle={styles.listContent}
        keyboardShouldPersistTaps="handled"
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        scrollEventThrottle={16}

        ListHeaderComponent={
          resultText ? (
            <KText variant="caption" color="textTertiary" style={styles.resultCount}>
              {resultText}
            </KText>
          ) : null
        }

        renderItem={({ item }: { item: any }) => (
          <SearchResultCard vehicle={item} onPress={() => router.push(`/vehicle/${item._id}`)} />
        )}

        ListEmptyComponent={
          isLoading ? (
            <LoadingSkeleton />
          ) : (
            <KVStack align="center" gap={10} style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={36} color={colors.textTertiary} />
              <KText variant="label" bold center>Aucun résultat pour ces filtres</KText>
              <KText variant="bodySmall" color="textSecondary" center style={styles.emptyDesc}>
                Modifie tes critères ou explore une autre catégorie.
              </KText>
              <KRow gap={10} style={styles.emptyActions}>
                <KPressable onPress={() => {
                  setCategory("");
                  setFilters({ q: "", city: "", minPrice: "", maxPrice: "", transmission: "", fuel: "", minSeats: "" });
                  setDebouncedCity("");
                }} style={styles.emptyGhostBtn}>
                  <KText variant="labelSmall" bold color="textSecondary">Réinitialiser</KText>
                </KPressable>
                <KPressable onPress={() => setFiltersOpen(true)} style={styles.emptyBtn}>
                  <KText variant="labelSmall" bold color="textInverse">Modifier les filtres</KText>
                </KPressable>
              </KRow>
            </KVStack>
          )
        }

        ListFooterComponent={
          suggestions.length > 0 && !isLoading && resultCount <= 5 ? (
            <KVStack style={styles.suggestSection}>
              <View style={styles.suggestDivider} />
              <KText variant="h3" bold style={styles.suggestTitle}>
                {resultCount === 0 ? "Véhicules populaires" : "Tu pourrais aussi aimer"}
              </KText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.suggestScroll}>
                {suggestions.map((v: any) => (
                  <SuggestionMiniCard key={v._id} vehicle={v} />
                ))}
              </ScrollView>
            </KVStack>
          ) : null
        }
      />

      <FilterModal
        visible={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        setFilters={(f) => { setFilters(f); setDebouncedCity(f.city); }}
        suggestedCities={suggestedCities}
      />
    </SafeAreaView>
  );
}

// ═══════════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════════
function LoadingSkeleton() {
  const { colors } = useStyles();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = skeletonPulse(pulse);
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const Box = ({ w, h, r = 8, style }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />
  );

  return (
    <KVStack gap="lg">
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ borderRadius: 20, overflow: "hidden", backgroundColor: colors.card }}>
          <Box w="100%" h={220} r={0} />
          <View style={{ padding: 14, gap: 8 }}>
            <KRow justify="space-between"><Box w="60%" h={16} /><Box w="25%" h={16} /></KRow>
            <Box w="35%" h={14} />
          </View>
        </View>
      ))}
    </KVStack>
  );
}

// ═══════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════
const useStyles = createStyles((colors, isDark) => ({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: 24, flexGrow: 1 },

  // Search bar (collapsible)
  searchSection: {
    paddingHorizontal: 16, paddingBottom: 2, overflow: "hidden",
  },
  searchBar: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: colors.card, borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
    borderRadius: 12, paddingHorizontal: 12, height: 42,
  },
  searchInput: { flex: 1, fontWeight: "600", color: colors.inputText, fontSize: 14 },
  clearBtn: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center",
  },

  // Chips section (sticky)
  chipSection: { backgroundColor: colors.bg },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingVertical: 5 },

  // Filter icon button
  filterIconBtn: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: colors.card, borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
    alignItems: "center", justifyContent: "center",
    position: "relative",
  },
  filterBadge: {
    position: "absolute", top: -4, right: -4,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: colors.primary, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
  },
  filterBadgeText: { fontSize: 9 },

  // Sort chip — dropdown style (distinct from categories)
  sortChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, height: 34, borderRadius: 17,
    backgroundColor: colors.card, borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
  },
  sortText: { color: colors.textSecondary },

  chipSep: {
    width: 1, height: 18, alignSelf: "center",
    backgroundColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },

  // Category pills — smaller, rounder, distinct from sort
  catPill: {
    paddingHorizontal: 12, height: 30, borderRadius: 15,
    justifyContent: "center",
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
  },
  catPillActive: {
    backgroundColor: isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.1)",
    borderColor: colors.primary,
  },
  catPillText: { color: colors.textSecondary },
  catPillTextActive: { color: colors.primary },

  // Active filter chips
  activeChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, height: 30, borderRadius: 15,
    backgroundColor: isDark ? colors.bgTertiary : "rgba(59,130,246,0.06)",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(59,130,246,0.15)",
  },

  // Result count
  resultCount: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 6 },

  // Empty state
  emptyWrap: { paddingVertical: 32, paddingHorizontal: 28 },
  emptyDesc: { lineHeight: 18 },
  emptyActions: { marginTop: 6 },
  emptyGhostBtn: {
    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.1)",
  },
  emptyBtn: {
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12,
    backgroundColor: colors.primary,
  },

  // Suggestions
  suggestSection: { marginTop: 8, paddingHorizontal: 16, paddingBottom: 8 },
  suggestDivider: {
    height: 1, marginBottom: 16,
    backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
  },
  suggestTitle: { marginBottom: 12 },
  suggestSubtitle: { marginBottom: 14 },
  suggestScroll: { paddingRight: 16 },
}));
