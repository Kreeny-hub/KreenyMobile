import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams, Stack } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, Alert, FlatList, Keyboard,
  Platform, TextInput, View, Image as RNImage,
  Modal, Pressable, Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { haptic } from "../../src/theme/haptics";
import { api } from "../../convex/_generated/api";
import { useChatScroll } from "../../src/ui/hooks/useChatScroll";
import { KText, KVStack, KRow, KPressable, KImage, createStyles } from "../../src/ui";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { formatDateFR } from "../../src/shared/utils/formatDateFR";

// ══════════════════════════════════════════════════════════
// Types
// ══════════════════════════════════════════════════════════
type PendingMsg = { localId: string; text: string; status: "sending" | "failed"; createdAt: number };

// ══════════════════════════════════════════════════════════
// Status config
// ══════════════════════════════════════════════════════════
const STATUS_CFG: Record<string, { label: string; color: string; icon: string }> = {
  requested:                { label: "En attente",       color: "#F59E0B", icon: "time-outline" },
  accepted_pending_payment: { label: "Paiement requis",  color: "#3B82F6", icon: "card-outline" },
  confirmed:                { label: "Confirmée",        color: "#10B981", icon: "checkmark-circle" },
  pickup_pending:           { label: "Constat départ",   color: "#8B5CF6", icon: "camera-outline" },
  in_progress:              { label: "En cours",         color: "#10B981", icon: "car-sport" },
  dropoff_pending:          { label: "Constat retour",   color: "#8B5CF6", icon: "flag-outline" },
  completed:                { label: "Terminée",         color: "#6B7280", icon: "checkmark-done" },
  cancelled:                { label: "Annulée",          color: "#EF4444", icon: "close-circle" },
  rejected:                 { label: "Refusée",          color: "#EF4444", icon: "close-circle" },
};

const ACTION_STYLES: Record<string, { bg: string; fg: string; icon: string }> = {
  ACCEPT:         { bg: "#10B981", fg: "#FFF", icon: "checkmark-circle" },
  REJECT:         { bg: "transparent", fg: "#DC2626", icon: "close-circle" },
  PAY_NOW:        { bg: "#3B82F6", fg: "#FFF", icon: "card" },
  DEV_MARK_PAID:  { bg: "#F3F4F6", fg: "#374151", icon: "bug" },
  DO_CHECKIN:     { bg: "#8B5CF6", fg: "#FFF", icon: "camera" },
  DO_CHECKOUT:    { bg: "#8B5CF6", fg: "#FFF", icon: "camera" },
  TRIGGER_RETURN: { bg: "#F59E0B", fg: "#FFF", icon: "flag" },
  OWNER_CANCEL:   { bg: "transparent", fg: "#DC2626", icon: "ban" },
  LEAVE_REVIEW:   { bg: "#10B981", fg: "#FFF", icon: "star" },
};

