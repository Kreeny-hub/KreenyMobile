import React, { useMemo, useState, useEffect } from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CalendarList } from "react-native-calendars";
import { formatDateFR } from "../../shared/utils/formatDateFR";

type UnavailableRange = { startDate: string; endDate: string };

type ConfirmPayload = {
  startDate: string;
  endDate: string;
  startTime: string; // "HH:mm"
  endTime: string;   // "HH:mm"
  days: number;
  total: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;

  pricePerDay: number;

  unavailableRanges?: UnavailableRange[];
  availableFrom?: string | null;
  availableUntil?: string | null;

  onConfirm: (payload: ConfirmPayload) => void;

  // Optionnel: si tu veux customiser plus tard
  defaultStartTime?: string; // "HH:mm"
  defaultEndTime?: string;   // "HH:mm"
};

/* =========================================================
   Helpers (YYYY-MM-DD)
========================================================= */
function pad2(n: number) {
  return String(n).padStart(2, "0");
}
function toISO(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function toDayNumber(yyyyMMdd: string) {
  const [y, m, d] = String(yyyyMMdd).split("-").map(Number);
  return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
}
function fromDayNumber(n: number) {
  const dt = new Date(n * 86400000);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDaysISO(iso: string, days: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return toISO(dt);
}

// Diff "par jour" (end exclusive)
// 2026-02-16 -> 2026-02-18 = 2 jours
function countDays(start: string | null, end: string | null) {
  if (!start || !end) return 0;
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  const diff = b - a;
  return diff > 0 ? Math.round(diff / (1000 * 60 * 60 * 24)) : 0;
}

/* =========================================================
   Disabled dates map (ranges -> dates grises non cliquables)
========================================================= */
function buildDisabledDatesMap(unavailableRanges: UnavailableRange[]) {
  const map: Record<string, any> = {};
  const ranges = Array.isArray(unavailableRanges) ? unavailableRanges : [];

  for (const r of ranges) {
    const s = r?.startDate;
    const e = r?.endDate;
    if (!s || !e) continue;

    let a = toDayNumber(s);
    let b = toDayNumber(e);
    if (b < a) [a, b] = [b, a];

    for (let n = a; n <= b; n++) {
      const key = fromDayNumber(n);
      map[key] = {
        disabled: true,
        disableTouchEvent: true,
        color: "#F2F3F5",
        textColor: "#A0A0A0",
      };
    }
  }
  return map;
}

function isDisabledDate(
  dateString: string,
  disabledMap: Record<string, any>,
  minDate?: string,
  maxDate?: string
) {
  if (!dateString) return false;
  if (minDate && toDayNumber(dateString) < toDayNumber(minDate)) return true;
  if (maxDate && toDayNumber(dateString) > toDayNumber(maxDate)) return true;
  return Boolean(disabledMap?.[dateString]?.disabled);
}

/* =========================================================
   Minimal theme (calme/premium)
========================================================= */
const THEME = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  text: "#111111",
  muted: "#666666",
  border: "#E6E6E6",
  primary: "#111111",
  primaryText: "#FFFFFF",
  disabledText: "#A0A0A0",
  disabledBg: "#F2F3F5",
};

function buildTimeOptions(stepMinutes = 15) {
  const out: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += stepMinutes) {
      out.push(`${pad2(h)}:${pad2(m)}`);
    }
  }
  return out;
}

function TimeChip({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.timeChip} activeOpacity={0.9} onPress={onPress}>
      <Text style={styles.timeChipLabel}>{label}</Text>
      <Text style={styles.timeChipValue}>{value}</Text>
    </TouchableOpacity>
  );
}

