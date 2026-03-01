import React, { useMemo, useState, useEffect, useRef } from "react";
import { Modal, View, StyleSheet, ScrollView, Alert, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { CalendarList, LocaleConfig } from "react-native-calendars";
import { formatDateFR } from "../../shared/utils/formatDateFR";
import { KText, KRow, KPressable } from "../../ui";

/* ═══════════════════════════════════════════════════════
   French locale
═══════════════════════════════════════════════════════ */
LocaleConfig.locales["fr"] = {
  monthNames: ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"],
  monthNamesShort: ["Janv.", "Févr.", "Mars", "Avr.", "Mai", "Juin", "Juil.", "Août", "Sept.", "Oct.", "Nov.", "Déc."],
  dayNames: ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"],
  dayNamesShort: ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"],
  today: "Aujourd'hui",
};
LocaleConfig.defaultLocale = "fr";

/* ═══════════════════════════════════════════════════════
   Types
═══════════════════════════════════════════════════════ */
type UnavailableRange = { startDate: string; endDate: string };
type ConfirmPayload = { startDate: string; endDate: string; startTime: string; endTime: string; days: number; total: number };
type Props = {
  visible: boolean;
  onClose: () => void;
  pricePerDay: number;
  unavailableRanges?: UnavailableRange[];
  availableFrom?: string | null;
  availableUntil?: string | null;
  onConfirm: (payload: ConfirmPayload) => void;
  defaultStartTime?: string;
  defaultEndTime?: string;
};

/* ═══════════════════════════════════════════════════════
   Theme (standalone modal — no dark mode)
═══════════════════════════════════════════════════════ */
const T = {
  bg: "#FFFFFF", card: "#FFFFFF", text: "#111111", muted: "#666666",
  border: "#E6E6E6", primary: "#111111", primaryText: "#FFFFFF",
  disabledText: "#A0A0A0", disabledBg: "#F2F3F5",
} as const;

/* ═══════════════════════════════════════════════════════
   Date helpers (YYYY-MM-DD)
═══════════════════════════════════════════════════════ */
const pad2 = (n: number) => String(n).padStart(2, "0");
const toISO = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const toDayN = (s: string) => { const [y, m, d] = s.split("-").map(Number); return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000); };
const fromDayN = (n: number) => { const dt = new Date(n * 86400000); return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`; };
const addDays = (iso: string, days: number) => { const [y, m, d] = iso.split("-").map(Number); const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + days); return toISO(dt); };
const countDays = (a: string | null, b: string | null) => {
  if (!a || !b) return 0;
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  const diff = new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
  return diff > 0 ? Math.round(diff / 864e5) : 0;
};

/* ═══════════════════════════════════════════════════════
   Disabled dates
═══════════════════════════════════════════════════════ */
function buildDisabledMap(ranges: UnavailableRange[]) {
  const map: Record<string, any> = {};
  for (const r of (Array.isArray(ranges) ? ranges : [])) {
    if (!r?.startDate || !r?.endDate) continue;
    let a = toDayN(r.startDate), b = toDayN(r.endDate);
    if (b < a) [a, b] = [b, a];
    for (let n = a; n <= b; n++) map[fromDayN(n)] = { disabled: true, disableTouchEvent: true, color: T.disabledBg, textColor: T.disabledText };
  }
  return map;
}
const isDisabled = (d: string, map: Record<string, any>, min?: string, max?: string) =>
  !d || (min && toDayN(d) < toDayN(min)) || (max && toDayN(d) > toDayN(max)) || Boolean(map?.[d]?.disabled);

/* ═══════════════════════════════════════════════════════
   Time helpers
═══════════════════════════════════════════════════════ */
const TIME_OPTIONS = (() => { const o: string[] = []; for (let h = 0; h < 24; h++) for (let m = 0; m < 60; m += 15) o.push(`${pad2(h)}:${pad2(m)}`); return o; })();

function TimeChip({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <KPressable onPress={onPress} style={st.timeChip}>
      <KText style={st.timeChipLabel}>{label}</KText>
      <KText style={st.timeChipValue}>{value}</KText>
    </KPressable>
  );
}

function TimePickerSheet({ title, value, onClose, onSelect, bottomInset }: { title: string; value: string; onClose: () => void; onSelect: (v: string) => void; bottomInset: number }) {
  const slideAnim = useRef(new Animated.Value(400)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 0, duration: 350, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(slideAnim, { toValue: 400, duration: 250, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  return (
    <Animated.View style={[st.overlay, { opacity: fadeAnim }]}>
      <KPressable onPress={handleClose} style={{ flex: 1 }} />
      <Animated.View style={[st.sheetWrap, { transform: [{ translateY: slideAnim }] }]}>
        <KRow style={st.sheetHeader}>
          <KPressable onPress={handleClose} style={st.iconBtn}><Ionicons name="close" size={22} color={T.text} /></KPressable>
          <KText style={st.title}>{title}</KText>
          <View style={{ width: 40 }} />
        </KRow>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 }} showsVerticalScrollIndicator={false}>
          {TIME_OPTIONS.map((t) => (
            <KPressable key={t} onPress={() => { onSelect(t); handleClose(); }} style={[st.timeRow, t === value && { backgroundColor: T.disabledBg }]}>
              <KText style={{ fontWeight: t === value ? "800" : "600", color: T.text }}>{t}</KText>
            </KPressable>
          ))}
        </ScrollView>

        <View style={[st.sheetFooter, { paddingBottom: Math.max(bottomInset, 16) }]}>
          <KPressable onPress={handleClose} style={st.secondaryBtn}><KText style={st.secondaryBtnText}>Fermer</KText></KPressable>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

/* ═══════════════════════════════════════════════════════
   CalendarModal
═══════════════════════════════════════════════════════ */
export default function CalendarModal({ visible, onClose, pricePerDay, unavailableRanges = [], availableFrom, availableUntil, onConfirm, defaultStartTime = "10:00", defaultEndTime = "18:00" }: Props) {
  const insets = useSafeAreaInsets();
  const todayISO = useMemo(() => toISO(new Date()), []);
  const minDate = useMemo(() => (availableFrom && availableFrom > todayISO) ? availableFrom : todayISO, [availableFrom, todayISO]);
  const maxDate = useMemo(() => availableUntil || undefined, [availableUntil]);
  const disabledDates = useMemo(() => buildDisabledMap(unavailableRanges), [unavailableRanges]);

  const [start, setStart] = useState<string | null>(null);
  const [end, setEnd] = useState<string | null>(null);
  const [startTime, setStartTime] = useState(defaultStartTime);
  const [endTime, setEndTime] = useState(defaultEndTime);
  const [timePicker, setTimePicker] = useState<null | "start" | "end">(null);

  useEffect(() => {
    if (visible) { setStart(null); setEnd(null); setStartTime(defaultStartTime); setEndTime(defaultEndTime); setTimePicker(null); }
  }, [visible, defaultStartTime, defaultEndTime]);

  const markedDates = useMemo(() => {
    const marked: Record<string, any> = { ...disabledDates };
    if (start && !end) {
      marked[start] = { ...(marked[start] || {}), startingDay: true, endingDay: true, color: T.primary, textColor: T.primaryText };
    }
    if (start && end) {
      let cur = start;
      while (cur <= end) { marked[cur] = { ...(marked[cur] || {}), startingDay: cur === start, endingDay: cur === end, color: T.primary, textColor: T.primaryText }; cur = addDays(cur, 1); }
    }
    return marked;
  }, [disabledDates, start, end]);

  const onDayPress = (day: any) => {
    const date = day?.dateString as string | undefined;
    if (!date || isDisabled(date, disabledDates, minDate, maxDate)) return;
    if (!start || (start && end)) { setStart(date); setEnd(null); return; }
    if (date < start) { setStart(date); setEnd(null); return; }
    let cur = start;
    while (cur <= date) { if (disabledDates?.[cur]?.disabled) return; cur = addDays(cur, 1); }
    setEnd(date);
  };

  const days = useMemo(() => countDays(start, end), [start, end]);
  const total = useMemo(() => days > 0 ? days * Number(pricePerDay || 0) : 0, [days, pricePerDay]);
  const canConfirm = !!(start && end && days > 0);

  const handleConfirm = () => {
    if (!start) { Alert.alert("Dates requises", "Choisis une date de début."); return; }
    if (!end) { Alert.alert("Dates requises", "Choisis une date de fin."); return; }
    if (days <= 0) { Alert.alert("Plage invalide", "La date de fin doit être après la date de début."); return; }
    let cur = start;
    while (cur <= end) { if (disabledDates?.[cur]?.disabled) { Alert.alert("Indisponible", "Cette plage contient des dates déjà réservées."); return; } cur = addDays(cur, 1); }
    onConfirm({ startDate: start, endDate: end, startTime, endTime, days, total });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[st.safe, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <KRow style={st.header}>
          <KPressable onPress={onClose} style={st.iconBtn}><Ionicons name="close" size={22} color={T.text} /></KPressable>
          <KText style={st.title}>Choisir des dates</KText>
          <View style={{ width: 40 }} />
        </KRow>

        {/* Summary card */}
        <View style={st.summary}>
          <KText style={st.summaryLabel}>Sélection</KText>
          <KText style={st.summaryValue}>{start ? formatDateFR(start) : "Début"} → {end ? formatDateFR(end) : "Fin"}</KText>
          <KRow gap="sm" style={{ marginTop: 12 }}>
            <View style={{ flex: 1 }}><TimeChip label="Départ" value={startTime} onPress={() => setTimePicker("start")} /></View>
            <View style={{ flex: 1 }}><TimeChip label="Retour" value={endTime} onPress={() => setTimePicker("end")} /></View>
          </KRow>
          <KText style={st.summaryHint}>{days > 0 ? `${days} jour(s) • Total ${total} MAD` : "Sélectionne une date de début et de fin"}</KText>
        </View>

        {/* Calendar */}
        <View style={{ flex: 1 }}>
          <CalendarList pastScrollRange={0} futureScrollRange={12} scrollEnabled showScrollIndicator={false} minDate={minDate} maxDate={maxDate} markingType="period" markedDates={markedDates} onDayPress={onDayPress} theme={{ todayTextColor: T.primary, arrowColor: T.primary, textDisabledColor: T.disabledText }} />
        </View>

        {/* CTA */}
        <View style={[st.footer, { paddingBottom: Math.max(insets.bottom, 18) }]}>
          <KPressable onPress={handleConfirm} disabled={!canConfirm} style={[st.cta, !canConfirm && { opacity: 0.5 }]}>
            <KText style={st.ctaText}>Valider</KText>
          </KPressable>
        </View>

        {/* Time picker overlay */}
        {timePicker && (
          <TimePickerSheet title={timePicker === "start" ? "Heure de départ" : "Heure de retour"} value={timePicker === "start" ? startTime : endTime} onClose={() => setTimePicker(null)} onSelect={(v) => timePicker === "start" ? setStartTime(v) : setEndTime(v)} bottomInset={insets.bottom} />
        )}
      </View>
    </Modal>
  );
}

/* ═══════════════════════════════════════════════════════
   Styles (standalone theme — not using createStyles)
═══════════════════════════════════════════════════════ */
const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: T.bg },
  header: { paddingHorizontal: 14, paddingBottom: 10, alignItems: "center", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: T.card, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: T.border },
  title: { color: T.text, fontSize: 16, fontWeight: "800" },
  summary: { marginHorizontal: 18, marginBottom: 10, backgroundColor: T.card, borderRadius: 18, padding: 14, borderWidth: 1, borderColor: T.border },
  summaryLabel: { color: T.muted, fontSize: 12, fontWeight: "600" },
  summaryValue: { marginTop: 6, color: T.text, fontSize: 14, fontWeight: "800" },
  summaryHint: { marginTop: 10, color: T.muted, lineHeight: 18 },
  timeChip: { borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12, backgroundColor: T.card, gap: 4 },
  timeChipLabel: { color: T.muted, fontSize: 12, fontWeight: "600" },
  timeChipValue: { color: T.text, fontSize: 14, fontWeight: "800" },
  footer: { padding: 18 },
  cta: { backgroundColor: T.primary, paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  ctaText: { color: T.primaryText, fontWeight: "800", fontSize: 15 },
  timeRow: { borderWidth: 1, borderColor: T.border, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, marginBottom: 10, backgroundColor: T.card },
  secondaryBtn: { borderWidth: 1, borderColor: T.border, borderRadius: 16, paddingVertical: 14, alignItems: "center", backgroundColor: T.card },
  secondaryBtnText: { color: T.text, fontWeight: "800" },
  overlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "flex-end" },
  sheetWrap: { backgroundColor: T.bg, borderTopLeftRadius: 18, borderTopRightRadius: 18, borderWidth: 1, borderColor: T.border, height: "75%", overflow: "hidden" },
  sheetHeader: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: T.border },
  sheetFooter: { padding: 16, borderTopWidth: 1, borderTopColor: T.border, backgroundColor: T.bg },
});
