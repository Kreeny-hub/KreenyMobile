import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Alert, Animated, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { CalendarList } from "react-native-calendars";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../convex/_generated/api";
import { KText, KRow, KVStack, KPressable, createStyles } from "../../../src/ui";
import { haptic } from "../../../src/theme";

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  for (let d = new Date(s); d <= e; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().split("T")[0]);
  }
  return out;
}

// ═══════════════════════════════════════════════════════
// Colors
// ═══════════════════════════════════════════════════════
const C = {
  blocked: "#EF4444",
  blockedBg: "#FEE2E2",
  blockedText: "#DC2626",
  reserved: "#3B82F6",
  reservedBg: "#DBEAFE",
  reservedText: "#1D4ED8",
  today: "#3B82F6",
};

// Statuts qui bloquent le calendrier
const BOOKING_STATUSES = new Set([
  "requested", "accepted_pending_payment", "pickup_pending",
  "in_progress", "dropoff_pending", "confirmed",
]);

// ═══════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════
export default function AvailabilityCalendar() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { styles, colors, isDark } = useStyles();

  const vehicle = useQuery(api.vehicles.getVehicleById, vehicleId ? { id: vehicleId as any } : "skip");
  const existingBlocked = useQuery(api.vehicles.getBlockedDates, vehicleId ? { vehicleId: vehicleId as any } : "skip");
  const reservations = useQuery(api.reservations.getReservationsForVehicle, vehicleId ? { vehicleId: vehicleId as any } : "skip");
  const setBlockedDates = useMutation(api.vehicles.setBlockedDates);

  const [blocked, setBlocked] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);

  // Init from server
  useEffect(() => {
    if (existingBlocked && !initialized) {
      setBlocked(new Set(existingBlocked as string[]));
      setInitialized(true);
    }
  }, [existingBlocked, initialized]);

  // Build reserved dates set (non-toggleable)
  const reservedDates = useMemo(() => {
    const set = new Set<string>();
    if (!reservations) return set;
    for (const r of reservations) {
      if (!BOOKING_STATUSES.has((r as any).status)) continue;
      const days = enumerateDays((r as any).startDate, (r as any).endDate);
      for (const d of days) set.add(d);
    }
    return set;
  }, [reservations]);

  // Check if changes were made
  const hasChanges = useMemo(() => {
    if (!initialized || !existingBlocked) return false;
    const original = new Set(existingBlocked as string[]);
    if (blocked.size !== original.size) return true;
    for (const d of blocked) if (!original.has(d)) return true;
    return false;
  }, [blocked, existingBlocked, initialized]);

  // Toggle a date
  const today = todayISO();
  const onDayPress = useCallback((day: { dateString: string }) => {
    const d = day.dateString;
    if (d < today) return; // can't block past
    if (reservedDates.has(d)) return; // can't toggle reserved dates

    haptic.light();
    setBlocked((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }, [today, reservedDates]);

  // Build marked dates
  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};

    // Past dates — subtle grey
    // (CalendarList handles minDate, but we grey past manually for clarity)

    // Reserved dates — blue (not toggleable)
    for (const d of reservedDates) {
      marks[d] = {
        customStyles: {
          container: { backgroundColor: C.reservedBg, borderRadius: 8 },
          text: { color: C.reservedText, fontWeight: "700" },
        },
      };
    }

    // Owner-blocked dates — red
    for (const d of blocked) {
      if (reservedDates.has(d)) continue; // reservation takes priority
      marks[d] = {
        customStyles: {
          container: { backgroundColor: C.blockedBg, borderRadius: 8 },
          text: { color: C.blockedText, fontWeight: "700" },
        },
      };
    }

    return marks;
  }, [blocked, reservedDates]);

  // Save
  const handleSave = async () => {
    if (!vehicleId || saving) return;
    haptic.medium();
    setSaving(true);
    try {
      await setBlockedDates({
        vehicleId: vehicleId as any,
        blockedDates: [...blocked].sort(),
      });
      haptic.success();
      router.back();
    } catch (e) {
      haptic.error();
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de sauvegarder.");
    } finally {
      setSaving(false);
    }
  };

  // Loading
  if (!vehicle || !initialized) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const blockedCount = [...blocked].filter((d) => d >= today).length;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <KRow gap="sm" style={styles.header}>
        <KPressable onPress={() => {
          if (hasChanges) {
            Alert.alert("Modifications non sauvegardées", "Tu as des changements en attente. Quitter sans enregistrer ?", [
              { text: "Rester", style: "cancel" },
              { text: "Quitter", style: "destructive", onPress: () => router.back() },
            ]);
          } else {
            router.back();
          }
        }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <View style={{ flex: 1 }}>
          <KText variant="label" bold style={{ fontSize: 17 }}>Disponibilités</KText>
          <KText variant="caption" color="textSecondary" numberOfLines={1}>{vehicle?.title}</KText>
        </View>
      </KRow>

      {/* Legend */}
      <View style={styles.legend}>
        <KRow gap={16}>
          <KRow gap={6} style={{ alignItems: "center" }}>
            <View style={[styles.legendDot, { backgroundColor: C.blockedBg, borderColor: C.blocked }]} />
            <KText variant="caption" color="textSecondary">Bloqué par toi</KText>
          </KRow>
          <KRow gap={6} style={{ alignItems: "center" }}>
            <View style={[styles.legendDot, { backgroundColor: C.reservedBg, borderColor: C.reserved }]} />
            <KText variant="caption" color="textSecondary">Réservé</KText>
          </KRow>
        </KRow>
        <KText variant="caption" color="textTertiary" style={{ marginTop: 4 }}>
          Appuie sur une date pour la bloquer ou débloquer.
        </KText>
      </View>

      {/* Calendar */}
      <CalendarList
        pastScrollRange={0}
        futureScrollRange={6}
        scrollEnabled
        showScrollIndicator={false}
        minDate={today}
        markingType="custom"
        markedDates={markedDates}
        onDayPress={onDayPress}
        theme={{
          backgroundColor: colors.bg,
          calendarBackground: colors.bg,
          todayTextColor: C.today,
          arrowColor: colors.primary,
          monthTextColor: colors.text,
          dayTextColor: colors.text,
          textDisabledColor: isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.2)",
          textSectionTitleColor: colors.textSecondary,
        }}
      />

      {/* Bottom bar */}
      <View style={styles.bottomBar}>
        <KVStack gap={2} style={{ flex: 1 }}>
          <KText variant="label" bold>
            {blockedCount} jour{blockedCount !== 1 ? "s" : ""} bloqué{blockedCount !== 1 ? "s" : ""}
          </KText>
          <KText variant="caption" color="textTertiary">
            {reservedDates.size} jour{reservedDates.size !== 1 ? "s" : ""} réservé{reservedDates.size !== 1 ? "s" : ""}
          </KText>
        </KVStack>
        <KPressable
          onPress={handleSave}
          disabled={!hasChanges || saving}
          style={[styles.saveBtn, (!hasChanges || saving) && { opacity: 0.4 }]}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <KText variant="label" bold style={{ color: "#FFF" }}>Enregistrer</KText>
          )}
        </KPressable>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  header: {
    alignItems: "center", paddingHorizontal: 14, height: 56,
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
  },
  legend: {
    paddingHorizontal: 18, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  legendDot: {
    width: 14, height: 14, borderRadius: 4, borderWidth: 1.5,
  },
  bottomBar: {
    flexDirection: "row", alignItems: "center", gap: 14,
    paddingHorizontal: 18, paddingTop: 14, paddingBottom: 34,
    backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  saveBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingHorizontal: 24, paddingVertical: 13,
    alignItems: "center", justifyContent: "center",
  },
}));