function TimePickerSheet({
  title,
  value,
  onClose,
  onSelect,
  bottomInset,
}: {
  title: string;
  value: string;
  onClose: () => void;
  onSelect: (v: string) => void;
  bottomInset: number;
}) {
  const options = useMemo(() => buildTimeOptions(15), []);

  return (
    <View style={styles.sheetWrap}>
      <View style={styles.sheetHeader}>
        <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.85}>
          <Ionicons name="close" size={22} color={THEME.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}
        showsVerticalScrollIndicator={false}
      >
        {options.map((t) => (
          <TouchableOpacity
            key={t}
            activeOpacity={0.9}
            onPress={() => {
              onSelect(t);
              onClose();
            }}
            style={[
              styles.timeRow,
              t === value ? { backgroundColor: THEME.disabledBg } : null,
            ]}
          >
            <Text style={{ fontWeight: t === value ? "800" : "600", color: THEME.text }}>
              {t}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* ✅ Safe area bottom appliquée ici */}
      <View style={[styles.sheetFooter, { paddingBottom: Math.max(bottomInset, 16) }]}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={onClose} activeOpacity={0.9}>
          <Text style={styles.secondaryBtnText}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function CalendarModal({
  visible,
  onClose,
  pricePerDay,
  unavailableRanges = [],
  availableFrom,
  availableUntil,
  onConfirm,
  defaultStartTime = "10:00",
  defaultEndTime = "18:00",
}: Props) {
  const insets = useSafeAreaInsets();
  const todayISO = useMemo(() => toISO(new Date()), []);

  const minDate = useMemo(() => {
    if (availableFrom && availableFrom > todayISO) return availableFrom;
    return todayISO;
  }, [availableFrom, todayISO]);

  const maxDate = useMemo(() => availableUntil || undefined, [availableUntil]);

  const disabledDates = useMemo(
    () => buildDisabledDatesMap(unavailableRanges),
    [unavailableRanges]
  );

  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);

  const [startTime, setStartTime] = useState<string>(defaultStartTime);
  const [endTime, setEndTime] = useState<string>(defaultEndTime);

  const [timePicker, setTimePicker] = useState<null | "start" | "end">(null);

  useEffect(() => {
    if (visible) {
      setStart(null);
      setEnd(null);
      setStartTime(defaultStartTime);
      setEndTime(defaultEndTime);
      setTimePicker(null);
    }
  }, [visible, defaultStartTime, defaultEndTime]);

  const markedDates = useMemo(() => {
    const marked: Record<string, any> = { ...disabledDates };

    if (start && !end) {
      marked[start] = {
        ...(marked[start] || {}),
        startingDay: true,
        endingDay: true,
        color: THEME.primary,
        textColor: THEME.primaryText,
      };
    }

    if (start && end) {
      let cur = start;
      while (cur <= end) {
        marked[cur] = {
          ...(marked[cur] || {}),
          startingDay: cur === start,
          endingDay: cur === end,
          color: THEME.primary,
          textColor: THEME.primaryText,
        };
        cur = addDaysISO(cur, 1);
      }
    }

    return marked;
  }, [disabledDates, start, end]);

  const onDayPress = (day: any) => {
    const date = day?.dateString as string | undefined;
    if (!date) return;

    if (isDisabledDate(date, disabledDates, minDate, maxDate)) return;

    // start / reset
    if (!start || (start && end)) {
      setStart(date);
      setEnd(null);
      return;
    }

    // date antérieure => nouveau start
    if (date < start) {
      setStart(date);
      setEnd(null);
      return;
    }

    // interdit de traverser du disabled
    let cur = start;
    while (cur <= date) {
      if (disabledDates?.[cur]?.disabled) return;
      cur = addDaysISO(cur, 1);
    }

    setEnd(date);
  };

  const days = useMemo(() => countDays(start, end), [start, end]);
  const total = useMemo(
    () => (days > 0 ? days * Number(pricePerDay || 0) : 0),
    [days, pricePerDay]
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.85}>
            <Ionicons name="close" size={22} color={THEME.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Choisir des dates</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.summary}>
          <Text style={styles.summaryLabel}>Sélection</Text>
          <Text style={styles.summaryValue}>
            {start ? formatDateFR(start) : "Début"} {" → "} {end ? formatDateFR(end) : "Fin"}
          </Text>

          <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <TimeChip label="Départ" value={startTime} onPress={() => setTimePicker("start")} />
            </View>
            <View style={{ flex: 1 }}>
              <TimeChip label="Retour" value={endTime} onPress={() => setTimePicker("end")} />
            </View>
          </View>

          <Text style={styles.summaryHint}>
            {days > 0 ? `${days} jour(s) • Total ${total} MAD` : "Sélectionne une date de début et de fin"}
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <CalendarList
            pastScrollRange={0}
            futureScrollRange={12}
            scrollEnabled
            showScrollIndicator={false}
            minDate={minDate}
            maxDate={maxDate}
            markingType="period"
            markedDates={markedDates}
            onDayPress={onDayPress}
            theme={{
              todayTextColor: THEME.primary,
              arrowColor: THEME.primary,
              textDisabledColor: THEME.disabledText,
            }}
          />
        </View>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <TouchableOpacity
            style={[styles.cta, !(start && end && days > 0) && { opacity: 0.5 }]}
            activeOpacity={0.9}
            disabled={!(start && end && days > 0)}
            onPress={() => {
              if (!start) {
                Alert.alert("Dates requises", "Choisis une date de début.");
                return;
              }
              if (!end) {
                Alert.alert("Dates requises", "Choisis une date de fin.");
                return;
              }
              if (days <= 0) {
                Alert.alert("Plage invalide", "La date de fin doit être après la date de début.");
                return;
              }

              // sécurité : plage contient du disabled -> refuse
              let cur = start;
              while (cur <= end) {
                if (disabledDates?.[cur]?.disabled) {
                  Alert.alert("Indisponible", "Cette plage contient des dates déjà réservées.");
                  return;
                }
                cur = addDaysISO(cur, 1);
              }

              onConfirm({
                startDate: start,
                endDate: end,
                startTime,
                endTime,
                days,
                total,
              });
              onClose();
            }}
          >
            <Text style={styles.ctaText}>Valider</Text>
          </TouchableOpacity>
        </View>
        {timePicker && (
          <View style={styles.overlay}>
            <TimePickerSheet
              title={timePicker === "start" ? "Heure de départ" : "Heure de retour"}
              value={timePicker === "start" ? startTime : endTime}
              onClose={() => setTimePicker(null)}
              onSelect={(v) => {
                if (timePicker === "start") setStartTime(v);
                else setEndTime(v);
              }}
              bottomInset={insets.bottom}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: THEME.bg },

  header: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.card,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: THEME.border,
  },
  title: { color: THEME.text, fontSize: 16, fontWeight: "800" },

  summary: {
    marginHorizontal: 18,
    marginBottom: 10,
    backgroundColor: THEME.card,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.border,
  },
  summaryLabel: { color: THEME.muted, fontSize: 12, fontWeight: "600" },
  summaryValue: { marginTop: 6, color: THEME.text, fontSize: 14, fontWeight: "800" },
  summaryHint: { marginTop: 10, color: THEME.muted, lineHeight: 18 },

  timeChip: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: THEME.card,
    gap: 4,
  },
  timeChipLabel: { color: THEME.muted, fontSize: 12, fontWeight: "600" },
  timeChipValue: { color: THEME.text, fontSize: 14, fontWeight: "800" },

  footer: { padding: 18 },
  cta: {
    backgroundColor: THEME.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  ctaText: { color: THEME.primaryText, fontWeight: "800", fontSize: 15 },

  timeRow: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: THEME.card,
  },

  secondaryBtn: {
    borderWidth: 1,
    borderColor: THEME.border,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: THEME.card,
  },
  secondaryBtnText: { color: THEME.text, fontWeight: "800" },

  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.25)",
    justifyContent: "flex-end",
  },

  // ✅ Donne une hauteur fixe : sinon iOS calcule parfois une hauteur trop petite
  sheetWrap: {
    backgroundColor: THEME.bg,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: THEME.border,
    height: "75%",         // ✅ clé du fix
    overflow: "hidden",
  },

  sheetHeader: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: THEME.border,
  },

  sheetFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: THEME.border,
    backgroundColor: THEME.bg,
  },
});