import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "convex/react";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { useTheme } from "../../src/theme";

// ═══════════════════════════════════════════════════════
// Helpers — Smart time (Airbnb-like)
// ═══════════════════════════════════════════════════════
function startOfDay(x: Date | number) {
  const d = new Date(x);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatTimeSmart(ts: number | string | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";

  const today = startOfDay(new Date());
  const day = startOfDay(d);
  const diff = Math.round((today.getTime() - day.getTime()) / 86400000);

  if (diff === 0) return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (diff === 1) return "Hier";
  if (diff >= 2 && diff <= 6) {
    const w = d.toLocaleDateString("fr-FR", { weekday: "short" });
    return w.charAt(0).toUpperCase() + w.slice(1).replace(".", "") + ".";
  }
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}

// ═══════════════════════════════════════════════════════
// Highlight text (search)
// ═══════════════════════════════════════════════════════
function HighlightText({
  text,
  query,
  style,
  highlightColor,
  numberOfLines,
}: {
  text: string;
  query: string;
  style: any;
  highlightColor: string;
  numberOfLines?: number;
}) {
  const t = String(text || "");
  const q = String(query || "").trim();
  if (!q) return <Text style={style} numberOfLines={numberOfLines}>{t}</Text>;

  const idx = t.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <Text style={style} numberOfLines={numberOfLines}>{t}</Text>;

  return (
    <Text style={style} numberOfLines={numberOfLines}>
      {t.slice(0, idx)}
      <Text style={{ backgroundColor: highlightColor, borderRadius: 4 }}>
        {t.slice(idx, idx + q.length)}
      </Text>
      {t.slice(idx + q.length)}
    </Text>
  );
}

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function MessagesSkeleton() {
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
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingHorizontal: 14 }}>
      {/* Search skeleton */}
      <Box w="100%" h={40} r={12} style={{ marginTop: 10, marginBottom: 14 }} />
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 }}>
          <Box w={56} h={56} r={16} />
          <View style={{ flex: 1, gap: 6 }}>
            <Box w="55%" h={14} />
            <Box w="40%" h={12} />
            <Box w="75%" h={12} />
          </View>
          <Box w={34} h={12} />
        </View>
      ))}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Not Authenticated
// ═══════════════════════════════════════════════════════
function NotAuthenticated({ colors, isDark }: { colors: any; isDark: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
      <View
        style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons name="chatbubbles-outline" size={28} color={colors.textTertiary} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: "700", color: colors.text, textAlign: "center" }}>
        Connecte-toi pour voir tes conversations
      </Text>
      <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
        Discute directement avec les propriétaires et locataires.
      </Text>
      <Pressable
        testID="messages-login-btn"
        onPress={() => router.push("/login")}
        style={({ pressed }) => ({
          backgroundColor: colors.primary, borderRadius: 14,
          paddingVertical: 14, paddingHorizontal: 32,
          opacity: pressed ? 0.85 : 1, marginTop: 8,
        })}
      >
        <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Se connecter</Text>
      </Pressable>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Empty State
// ═══════════════════════════════════════════════════════
function EmptyState({ colors, isDark, hasQuery }: { colors: any; isDark: boolean; hasQuery: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 }}>
      <View
        style={{
          width: 64, height: 64, borderRadius: 32,
          backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
          alignItems: "center", justifyContent: "center",
        }}
      >
        <Ionicons name={hasQuery ? "search-outline" : "chatbubble-outline"} size={26} color={colors.textTertiary} />
      </View>
      <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text, textAlign: "center" }}>
        {hasQuery ? "Aucun résultat" : "Aucune conversation"}
      </Text>
      <Text style={{ fontSize: 13, color: colors.textSecondary, textAlign: "center", lineHeight: 19 }}>
        {hasQuery
          ? "Essaie avec un autre mot-clé."
          : "Une conversation se crée automatiquement quand tu envoies une demande de réservation."}
      </Text>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Thread Card — WhatsApp/Airbnb style
