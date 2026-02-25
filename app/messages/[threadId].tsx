import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery } from "convex/react";
import * as Clipboard from "expo-clipboard";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useTheme } from "../../src/theme";
import { useChatScroll } from "../../src/ui/hooks/useChatScroll";

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function startOfDay(d: Date | number) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dayKey(ts: number) {
  return startOfDay(ts).toISOString().slice(0, 10);
}

function dayLabel(ts: number): string {
  const d = startOfDay(ts);
  const today = startOfDay(new Date());
  const diff = Math.round((today.getTime() - d.getTime()) / 86400000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Hier";
  return new Date(ts).toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" });
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function formatDateShortFR(dateStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(y, m - 1, d));
  } catch {
    return dateStr || "—";
  }
}

// ═══════════════════════════════════════════════════════
// Date Separator
// ═══════════════════════════════════════════════════════
function DateSeparator({ label, colors }: { label: string; colors: any }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginVertical: 14 }}>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
      <Text style={{ marginHorizontal: 12, fontSize: 12, fontWeight: "600", color: colors.textTertiary }}>
        {label}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// System Message — with primary/secondary action buttons
// ═══════════════════════════════════════════════════════
function SystemMessage({
  text,
  actions,
  threadId,
  thread,
  runAction,
  colors,
  isDark,
}: {
  text: string;
  actions?: { label: string; route: string }[];
  threadId: string;
  thread: any;
  runAction: any;
  colors: any;
  isDark: boolean;
}) {
  const handleAction = async (a: { label: string; route: string }) => {
    if (a.route === "action:PAY_NOW") {
      const res = await runAction({ threadId: threadId as any, action: "PAY_NOW" });
      if (!res.ok) { Alert.alert("Indisponible", "Cette action n'est plus disponible."); return; }
      Alert.alert("OK", "Paiement initialisé.");
      return;
    }
    if (a.route === "action:DEV_MARK_PAID") {
      const res = await runAction({ threadId: threadId as any, action: "DEV_MARK_PAID" });
      if (!res.ok) { Alert.alert("Indisponible"); return; }
      Alert.alert("OK", "Paiement simulé ✅");
      return;
    }
    if (a.route === "action:CANCEL_RESERVATION") {
      Alert.alert("Annuler la réservation", "Es-tu sûr ? Cette action est irréversible.", [
        { text: "Non", style: "cancel" },
        {
          text: "Oui, annuler", style: "destructive",
          onPress: async () => {
            const res = await runAction({ threadId: threadId as any, action: "CANCEL_RESERVATION" });
            if (!res.ok) { Alert.alert("Erreur", "Impossible d'annuler."); return; }
            Alert.alert("OK", "Réservation annulée.");
          },
        },
      ]);
      return;
    }
    if (a.route === "action:DEV_DROPOFF_PENDING") {
      const res = await runAction({ threadId: threadId as any, action: "DEV_DROPOFF_PENDING" });
      if (!res.ok) { Alert.alert("Indisponible"); return; }
      Alert.alert("OK", "Retour simulé ✅");
      return;
    }
    if (!thread) return;
    const reservationId = String(thread.reservationId);
    if (a.route === "action:DO_CHECKIN") { router.push(`/reservation/${reservationId}/report?phase=checkin`); return; }
    if (a.route === "action:DO_CHECKOUT") { router.push(`/reservation/${reservationId}/report?phase=checkout`); return; }
    if (a.route === "action:OPEN_RESERVATION") { router.push("/profile/reservations"); return; }
    if (a.route.startsWith("/")) router.push(a.route as any);
  };

  const isPrimary = (route: string) =>
    route.includes("PAY_NOW") || route.includes("DO_CHECKIN") || route.includes("DO_CHECKOUT");
  const isDanger = (route: string) => route.includes("CANCEL");

  return (
    <View
      style={{
        alignSelf: "center",
        maxWidth: "92%",
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 16,
        backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.05)",
        marginBottom: 10,
      }}
    >
      <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 18 }}>
        {text}
      </Text>

      {actions && actions.length > 0 && (
        <View style={{ marginTop: 10, gap: 8 }}>
          {actions.map((a, idx) => (
            <Pressable
              key={idx}
              testID={`system-action-${idx}`}
              onPress={() => handleAction(a)}
              style={({ pressed }) => ({
                height: 38,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                paddingHorizontal: 14,
                backgroundColor: isDanger(a.route)
                  ? (isDark ? "rgba(239,68,68,0.1)" : "#FEF2F2")
                  : isPrimary(a.route)
                    ? colors.primary
                    : (isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.03)"),
                borderWidth: isPrimary(a.route) ? 0 : 1,
                borderColor: isDanger(a.route)
                  ? "rgba(239,68,68,0.15)"
                  : isDark ? colors.border : "rgba(0,0,0,0.08)",
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Text
                style={{
                  fontSize: 13,
                  fontWeight: "800",
                  color: isDanger(a.route)
                    ? "#EF4444"
                    : isPrimary(a.route)
                      ? "#FFF"
                      : colors.text,
                }}
              >
                {a.label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// User Bubble — premium (bigger, timestamps, read receipts)
// ═══════════════════════════════════════════════════════
function UserBubble({
  text,
  isMine,
  time,
  onLongPress,
  colors,
  isDark,
}: {
  text: string;
  isMine: boolean;
  time: number;
  onLongPress: () => void;
  colors: any;
  isDark: boolean;
}) {
  return (
    <View style={{ alignItems: isMine ? "flex-end" : "flex-start", marginBottom: 6 }}>
      <Pressable
        onLongPress={onLongPress}
        delayLongPress={250}
        style={({ pressed }) => ({
          maxWidth: "85%",
          backgroundColor: isMine ? colors.primary : (isDark ? colors.bgTertiary : "#F0F2F5"),
          borderRadius: 20,
          borderBottomRightRadius: isMine ? 6 : 20,
          borderBottomLeftRadius: isMine ? 20 : 6,
          paddingHorizontal: 16,
          paddingVertical: 12,
          opacity: pressed ? 0.92 : 1,
        })}
      >
        <Text style={{ fontSize: 15, color: isMine ? "#FFF" : colors.text, lineHeight: 22 }}>
          {text}
        </Text>
      </Pressable>

      {/* Meta row — time + checks */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginTop: 4,
          ...(isMine ? { marginRight: 6 } : { marginLeft: 6 }),
        }}
      >
        <Text style={{ fontSize: 11, color: colors.textTertiary }}>
          {formatTime(time)}
        </Text>
        {isMine && (
          <Ionicons
            name="checkmark-done"
            size={15}
            color={colors.primary}
            style={{ marginLeft: 4, opacity: 0.85 }}
          />
        )}
      </View>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Action Sheet (Copier)
// ═══════════════════════════════════════════════════════
function MessageActionSheet({
  visible,
  message,
  onClose,
  colors,
  isDark,
}: {
  visible: boolean;
  message: any;
  onClose: () => void;
  colors: any;
  isDark: boolean;
}) {
  const sheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(sheetAnim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  const close = () => {
    Animated.timing(sheetAnim, { toValue: 0, duration: 160, useNativeDriver: true }).start(() => onClose());
  };

  const onCopy = async () => {
    if (message?.text) {
      await Clipboard.setStringAsync(String(message.text));
    }
    close();
  };

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }} onPress={close} />
      <Animated.View
        style={{
          position: "absolute", left: 0, right: 0, bottom: 0,
          paddingTop: 10, paddingBottom: 24, paddingHorizontal: 14,
          backgroundColor: colors.bgElevated,
          borderTopLeftRadius: 22, borderTopRightRadius: 22,
          borderTopWidth: 1, borderTopColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
          transform: [{
            translateY: sheetAnim.interpolate({ inputRange: [0, 1], outputRange: [320, 0] }),
          }],
          opacity: sheetAnim,
        }}
      >
        {/* Handle */}
        <View style={{ alignSelf: "center", width: 44, height: 5, borderRadius: 999, backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.15)", marginBottom: 14 }} />

        <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>Actions</Text>
        <Text numberOfLines={1} style={{ marginTop: 4, fontSize: 12, color: colors.textSecondary }}>
          {message?.text || ""}
        </Text>

        <View
          style={{
            marginTop: 14, borderRadius: 16, overflow: "hidden",
            backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.03)",
            borderWidth: 1, borderColor: isDark ? colors.border : "rgba(0,0,0,0.05)",
          }}
        >
          <Pressable
            testID="action-copy"
            onPress={onCopy}
            style={({ pressed }) => ({
              flexDirection: "row", alignItems: "center",
              paddingVertical: 12, paddingHorizontal: 12,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <View
              style={{
                width: 32, height: 32, borderRadius: 10,
                backgroundColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
                alignItems: "center", justifyContent: "center", marginRight: 10,
              }}
            >
              <Ionicons name="copy-outline" size={18} color={colors.text} />
            </View>
            <Text style={{ fontSize: 14, fontWeight: "600", color: colors.text }}>Copier</Text>
          </Pressable>
        </View>

        <Pressable
          testID="action-cancel"
          onPress={close}
          style={({ pressed }) => ({
            marginTop: 12, height: 44, borderRadius: 14,
            alignItems: "center", justifyContent: "center",
            backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.05)",
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.text }}>Annuler</Text>
        </Pressable>
      </Animated.View>
    </Modal>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function ThreadScreen() {
  const { colors, isDark } = useTheme();
  const params = useLocalSearchParams<{ threadId: string }>();
  const threadId = params.threadId;

  const runAction = useMutation(api.chatActions.runChatAction);
  const sendMessage = useMutation(api.chatSend.sendMessage);
  const refreshActions = useMutation(api.chat.refreshThreadActions);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [actionMsg, setActionMsg] = useState<any>(null);

  const { listRef, scrollToBottom, onMessagesReady } = useChatScroll();

  const thread = useQuery(api.chat.getThread, threadId ? { threadId: threadId as any } : "skip");
  const messagesRaw = useQuery(api.chat.listMessages, threadId ? { threadId: threadId as any, limit: 200 } : "skip");

  const messages = useMemo(() => {
    if (!messagesRaw) return null;
    return [...messagesRaw].reverse();
  }, [messagesRaw]);

  // Build list data with date separators
  const listData = useMemo(() => {
    if (!messages) return [];
    const out: any[] = [];
    let lastKey: string | null = null;

    for (const m of messages) {
      const k = dayKey(m.createdAt);
      if (k !== lastKey) {
        out.push({ _id: `sep-${k}`, _type: "separator", label: dayLabel(m.createdAt) });
        lastKey = k;
      }
      out.push(m);
    }
    return out;
  }, [messages]);

  useEffect(() => {
    if (!threadId) return;
    refreshActions({ threadId: threadId as any });
  }, [threadId, refreshActions]);

  useEffect(() => {
    onMessagesReady(messages?.length ?? 0);
  }, [messages?.length, onMessagesReady]);

  const onSend = async () => {
    if (!draft.trim() || !threadId) return;
    const text = draft.trim();
    setDraft("");
    Keyboard.dismiss();
    setSending(true);
    try {
      await sendMessage({ threadId: threadId as any, text });
      scrollToBottom(true);
    } catch {
      Alert.alert("Erreur", "Impossible d'envoyer le message.");
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const getIsMine = (msg: any) => {
    if (!thread || !msg.senderUserId) return false;
    return msg.senderUserId === thread.renterUserId || msg.senderUserId === thread.ownerUserId
      ? msg.senderUserId === thread.renterUserId
      : false;
  };

  return (
    <SafeAreaView testID="thread-screen" style={{ flex: 1, backgroundColor: colors.bg }} edges={["top", "bottom"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <View
        style={{
          flexDirection: "row", alignItems: "center", gap: 12,
          paddingHorizontal: 14, height: 56,
          borderBottomWidth: 1,
          borderBottomColor: isDark ? colors.border : "rgba(0,0,0,0.05)",
        }}
      >
        <Pressable
          testID="thread-back-btn"
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.5 : 1 })}
        >
          <View
            style={{
              width: 36, height: 36, borderRadius: 12,
              backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </View>
        </Pressable>

        <View
          style={{
            width: 38, height: 38, borderRadius: 19,
            backgroundColor: colors.primaryLight,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="person-outline" size={16} color={colors.primary} />
        </View>

        <View style={{ flex: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>
            Conversation
          </Text>
          {thread && (
            <Text numberOfLines={1} style={{ fontSize: 12, color: colors.textSecondary }}>
              Réservation #{String(thread.reservationId).slice(-6)}
            </Text>
          )}
        </View>
      </View>

      {/* Messages + composer */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        {!messages ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Chargement…</Text>
          </View>
        ) : messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 }}>
            <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.textTertiary} />
            <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center" }}>
              Commence la conversation !
            </Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={listData}
            keyExtractor={(item: any) => String(item._id)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ paddingHorizontal: 14, paddingVertical: 8, paddingBottom: 10 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => scrollToBottom(false)}
            renderItem={({ item }: any) => {
              // Date separator
              if (item._type === "separator") {
                return <DateSeparator label={item.label} colors={colors} />;
              }

              // System message
              if (item.type === "system") {
                return (
                  <SystemMessage
                    text={item.text}
                    threadId={threadId!}
                    thread={thread}
                    runAction={runAction}
                    colors={colors}
                    isDark={isDark}
                  />
                );
              }

              // Actions message
              if (item.type === "actions" && item.actions?.length) {
                return (
                  <SystemMessage
                    text={item.text}
                    actions={item.actions}
                    threadId={threadId!}
                    thread={thread}
                    runAction={runAction}
                    colors={colors}
                    isDark={isDark}
                  />
                );
              }

              // User message
              if (item.type === "user") {
                return (
                  <UserBubble
                    text={item.text}
                    isMine={getIsMine(item)}
                    time={item.createdAt}
                    onLongPress={() => setActionMsg(item)}
                    colors={colors}
                    isDark={isDark}
                  />
                );
              }

              // Fallback
              return (
                <View style={{ alignSelf: "center", paddingVertical: 4 }}>
                  <Text style={{ fontSize: 12, color: colors.textTertiary }}>{item.text}</Text>
                </View>
              );
            }}
          />
        )}

        {/* Input Bar — WhatsApp style */}
        <View
          style={{
            flexDirection: "row", alignItems: "flex-end", gap: 10,
            paddingHorizontal: 12, paddingVertical: 10,
            borderTopWidth: 1,
            borderTopColor: isDark ? colors.border : "rgba(0,0,0,0.05)",
            backgroundColor: colors.bg,
          }}
        >
          <View
            style={{
              flex: 1, flexDirection: "row", alignItems: "flex-end",
              backgroundColor: colors.inputBg,
              borderRadius: 22,
              borderWidth: 1,
              borderColor: isDark ? colors.inputBorder : "rgba(0,0,0,0.06)",
              paddingHorizontal: 16,
              paddingVertical: Platform.OS === "ios" ? 10 : 6,
              minHeight: 44, maxHeight: 120,
            }}
          >
            <TextInput
              testID="chat-input"
              value={draft}
              onChangeText={setDraft}
              placeholder="Écris un message…"
              placeholderTextColor={colors.inputPlaceholder}
              multiline
              autoCorrect
              spellCheck
              autoCapitalize="sentences"
              returnKeyType="send"
              blurOnSubmit={false}
              onSubmitEditing={onSend}
              onFocus={() => setTimeout(() => scrollToBottom(true), 80)}
              style={{
                flex: 1, fontSize: 15, color: colors.inputText,
                maxHeight: 100, lineHeight: 20,
              }}
            />
          </View>

          <Pressable
            testID="chat-send-btn"
            onPress={onSend}
            disabled={!draft.trim() || sending}
            style={({ pressed }) => ({
              width: 44, height: 44, borderRadius: 22,
              backgroundColor: draft.trim() ? colors.primary : (isDark ? colors.bgTertiary : "#E8EBF0"),
              alignItems: "center", justifyContent: "center",
              opacity: pressed ? 0.75 : 1,
            })}
          >
            <Ionicons
              name="send"
              size={18}
              color={draft.trim() ? "#FFF" : colors.textTertiary}
            />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Action Sheet */}
      <MessageActionSheet
        visible={!!actionMsg}
        message={actionMsg}
        onClose={() => setActionMsg(null)}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}