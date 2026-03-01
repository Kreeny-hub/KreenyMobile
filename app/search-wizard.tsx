import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Dimensions, Keyboard, ScrollView, TextInput, View,
} from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CalendarList, LocaleConfig } from "react-native-calendars";
import { api } from "../convex/_generated/api";
import { KText, KRow, KVStack, KPressable, createStyles } from "../src/ui";
import { haptic } from "../src/theme";
import { getRecentSearches, saveRecentSearch, type RecentSearch } from "../src/lib/recentSearches";

const { width: SW } = Dimensions.get("window");

// French locale (may already be set by CalendarModal)
if (!LocaleConfig.locales["fr"]) {
  LocaleConfig.locales["fr"] = {
    monthNames: ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"],
    monthNamesShort: ["Janv.","Févr.","Mars","Avr.","Mai","Juin","Juil.","Août","Sept.","Oct.","Nov.","Déc."],
    dayNames: ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"],
    dayNamesShort: ["D","L","M","M","J","V","S"],
    today: "Aujourd'hui",
  };
  LocaleConfig.defaultLocale = "fr";
}

const toISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const TODAY = toISO(new Date());

function formatDateShort(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["janv.","févr.","mars","avr.","mai","juin","juil.","août","sept.","oct.","nov.","déc."];
  return `${d} ${months[(m || 1) - 1]}`;
}