// ══════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════
function getDayLabel(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (msgDay === today) return "Aujourd'hui";
  if (msgDay === today - 86400000) return "Hier";
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function getActionKey(route: string) {
  // "action:LEAVE_REVIEW:abc123" → "LEAVE_REVIEW"
  const parts = route.replace("action:", "").split(":");
  return parts[0];
}

let _localIdCounter = 0;
function genLocalId() { return `local_${Date.now()}_${++_localIdCounter}`; }

// ══════════════════════════════════════════════════════════
// Day Separator
// ══════════════════════════════════════════════════════════
function DaySep({ ts }: { ts: number }) {
  const { styles: s } = useBubbleStyles();
  return (
    <KRow style={s.daySep}>
      <View style={s.dayLine} />
      <KText variant="caption" bold style={s.dayText}>{getDayLabel(ts)}</KText>
      <View style={s.dayLine} />
    </KRow>
  );
}

// ══════════════════════════════════════════════════════════
// Banner (hidden when keyboard open)
// ══════════════════════════════════════════════════════════
function Banner({ reservation }: { reservation: any }) {
  const { styles: s, colors } = useBannerStyles();
  const vehicle = useQuery(api.vehicles.getVehicleWithImages, reservation?.vehicleId ? { id: reservation.vehicleId } : "skip");
  if (!vehicle || !reservation) return null;
  const cover = vehicle.resolvedImageUrls?.[0];
  const sc = STATUS_CFG[reservation.status] || { label: reservation.status, color: "#6B7280", icon: "ellipse" };
  return (
    <View style={s.banner}>
      <KPressable onPress={() => router.push(`/vehicle/${reservation.vehicleId}`)} style={s.row}>
        {cover ? <KImage source={{ uri: cover }} style={s.thumb} /> : (
          <View style={[s.thumb, s.thumbE]}><Ionicons name="car-outline" size={16} color={colors.textTertiary} /></View>
        )}
        <KVStack flex={1} gap={2}>
          <KText variant="label" bold numberOfLines={1} style={{ fontSize: 14 }}>{vehicle.title}</KText>
          <KText variant="caption" color="textSecondary">{vehicle.city} · {vehicle.pricePerDay} MAD/j</KText>
        </KVStack>
        <Ionicons name="chevron-forward" size={14} color={colors.textTertiary} />
      </KPressable>
      <KRow gap={8} style={s.statusLine}>
        <KRow gap={5} style={{ flex: 1, alignItems: "center" }}>
          <Ionicons name="calendar-outline" size={12} color={sc.color} />
          <KText variant="caption" bold style={{ color: sc.color }}>
            {reservation.startDate ? formatDateFR(reservation.startDate) : "—"} → {reservation.endDate ? formatDateFR(reservation.endDate) : "—"}
          </KText>
          <View style={[s.pill, { backgroundColor: sc.color + "18" }]}>
            <Ionicons name={sc.icon as any} size={10} color={sc.color} />
            <KText variant="caption" bold style={{ color: sc.color, fontSize: 10 }}>{sc.label}</KText>
          </View>
        </KRow>
        {reservation.totalAmount ? <KText variant="label" bold>{reservation.totalAmount} MAD</KText> : null}
      </KRow>
    </View>
  );
}
const useBannerStyles = createStyles((colors, isDark) => ({
  banner: {
    marginHorizontal: 14, marginBottom: 4, padding: 12, gap: 10,
    backgroundColor: isDark ? colors.bgTertiary : "#FAFBFC",
    borderRadius: 16, borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  thumb: { width: 44, height: 34, borderRadius: 8, backgroundColor: colors.bgTertiary },
  thumbE: { alignItems: "center", justifyContent: "center" },
  statusLine: { alignItems: "center" },
  pill: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 999 },
}));

// ══════════════════════════════════════════════════════════
// Welcome Card
// ══════════════════════════════════════════════════════════
function WelcomeCard({ text }: { text: string }) {
  const { colors, styles: s } = useWelcomeStyles();
  return (
    <View style={s.card}>
      <KRow gap={10} style={{ alignItems: "flex-start" }}>
        <View style={s.icon}><Ionicons name="shield-checkmark" size={16} color="#3B82F6" /></View>
        <KVStack flex={1} gap={4}>
          <KText variant="label" bold style={{ fontSize: 13 }}>Kreeny</KText>
          <KText variant="bodySmall" style={{ color: colors.textSecondary, lineHeight: 20 }}>{text}</KText>
        </KVStack>
      </KRow>
    </View>
  );
}
const useWelcomeStyles = createStyles((colors, isDark) => ({
  card: {
    marginVertical: 8, padding: 14,
    backgroundColor: isDark ? "rgba(59,130,246,0.08)" : "#EFF6FF",
    borderRadius: 16, borderWidth: 1, borderColor: isDark ? "rgba(59,130,246,0.15)" : "rgba(59,130,246,0.12)",
  },
  icon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: isDark ? "rgba(59,130,246,0.15)" : "#DBEAFE",
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
}));

// ══════════════════════════════════════════════════════════
// Kreeny Card (system msg + optional actions)
// ══════════════════════════════════════════════════════════
function KreenyCard({ text, actions, onAction }: { text: string; actions?: any[]; onAction: (a: any) => void }) {
  const { styles: s, colors } = useKcStyles();
  if (!text && (!actions || actions.length === 0)) return null;
  return (
    <View style={s.card}>
      <KRow gap={10} style={{ alignItems: "flex-start" }}>
        <View style={s.dot}><Ionicons name="chatbubble-ellipses" size={12} color={colors.primary} /></View>
        <KVStack flex={1} gap={actions?.length ? 10 : 0}>
          {text ? <KText variant="bodySmall" style={{ color: colors.text, lineHeight: 20 }}>{text}</KText> : null}
          {actions && actions.length > 0 && (
            <KVStack gap={6}>
              {actions.map((a: any, i: number) => {
                const key = getActionKey(a.route || "");
                const st = ACTION_STYLES[key] || { bg: colors.primary, fg: "#FFF", icon: "arrow-forward" };
                const outline = st.bg === "transparent";
                return (
                  <KPressable key={i} onPress={() => onAction(a)} style={[
                    s.btn,
                    outline ? { borderWidth: 1.5, borderColor: st.fg } : { backgroundColor: st.bg },
                  ]}>
                    <Ionicons name={st.icon as any} size={15} color={st.fg} />
                    <KText variant="label" bold style={{ color: st.fg, fontSize: 13 }}>{a.label}</KText>
                  </KPressable>
                );
              })}
            </KVStack>
          )}
        </KVStack>
      </KRow>
    </View>
  );
}
const useKcStyles = createStyles((colors, isDark) => ({
  card: {
    marginVertical: 6, padding: 14,
    backgroundColor: isDark ? "rgba(255,255,255,0.04)" : "#F8F9FB",
    borderRadius: 16, borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: isDark ? "rgba(59,130,246,0.12)" : "#EFF6FF",
    alignItems: "center", justifyContent: "center", marginTop: 1,
  },
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7,
    paddingVertical: 11, borderRadius: 12,
  },
}));