// ═══════════════════════════════════════════════════════
function ThreadCard({
  thread,
  query,
  colors,
  isDark,
}: {
  thread: any;
  query: string;
  colors: any;
  isDark: boolean;
}) {
  const lastTime = thread.lastMessageAt ?? thread.createdAt;
  const highlightColor = isDark ? "rgba(96,165,250,0.25)" : "rgba(59,130,246,0.15)";

  return (
    <Pressable
      testID={`thread-card-${String(thread._id)}`}
      onPress={() => router.push(`/messages/${String(thread._id)}`)}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderRadius: 20,
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
        marginBottom: 10,
        opacity: pressed ? 0.85 : 1,
      })}
    >
      {/* Media wrap — vehicle fallback + user overlay */}
      <View style={{ width: 56, height: 56, borderRadius: 16, position: "relative" }}>
        <View
          style={{
            width: 56, height: 56, borderRadius: 16,
            backgroundColor: colors.primaryLight,
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="car-sport" size={22} color={colors.primary} />
        </View>
        {/* User avatar overlay */}
        <View
          style={{
            position: "absolute", right: -4, bottom: -4,
            width: 24, height: 24, borderRadius: 12,
            borderWidth: 2, borderColor: colors.card,
            backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.2)",
            alignItems: "center", justifyContent: "center",
          }}
        >
          <Ionicons name="person" size={12} color="#FFF" />
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {/* Top row: title + time */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <HighlightText
            text="Conversation"
            query={query}
            style={{ flex: 1, fontSize: 15, fontWeight: "800", color: colors.text }}
            highlightColor={highlightColor}
            numberOfLines={1}
          />
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textTertiary }}>
              {formatTimeSmart(lastTime)}
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
          </View>
        </View>

        {/* Reservation ref */}
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "600", color: colors.textSecondary, marginTop: 2 }}>
          Réservation #{String(thread.reservationId).slice(-6)}
        </Text>
      </View>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function MessagesScreen() {
  const { colors, isDark } = useTheme();
  const { isLoading, isAuthenticated } = useAuthStatus();
  const [query, setQuery] = useState("");
  const insets = useSafeAreaInsets();

  const threads = useQuery(api.chat.listMyThreads, isAuthenticated ? {} : "skip");

  // Filter threads by search query
  const filtered = useMemo(() => {
    if (!threads) return [];
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t: any) => {
      const resId = String(t.reservationId || "").toLowerCase();
      return resId.includes(q);
    });
  }, [threads, query]);

  if (isLoading) return <MessagesSkeleton />;

  if (!isAuthenticated) {
    return (
      <View testID="messages-screen" style={{ flex: 1, backgroundColor: colors.bg }}>
        <NotAuthenticated colors={colors} isDark={isDark} />
      </View>
    );
  }

  if (threads === undefined) return <MessagesSkeleton />;

  return (
    <View testID="messages-screen" style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 4 }}>
        <Text style={{ fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5 }}>
          Messages
        </Text>
        <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>
          Tes conversations
        </Text>
      </View>

      {/* Search bar */}
      {threads.length > 0 && (
        <View style={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 6 }}>
          <View
            style={{
              flexDirection: "row", alignItems: "center", gap: 8,
              height: 40, paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)",
              borderWidth: 1,
              borderColor: isDark ? colors.border : "rgba(0,0,0,0.05)",
            }}
          >
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              testID="messages-search-input"
              value={query}
              onChangeText={setQuery}
              placeholder="Rechercher une conversation…"
              placeholderTextColor={colors.inputPlaceholder}
              style={{
                flex: 1, height: 40, fontSize: 13, fontWeight: "500",
                color: colors.inputText,
              }}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <Pressable testID="messages-search-clear" onPress={() => setQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </Pressable>
            )}
          </View>
        </View>
      )}

      {filtered.length === 0 ? (
        <EmptyState colors={colors} isDark={isDark} hasQuery={query.trim().length > 0} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t: any) => String(t._id)}
          contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ThreadCard thread={item} query={query} colors={colors} isDark={isDark} />
          )}
        />
      )}
    </View>
  );
}