function countDays(start: string, end: string): number {
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

// ══════════════════════════════════════════════════════════
// MAIN WIZARD
// ══════════════════════════════════════════════════════════
export default function SearchWizard() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ prefillCity?: string }>();

  const [step, setStep] = useState<"where" | "when">("where");
  const [city, setCity] = useState(params.prefillCity || "");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);

  // Load popular cities from feed
  const feed = useQuery(api.home.getFeed);
  const popularCities = feed?.popularCities ?? [];

  // Load recent searches
  useEffect(() => {
    getRecentSearches().then(setRecentSearches).catch(() => {});
  }, []);

  // Calendar marking — exact same as CalendarModal in reservations
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    if (startDate && !endDate) {
      marks[startDate] = { startingDay: true, endingDay: true, color: colors.primary, textColor: "#FFF" };
    }
    if (startDate && endDate) {
      let cur = startDate;
      while (cur <= endDate) {
        marks[cur] = { startingDay: cur === startDate, endingDay: cur === endDate, color: colors.primary, textColor: "#FFF" };
        const d = new Date(cur + "T00:00:00");
        d.setDate(d.getDate() + 1);
        cur = toISO(d);
      }
    }
    return marks;
  }, [startDate, endDate, colors]);

  const handleDayPress = useCallback((day: { dateString: string }) => {
    const date = day.dateString;
    if (date < TODAY) return;

    if (!startDate || (startDate && endDate)) {
      setStartDate(date);
      setEndDate(null);
    } else if (date < startDate) {
      setStartDate(date);
      setEndDate(null);
    } else if (date === startDate) {
      setStartDate(null);
      setEndDate(null);
    } else {
      setEndDate(date);
    }
  }, [startDate, endDate]);

  const handleSearch = useCallback(async () => {
    haptic.medium();
    // Save to recent searches
    await saveRecentSearch({
      city: city.trim() || undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
    });
    // Navigate to search with params
    router.replace({
      pathname: "/(tabs)/search",
      params: {
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      },
    });
  }, [city, startDate, endDate]);

  const handleRecentSearch = useCallback(async (search: RecentSearch) => {
    haptic.light();
    await saveRecentSearch({
      city: search.city,
      startDate: search.startDate,
      endDate: search.endDate,
    });
    router.replace({
      pathname: "/(tabs)/search",
      params: {
        ...(search.city ? { city: search.city } : {}),
        ...(search.startDate ? { startDate: search.startDate } : {}),
        ...(search.endDate ? { endDate: search.endDate } : {}),
      },
    });
  }, []);

  const days = startDate && endDate ? countDays(startDate, endDate) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Stack.Screen options={{ headerShown: false, animation: "slide_from_bottom" }} />

      {/* ── Header ── */}
      <KRow px="lg" style={styles.header} justify="space-between" align="center">
        <KPressable onPress={() => step === "where" ? router.back() : setStep("where")} style={styles.backBtn}>
          <Ionicons name={step === "where" ? "close" : "chevron-back"} size={20} color={colors.text} />
        </KPressable>
        <KRow gap={8}>
          <View style={[styles.stepDot, step === "where" && styles.stepDotActive]} />
          <View style={[styles.stepDot, step === "when" && styles.stepDotActive]} />
        </KRow>
        <View style={{ width: 36 }} />
      </KRow>

      {/* ════════════════════════════════════════════ */}
      {/* STEP 1: OÙ ?                                */}
      {/* ════════════════════════════════════════════ */}
      {step === "where" && (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <KText style={styles.bigTitle}>Où ?</KText>
          <KText style={styles.subtitle}>Choisis une ville ou explore partout</KText>

          {/* Search input */}
          <View style={styles.input}>
            <Ionicons name="location-outline" size={20} color={colors.primary} />
            <TextInput
              value={city}
              onChangeText={setCity}
              placeholder="Toutes les villes"
              placeholderTextColor={colors.textTertiary}
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.inputText}
            />
            {city.length > 0 && (
              <KPressable onPress={() => setCity("")}>
                <Ionicons name="close-circle" size={20} color={colors.textTertiary} />
              </KPressable>
            )}
          </View>

          {/* Popular cities */}
          {popularCities.length > 0 && (
            <View style={{ marginTop: 24 }}>
              <KText style={styles.sectionLabel}>Villes populaires</KText>
              <KRow gap={8} wrap style={{ marginTop: 10 }}>
                {popularCities.map((c: any) => {
                  const active = city.toLowerCase() === c.city.toLowerCase();
                  return (
                    <KPressable key={c.city} onPress={() => { setCity(active ? "" : c.city); haptic.light(); }} style={[styles.cityChip, active && styles.cityChipActive]}>
                      <Ionicons name="location" size={13} color={active ? colors.primary : colors.textSecondary} />
                      <KText variant="label" style={{ color: active ? colors.primary : colors.text, fontSize: 14 }}>
                        {c.city}
                      </KText>
                      <KText variant="caption" color="textTertiary" style={{ fontSize: 11 }}>
                        {c.count}
                      </KText>
                    </KPressable>
                  );
                })}
              </KRow>
            </View>
          )}

          {/* Recent searches */}
          {recentSearches.length > 0 && (
            <View style={{ marginTop: 28 }}>
              <KText style={styles.sectionLabel}>Recherches récentes</KText>
              <KVStack gap={0} style={{ marginTop: 8 }}>
                {recentSearches.map((s, i) => (
                  <KPressable key={i} onPress={() => handleRecentSearch(s)} style={styles.recentRow}>
                    <View style={styles.recentIcon}>
                      <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                    </View>
                    <KVStack flex={1} gap={1}>
                      <KText variant="label" style={{ fontSize: 14 }}>
                        {s.city || "Toutes villes"}
                      </KText>
                      {s.startDate && (
                        <KText variant="caption" color="textSecondary">
                          {formatDateShort(s.startDate)}{s.endDate ? ` → ${formatDateShort(s.endDate)}` : ""}
                        </KText>
                      )}
                    </KVStack>
                    <Ionicons name="arrow-forward" size={14} color={colors.textTertiary} />
                  </KPressable>
                ))}
              </KVStack>
            </View>
          )}
        </ScrollView>
      )}

      {/* ════════════════════════════════════════════ */}
      {/* STEP 2: QUAND ?                             */}
      {/* ════════════════════════════════════════════ */}
      {step === "when" && (
        <View style={{ flex: 1, paddingHorizontal: 20 }}>
          <KText style={styles.bigTitle}>Quand ?</KText>
          <KText style={styles.subtitle}>
            {city ? `À ${city} · ` : ""}Sélectionne tes dates
          </KText>

          {/* Date summary */}
          {startDate && (
            <View style={styles.dateSummary}>
              <KRow gap={10} align="center">
                <KVStack align="center" style={{ flex: 1 }}>
                  <KText variant="caption" color="textSecondary">Début</KText>
                  <KText variant="label" bold style={{ fontSize: 16 }}>{formatDateShort(startDate)}</KText>
                </KVStack>
                <Ionicons name="arrow-forward" size={16} color={colors.textTertiary} />
                <KVStack align="center" style={{ flex: 1 }}>
                  <KText variant="caption" color="textSecondary">Fin</KText>
                  <KText variant="label" bold style={{ fontSize: 16, color: endDate ? colors.text : colors.textTertiary }}>
                    {endDate ? formatDateShort(endDate) : "—"}
                  </KText>
                </KVStack>
              </KRow>
              {days > 0 && (
                <KText variant="caption" color="primary" bold style={{ textAlign: "center", marginTop: 6 }}>
                  {days} jour{days > 1 ? "s" : ""}
                </KText>
              )}
            </View>
          )}

          {/* Calendar */}
          <View style={{ flex: 1 }}>
            <CalendarList
              pastScrollRange={0}
              futureScrollRange={12}
              scrollEnabled
              showScrollIndicator={false}
              minDate={TODAY}
              markingType="period"
              markedDates={markedDates}
              onDayPress={handleDayPress}
              calendarWidth={SW - 40}
              theme={{
                todayTextColor: colors.primary,
                arrowColor: colors.primary,
                textDisabledColor: colors.textTertiary,
              }}
            />
          </View>

          {startDate && endDate && (
            <KPressable
              onPress={() => { setStartDate(null); setEndDate(null); }}
              style={styles.clearDatesBtn}
            >
              <Ionicons name="close-circle-outline" size={16} color={colors.textSecondary} />
              <KText variant="label" style={{ color: colors.textSecondary, fontSize: 13 }}>
                Effacer les dates
              </KText>
            </KPressable>
          )}
        </View>
      )}

      {/* ── Bottom bar ── */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12 }]}>
        {step === "where" ? (
          <KRow gap={12} style={{ flex: 1 }}>
            <KPressable
              onPress={() => { setCity(""); setStep("when"); }}
              style={styles.skipBtn}
            >
              <KText variant="label" style={{ color: colors.textSecondary }}>Passer</KText>
            </KPressable>
            <KPressable
              onPress={() => { Keyboard.dismiss(); setStep("when"); }}
              style={styles.nextBtn}
            >
              <KText variant="label" bold style={{ color: "#FFF" }}>
                {city.trim() ? `Suivant · ${city.trim()}` : "Suivant"}
              </KText>
              <Ionicons name="arrow-forward" size={16} color="#FFF" />
            </KPressable>
          </KRow>
        ) : (
          <KRow gap={12} style={{ flex: 1 }}>
            <KPressable onPress={handleSearch} style={styles.skipBtn}>
              <KText variant="label" style={{ color: colors.textSecondary }}>Passer</KText>
            </KPressable>
            <KPressable onPress={handleSearch} style={styles.searchBtn}>
              <Ionicons name="search" size={18} color="#FFF" />
              <KText variant="label" bold style={{ color: "#FFF" }}>
                Rechercher{days > 0 ? ` · ${days}j` : ""}
              </KText>
            </KPressable>
          </KRow>
        )}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  stepDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.1)",
  },
  stepDotActive: { backgroundColor: colors.primary, width: 24, borderRadius: 4 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 120 },
  bigTitle: { fontSize: 28, fontWeight: "800" as const, color: colors.text, lineHeight: 36 },
  subtitle: { fontSize: 15, color: colors.textSecondary, marginTop: 6, marginBottom: 20 },
  sectionLabel: { fontSize: 14, fontWeight: "700" as const, color: colors.textSecondary, textTransform: "uppercase" as const, letterSpacing: 0.5 },
  input: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 10,
    backgroundColor: isDark ? colors.bgTertiary : "#F8F9FB",
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  inputText: { flex: 1, fontSize: 16, fontWeight: "600" as const, color: colors.text },
  cityChip: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 6,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 99,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "transparent",
  },
  cityChipActive: {
    backgroundColor: isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.08)",
    borderColor: colors.primary,
  },
  recentRow: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  recentIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  dateSummary: {
    padding: 16, borderRadius: 16, marginBottom: 16,
    backgroundColor: isDark ? colors.bgTertiary : "#F8F9FB",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  calendarWrap: {
    borderRadius: 16, overflow: "hidden" as const,
    backgroundColor: isDark ? colors.bgTertiary : "#FAFBFC",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
    paddingBottom: 8,
  },
  clearDatesBtn: {
    flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "center" as const,
    gap: 6, alignSelf: "center" as const, marginTop: 14,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 99,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
  },
  bottomBar: {
    position: "absolute" as const, bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
    backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  skipBtn: {
    paddingVertical: 14, paddingHorizontal: 16, borderRadius: 14,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  nextBtn: {
    flex: 1, flexDirection: "row" as const, alignItems: "center" as const,
    justifyContent: "center" as const, gap: 8,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.primary,
  },
  searchBtn: {
    flex: 1, flexDirection: "row" as const, alignItems: "center" as const,
    justifyContent: "center" as const, gap: 8,
    paddingVertical: 14, borderRadius: 14,
    backgroundColor: colors.primary,
  },
}));