// ══════════════════════════════════════════════════════════
// Emoji reactions palette
// ══════════════════════════════════════════════════════════
const EMOJI_PALETTE = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function ReactionRow({ reactions, myUserId }: { reactions?: any[]; myUserId: string }) {
  const { styles: rs, colors } = useReactionStyles();
  if (!reactions?.length) return null;

  // Group by emoji
  const grouped: Record<string, { count: number; mine: boolean }> = {};
  for (const r of reactions) {
    if (!grouped[r.emoji]) grouped[r.emoji] = { count: 0, mine: false };
    grouped[r.emoji].count++;
    if (r.userId === myUserId) grouped[r.emoji].mine = true;
  }

  return (
    <View style={rs.row}>
      {Object.entries(grouped).map(([emoji, info]) => (
        <View key={emoji} style={[rs.pill, info.mine && rs.pillMine]}>
          <KText variant="caption" style={{ fontSize: 13, lineHeight: 16 }}>{emoji}</KText>
          {info.count > 1 && <KText variant="caption" style={rs.count}>{info.count}</KText>}
        </View>
      ))}
    </View>
  );
}
const useReactionStyles = createStyles((colors, isDark) => ({
  row: { flexDirection: "row" as const, flexWrap: "wrap" as const, gap: 4, marginTop: 2, marginHorizontal: 4 },
  pill: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 3,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 12,
    backgroundColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
  },
  pillMine: {
    backgroundColor: isDark ? "rgba(59,130,246,0.2)" : "rgba(59,130,246,0.12)",
    borderWidth: 1, borderColor: isDark ? "rgba(59,130,246,0.4)" : "rgba(59,130,246,0.3)",
  },
  count: { fontSize: 11, color: colors.textSecondary },
}));

// ══════════════════════════════════════════════════════════
// Message Bubble (with read receipts)
// ══════════════════════════════════════════════════════════
function Bubble({
  item, myUserId, myRole, otherAvatarUrl, otherName, otherLastReadAt, onAction, onRetry, onLongPress, prevItem,
}: {
  item: any; myUserId: string; myRole: string;
  otherAvatarUrl: string | null; otherName: string;
  otherLastReadAt: number;
  onAction: (a: any) => void; onRetry: (id: string) => void; onLongPress: (item: any) => void; prevItem: any;
}) {
  const { styles: s, colors } = useBubbleStyles();
  const showDay = !prevItem || getDayLabel(item.createdAt) !== getDayLabel(prevItem.createdAt);

  if (item.type === "welcome") return <>{showDay && <DaySep ts={item.createdAt} />}<WelcomeCard text={item.text} /></>;

  if (item.type === "system" || item.type === "actions") {
    if (!item.text && (!item.actions || item.actions.length === 0)) return null;
    return <>{showDay && <DaySep ts={item.createdAt} />}<KreenyCard text={item.text} actions={item.actions} onAction={onAction} /></>;
  }

  // ── User message ──
  const isMe = item.senderUserId === myUserId;
  const isPending = item._isPending;
  const isFailed = item._isFailed;
  const time = new Date(item.createdAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const sameSender = prevItem?.senderUserId === item.senderUserId && prevItem?.type === "user"
    && getDayLabel(item.createdAt) === getDayLabel(prevItem.createdAt);

  let receipt: "sending" | "sent" | "read" | "failed" = "sent";
  if (isFailed) receipt = "failed";
  else if (isPending) receipt = "sending";
  else if (isMe && otherLastReadAt >= item.createdAt) receipt = "read";

  return (
    <>
      {showDay && <DaySep ts={item.createdAt} />}
      {isMe ? (
        <Pressable onLongPress={() => onLongPress(item)} delayLongPress={350}>
          <View style={[s.row, s.rowMe]}>
            <View style={[s.bubble, s.bubbleMe, item.imageUrl && s.bubbleImg]}>
              {item.imageUrl && (
                <RNImage source={{ uri: item.imageUrl }} style={s.msgImg} resizeMode="cover" />
              )}
              {(item.text && item.text !== "📷 Photo") && (
                <KText variant="body" style={{ color: "#FFF", lineHeight: 20 }}>{item.text}</KText>
              )}
            </View>
            <ReactionRow reactions={item.reactions} myUserId={myUserId} />
            <KRow gap={4} style={s.metaMe}>
              <KText variant="caption" style={s.time}>{time}</KText>
              {receipt === "sending" && <ActivityIndicator size={8} color={colors.textTertiary} />}
              {receipt === "sent" && <Ionicons name="checkmark" size={12} color={colors.textTertiary} />}
              {receipt === "read" && <Ionicons name="checkmark-done" size={12} color="#3B82F6" />}
              {receipt === "failed" && (
                <KPressable onPress={() => onRetry(item.localId)} hitSlop={12}>
                  <Ionicons name="alert-circle" size={14} color="#EF4444" />
                </KPressable>
              )}
            </KRow>
          </View>
        </Pressable>
      ) : (
        <Pressable onLongPress={() => onLongPress(item)} delayLongPress={350}>
          <View style={[s.row, s.rowThem]}>
            {!sameSender ? (
              <View style={s.avCol}>
                {otherAvatarUrl ? <KImage source={{ uri: otherAvatarUrl }} style={s.av} /> : (
                  <View style={[s.av, s.avP]}><Ionicons name="person" size={12} color={colors.textTertiary} /></View>
                )}
              </View>
            ) : <View style={s.avSp} />}
            <KVStack style={{ flex: 1 }}>
              {!sameSender && <KText variant="caption" bold style={s.sender}>{otherName}</KText>}
              <View style={[s.bubble, s.bubbleThem, item.imageUrl && s.bubbleImg]}>
                {item.imageUrl && (
                  <RNImage source={{ uri: item.imageUrl }} style={s.msgImg} resizeMode="cover" />
                )}
                {(item.text && item.text !== "📷 Photo") && (
                  <KText variant="body" style={{ color: colors.text, lineHeight: 20 }}>{item.text}</KText>
                )}
              </View>
              <ReactionRow reactions={item.reactions} myUserId={myUserId} />
              <KText variant="caption" style={s.timeThem}>{time}</KText>
            </KVStack>
          </View>
        </Pressable>
      )}
    </>
  );
}

const useBubbleStyles = createStyles((colors, isDark) => ({
  daySep: { alignItems: "center", gap: 12, marginVertical: 14 },
  dayLine: { flex: 1, height: 1, backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.06)" },
  dayText: { color: colors.textTertiary, fontSize: 11 },
  row: { marginVertical: 2 },
  rowMe: { alignItems: "flex-end" },
  rowThem: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  avCol: { width: 28 },
  avSp: { width: 28 },
  av: { width: 28, height: 28, borderRadius: 14, overflow: "hidden" },
  avP: { backgroundColor: colors.bgTertiary, alignItems: "center", justifyContent: "center" },
  sender: { color: colors.textSecondary, fontSize: 11, marginBottom: 3, marginLeft: 4 },
  bubble: { maxWidth: "80%", paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleImg: { paddingHorizontal: 4, paddingTop: 4, paddingBottom: 6, overflow: "hidden" },
  msgImg: { width: 220, height: 220, borderRadius: 14, marginBottom: 2 },
  bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleThem: { backgroundColor: isDark ? colors.bgTertiary : "#F0F1F3", borderBottomLeftRadius: 6, alignSelf: "flex-start" },
  metaMe: { alignItems: "center", marginTop: 3, marginRight: 4 },
  time: { color: colors.textTertiary, fontSize: 10 },
  timeThem: { color: colors.textTertiary, fontSize: 10, marginTop: 3, marginLeft: 4 },
}));

// ══════════════════════════════════════════════════════════
// WhatsApp-style Context Menu (blur + emoji + actions)
// ══════════════════════════════════════════════════════════
function MessageContextMenu({
  item, isMe, onClose, onCopy, onReport, onReact,
}: {
  item: any; isMe: boolean;
  onClose: () => void;
  onCopy: () => void;
  onReport: () => void;
  onReact: (emoji: string) => void;
}) {
  const { styles: cm, colors, isDark } = useCtxStyles();
  const hasText = item.text && item.text !== "📷 Photo";

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={cm.overlay} onPress={onClose}>
        <BlurView intensity={Platform.OS === "ios" ? 40 : 20} tint={isDark ? "dark" : "light"} style={cm.blur}>
          <Pressable onPress={(e) => e.stopPropagation()} style={cm.content}>

            {/* ── Emoji reaction bar ── */}
            <View style={cm.emojiBar}>
              {EMOJI_PALETTE.map((emoji) => (
                <Pressable
                  key={emoji}
                  onPress={() => onReact(emoji)}
                  style={({ pressed }) => [cm.emojiBtn, pressed && cm.emojiBtnPressed]}
                >
                  <KText style={cm.emojiText}>{emoji}</KText>
                </Pressable>
              ))}
            </View>

            {/* ── Focused message bubble ── */}
            <View style={[cm.bubble, isMe ? cm.bubbleMe : cm.bubbleThem, isMe ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
              {item.imageUrl && (
                <RNImage source={{ uri: item.imageUrl }} style={cm.msgImg} resizeMode="cover" />
              )}
              {hasText && (
                <KText variant="body" style={{ color: isMe ? "#FFF" : colors.text, lineHeight: 20 }}>
                  {item.text}
                </KText>
              )}
            </View>

            {/* ── Action menu ── */}
            <View style={cm.menu}>
              {hasText && (
                <Pressable style={({ pressed }) => [cm.menuItem, pressed && cm.menuItemPressed]} onPress={onCopy}>
                  <Ionicons name="copy-outline" size={20} color={colors.text} />
                  <KText variant="body" style={{ color: colors.text, flex: 1 }}>Copier</KText>
                </Pressable>
              )}
              {!isMe && (
                <>
                  {hasText && <View style={cm.menuSep} />}
                  <Pressable style={({ pressed }) => [cm.menuItem, pressed && cm.menuItemPressed]} onPress={onReport}>
                    <Ionicons name="flag-outline" size={20} color="#EF4444" />
                    <KText variant="body" style={{ color: "#EF4444", flex: 1 }}>Signaler ce message</KText>
                  </Pressable>
                </>
              )}
            </View>

          </Pressable>
        </BlurView>
      </Pressable>
    </Modal>
  );
}

const useCtxStyles = createStyles((colors, isDark) => ({
  overlay: { flex: 1 },
  blur: { flex: 1, justifyContent: "center" as const, alignItems: "center" as const },
  content: {
    width: Dimensions.get("window").width - 48,
    gap: 10,
  },
  // Emoji bar
  emojiBar: {
    flexDirection: "row" as const, alignSelf: "center" as const,
    backgroundColor: isDark ? colors.bgSecondary : "#FFF",
    borderRadius: 30, paddingHorizontal: 8, paddingVertical: 8,
    gap: 2,
    ...(isDark
      ? { borderWidth: 1, borderColor: colors.cardBorder }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 8, elevation: 6 }
    ),
  },
  emojiBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center" as const, justifyContent: "center" as const },
  emojiBtnPressed: { backgroundColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.06)", transform: [{ scale: 1.15 }] },
  emojiText: { fontSize: 28, lineHeight: 36 },
  // Focused bubble
  bubble: {
    maxWidth: "85%" as any, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18,
    overflow: "hidden" as const,
  },
  bubbleMe: { backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  bubbleThem: { backgroundColor: isDark ? colors.bgTertiary : "#F0F1F3", borderBottomLeftRadius: 6 },
  msgImg: { width: 220, height: 220, borderRadius: 14, marginBottom: 2 },
  // Action menu
  menu: {
    alignSelf: "center" as const,
    backgroundColor: isDark ? colors.bgSecondary : "#FFF",
    borderRadius: 14, overflow: "hidden" as const, minWidth: 220,
    ...(isDark
      ? { borderWidth: 1, borderColor: colors.cardBorder }
      : { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 8 }
    ),
  },
  menuItem: {
    flexDirection: "row" as const, alignItems: "center" as const, gap: 14,
    paddingHorizontal: 18, paddingVertical: 15,
  },
  menuItemPressed: { backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)" },
  menuSep: { height: 1, backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.06)", marginHorizontal: 14 },
}));

// ══════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════
export default function ThreadScreen() {
  const { styles, colors, isDark } = useStyles();
  const { threadId } = useLocalSearchParams<{ threadId: string }>();
  const insets = useSafeAreaInsets();

  const runAction = useMutation(api.chatActions.runChatAction);
  const sendMessage = useMutation(api.chatSend.sendMessage);
  const sendImage = useMutation(api.chatSend.sendImage);
  const generateUploadUrl = useMutation(api.files.generateUploadUrl);
  const toggleReaction = useMutation(api.chatSend.toggleReaction);
  const submitReport = useMutation(api.reports.submitReport);
  const refreshActions = useMutation(api.chat.refreshThreadActions);
  const markRead = useMutation(api.chat.markThreadRead);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [pending, setPending] = useState<PendingMsg[]>([]);
  const [selectedMsg, setSelectedMsg] = useState<any>(null);

  // ═══════ KEYBOARD: Manual height tracking — iOS only (Android uses adjustResize) ═══════
  const [kbHeight, setKbHeight] = useState(0);
  const [kbVisibleAndroid, setKbVisibleAndroid] = useState(false);
  const kbVisible = Platform.OS === "ios" ? kbHeight > 0 : kbVisibleAndroid;

  useEffect(() => {
    if (Platform.OS === "ios") {
      const s1 = Keyboard.addListener("keyboardWillShow", (e) => setKbHeight(e.endCoordinates.height));
      const s2 = Keyboard.addListener("keyboardWillHide", () => setKbHeight(0));
      return () => { s1.remove(); s2.remove(); };
    } else {
      const s1 = Keyboard.addListener("keyboardDidShow", () => setKbVisibleAndroid(true));
      const s2 = Keyboard.addListener("keyboardDidHide", () => setKbVisibleAndroid(false));
      return () => { s1.remove(); s2.remove(); };
    }
  }, []);

  const { listRef, scrollToBottom, onMessagesReady } = useChatScroll();
  const inputRef = useRef<TextInput>(null);

  const thread = useQuery(api.chat.getThread, threadId ? { threadId: threadId as any } : "skip");
  const reservation = useQuery(api.reservations.getReservation, thread?.reservationId ? { id: thread.reservationId } : "skip");
  const messagesRaw = useQuery(api.chat.listMessages, threadId ? { threadId: threadId as any, limit: 200 } : "skip");

  useEffect(() => { if (threadId) markRead({ threadId: threadId as any }); }, [threadId, messagesRaw?.length]);

  const myUserId = thread?.myUserId ?? "";
  const myRole = thread?.myRole ?? "renter";

  const otherLastReadAt = useMemo(() => {
    if (!thread) return 0;
    return myRole === "renter"
      ? ((thread as any).ownerLastReadAt ?? 0)
      : ((thread as any).renterLastReadAt ?? 0);
  }, [thread, myRole]);

  const otherUserId = useMemo(() => {
    if (!thread) return null;
    return myRole === "renter" ? thread.ownerUserId : thread.renterUserId;
  }, [thread, myRole]);
  const otherProfile = useQuery(api.userProfiles.getPublicProfile, otherUserId ? { userId: otherUserId } : "skip");

  // Merge server + pending, filter visibility, sort chrono
  const messages = useMemo(() => {
    if (!messagesRaw) return null;
    const server = messagesRaw
      .filter((m: any) => {
        if (!m.visibility || m.visibility === "all") return true;
        return m.visibility === myRole;
      })
      .map((m: any) => ({ ...m, _isPending: false, _isFailed: false }));

    const serverTexts = new Set(server.filter((m: any) => m.senderUserId === myUserId).map((m: any) => m.text));
    const stillPending = pending.filter((p) => !serverTexts.has(p.text));
    const pendingMsgs = stillPending.map((p) => ({
      _id: p.localId, localId: p.localId,
      type: "user" as const, text: p.text, senderUserId: myUserId,
      createdAt: p.createdAt, _isPending: p.status === "sending", _isFailed: p.status === "failed",
    }));

    return [...server, ...pendingMsgs].sort((a, b) => a.createdAt - b.createdAt);
  }, [messagesRaw, myRole, myUserId, pending]);

  useEffect(() => { if (threadId) refreshActions({ threadId: threadId as any }); }, [threadId]);
  useEffect(() => { onMessagesReady(messages?.length ?? 0); }, [messages?.length]);
  // Scroll to bottom when keyboard opens
  useEffect(() => { if (kbVisible) setTimeout(() => scrollToBottom(true), 100); }, [kbVisible]);

  // ── Send ──
  const handleSend = useCallback(async () => {
    const text = draft.trim();
    if (!text || !threadId || sending) return;
    const localId = genLocalId();
    setPending((prev) => [...prev, { localId, text, status: "sending", createdAt: Date.now() }]);
    setDraft("");
    setSending(true);
    setTimeout(() => scrollToBottom(true), 50);
    try {
      await sendMessage({ threadId: threadId as any, text });
      setPending((prev) => prev.filter((p) => p.localId !== localId));
    } catch {
      setPending((prev) => prev.map((p) => p.localId === localId ? { ...p, status: "failed" as const } : p));
    } finally { setSending(false); }
  }, [draft, threadId, sending, sendMessage, scrollToBottom]);

  // ── Retry ──
  const handleRetry = useCallback(async (localId: string) => {
    const msg = pending.find((p) => p.localId === localId);
    if (!msg || !threadId) return;
    setPending((prev) => prev.map((p) => p.localId === localId ? { ...p, status: "sending" as const } : p));
    try {
      await sendMessage({ threadId: threadId as any, text: msg.text });
      setPending((prev) => prev.filter((p) => p.localId !== localId));
    } catch {
      setPending((prev) => prev.map((p) => p.localId === localId ? { ...p, status: "failed" as const } : p));
    }
  }, [pending, threadId, sendMessage]);

  // ── Pick & send image ──
  const handlePickImage = useCallback(async () => {
    if (!threadId || uploadingImage) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.7,
      });
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setUploadingImage(true);
      setTimeout(() => scrollToBottom(true), 50);

      // 1. Get upload URL
      const uploadUrl = await generateUploadUrl();

      // 2. Upload file
      const blob = await (await fetch(asset.uri)).blob();
      const uploadResp = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": asset.mimeType || "image/jpeg" },
        body: blob,
      });
      if (!uploadResp.ok) throw new Error("Upload failed");
      const { storageId } = await uploadResp.json();

      // 3. Send image message
      await sendImage({ threadId: threadId as any, storageId });
    } catch (e) {
      Alert.alert("Erreur", "Impossible d'envoyer l'image.");
    } finally {
      setUploadingImage(false);
    }
  }, [threadId, uploadingImage, generateUploadUrl, sendImage, scrollToBottom]);

  // ── Long press context menu ──
  const handleLongPress = useCallback((item: any) => {
    if (item._isPending || item._isFailed || item.type !== "user") return;
    haptic.medium();
    setSelectedMsg(item);
  }, []);

  const handleCopy = useCallback(async () => {
    if (!selectedMsg?.text) return;
    await Clipboard.setStringAsync(selectedMsg.text);
    setSelectedMsg(null);
  }, [selectedMsg]);

  const handleReact = useCallback(async (emoji: string) => {
    if (!selectedMsg?._id) return;
    setSelectedMsg(null);
    try {
      await toggleReaction({ messageId: selectedMsg._id, emoji });
    } catch { /* silently fail */ }
  }, [selectedMsg, toggleReaction]);

  const handleReportMsg = useCallback(() => {
    if (!selectedMsg) return;
    const msg = selectedMsg;
    setSelectedMsg(null);
    Alert.alert(
      "Signaler ce message ?",
      `"${(msg.text || "").slice(0, 80)}${(msg.text || "").length > 80 ? "…" : ""}"`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Signaler",
          style: "destructive",
          onPress: async () => {
            try {
              await submitReport({
                targetType: "message",
                targetId: String(msg._id),
                reason: "inappropriate",
                messageText: msg.text || "📷 Photo",
              });
              Alert.alert("Signalement envoyé", "Notre équipe va examiner ce message.");
            } catch (e: any) {
              if (e?.data === "AlreadyReported") {
                Alert.alert("Déjà signalé", "Tu as déjà signalé ce message.");
              } else {
                Alert.alert("Erreur", "Impossible d'envoyer le signalement.");
              }
            }
          },
        },
      ]
    );
  }, [selectedMsg, submitReport]);

  // ── Actions ──
  const handleAction = useCallback((a: any) => {
    if (!threadId || !thread) return;
    const doAction = async (name: string) => {
      try {
        const res = await runAction({ threadId: threadId as any, action: name as any });
        if (!res.ok) Alert.alert("Indisponible", "Cette action n'est plus disponible.");
      } catch (e) { Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur"); }
    };
    const confirm = (title: string, msg: string, onOk: () => void) => {
      Alert.alert(title, msg, [{ text: "Annuler", style: "cancel" }, { text: "Confirmer", onPress: onOk }]);
    };

    const key = getActionKey(a.route || "");
    if (key === "ACCEPT") { confirm("Accepter ?", "Le locataire devra procéder au paiement.", () => doAction("ACCEPT")); return; }
    if (key === "REJECT") { confirm("Décliner ?", "Les dates seront libérées.", () => doAction("REJECT")); return; }
    if (key === "PAY_NOW") { if (reservation) router.push(`/payment/${String(reservation._id)}`); return; }
    if (key === "DEV_MARK_PAID") { doAction("DEV_MARK_PAID"); return; }
    if (key === "TRIGGER_RETURN") { confirm("Déclarer le retour ?", "Le constat retour sera lancé.", () => doAction("TRIGGER_RETURN")); return; }
    if (key === "OWNER_CANCEL") { confirm("Annuler ?", "Irréversible.", () => doAction("OWNER_CANCEL")); return; }

    const rid = String(thread.reservationId);
    if (key === "DO_CHECKIN") { router.push(`/reservation/${rid}/report?phase=checkin`); return; }
    if (key === "DO_CHECKOUT") { router.push(`/reservation/${rid}/report?phase=checkout`); return; }

    // ── Laisser un avis ──
    if (key === "LEAVE_REVIEW") {
      // Extract reservationId from route "action:LEAVE_REVIEW:resId" or use thread's
      const parts = (a.route || "").split(":");
      const reviewResId = parts[2] || rid;
      router.push(`/review/${reviewResId}`);
      return;
    }

    if (a.route?.startsWith("/")) router.push(a.route as any);
  }, [threadId, thread, reservation, runAction]);

  const handleDetails = useCallback(() => {
    if (thread?.reservationId) router.push(`/reservation/details/${String(thread.reservationId)}`);
  }, [thread]);

  // ══════════════════════════════════════════════════════════
  // RENDER — NO KeyboardAvoidingView, manual paddingBottom
  // ══════════════════════════════════════════════════════════
  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: kbHeight > 0 ? kbHeight : 0 }]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* ── Header ── */}
      <KRow gap={10} style={styles.header}>
        <KPressable onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <KPressable onPress={() => otherUserId && router.push(`/profile/${otherUserId}`)}>
          {otherProfile?.avatarUrl ? (
            <KImage source={{ uri: otherProfile.avatarUrl }} style={styles.hAv} />
          ) : (
            <View style={[styles.hAv, styles.hAvP]}><Ionicons name="person" size={16} color={colors.textTertiary} /></View>
          )}
        </KPressable>
        <KVStack flex={1} gap={1}>
          <KText variant="label" bold style={{ fontSize: 15 }}>{otherProfile?.displayName ?? "Conversation"}</KText>
          {reservation && (
            <KRow gap={4} style={{ alignItems: "center" }}>
              <View style={[styles.statusDot, { backgroundColor: STATUS_CFG[reservation.status]?.color ?? "#6B7280" }]} />
              <KText variant="caption" color="textSecondary" style={{ fontSize: 11 }}>{STATUS_CFG[reservation.status]?.label ?? reservation.status}</KText>
            </KRow>
          )}
        </KVStack>
        <KPressable onPress={handleDetails}>
          <KText variant="label" bold style={{ color: colors.primary, fontSize: 13 }}>Détails</KText>
        </KPressable>
      </KRow>

      {/* ── Banner (hidden when keyboard visible) ── */}
      {!kbVisible && thread && reservation && (
        <>
          <Banner reservation={reservation} />
          <View style={styles.sep} />
        </>
      )}

      {/* ── Messages ── */}
      {!messages ? (
        <KVStack align="center" justify="center" style={{ flex: 1 }}>
          <KText variant="body" color="textSecondary">Chargement…</KText>
        </KVStack>
      ) : (
        <FlatList
          ref={listRef}
          style={{ flex: 1 }}
          data={messages}
          keyExtractor={(m) => String(m._id)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 4, paddingBottom: 4 }}
          renderItem={({ item, index }) => (
            <Bubble
              item={item}
              myUserId={myUserId}
              myRole={myRole}
              otherAvatarUrl={otherProfile?.avatarUrl ?? null}
              otherName={otherProfile?.displayName ?? "Utilisateur"}
              otherLastReadAt={otherLastReadAt}
              onAction={handleAction}
              onRetry={handleRetry}
              onLongPress={handleLongPress}
              prevItem={index > 0 ? messages[index - 1] : null}
            />
          )}
        />
      )}

      {/* ── Input bar ── */}
      <KRow gap={8} style={[styles.input, { paddingBottom: kbVisible ? 4 : Math.max(insets.bottom, 8) }]}>
        <KPressable
          onPress={handlePickImage}
          disabled={uploadingImage}
          hitSlop={8}
          style={styles.imgBtn}
        >
          {uploadingImage
            ? <ActivityIndicator size={18} color={colors.primary} />
            : <Ionicons name="image-outline" size={22} color={colors.primary} />
          }
        </KPressable>
        <TextInput
          ref={inputRef}
          placeholder="Écris un message…"
          placeholderTextColor={colors.inputPlaceholder}
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
          multiline
          style={styles.textInput}
        />
        <KPressable
          onPress={handleSend}
          disabled={!draft.trim() || sending}
          style={[styles.sendBtn, { backgroundColor: draft.trim() && !sending ? colors.primary : colors.bgTertiary }]}
        >
          <Ionicons name="arrow-up" size={18} color={draft.trim() && !sending ? "#FFF" : colors.textTertiary} />
        </KPressable>
      </KRow>

      {/* ── WhatsApp-style context menu ── */}
      {selectedMsg && (
        <MessageContextMenu
          item={selectedMsg}
          isMe={selectedMsg.senderUserId === myUserId}
          onClose={() => setSelectedMsg(null)}
          onCopy={handleCopy}
          onReport={handleReportMsg}
          onReact={handleReact}
        />
      )}
    </View>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 14, paddingVertical: 8, alignItems: "center" },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  hAv: { width: 36, height: 36, borderRadius: 18, overflow: "hidden" },
  hAvP: { backgroundColor: isDark ? colors.bgTertiary : "#E5E7EB", alignItems: "center", justifyContent: "center" },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  sep: { height: 1, backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.06)", marginTop: 4 },
  input: {
    borderTopWidth: 1, borderTopColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
    paddingHorizontal: 14, paddingTop: 8, alignItems: "flex-end",
  },
  textInput: {
    flex: 1, borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.1)",
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
    color: colors.inputText, fontSize: 14, maxHeight: 100,
    backgroundColor: isDark ? colors.bgTertiary : "#FAFBFC",
  },
  imgBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  sendBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
}));
