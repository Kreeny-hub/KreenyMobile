import { Ionicons } from "@expo/vector-icons";
import { useQuery, useMutation } from "convex/react";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Animated, FlatList, TextInput, View, Alert } from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { KText, KVStack, KRow, KPressable, KImage, KEmptyState, createStyles } from "../../src/ui";
import { skeletonPulse } from "../../src/theme";

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
function HighlightText({ text, query, style, highlightColor, numberOfLines }: {
  text: string; query: string; style: any; highlightColor: string; numberOfLines?: number;
}) {
  const t = String(text || "");
  const q = String(query || "").trim();
  if (!q) return <KText style={style} numberOfLines={numberOfLines}>{t}</KText>;
  const idx = t.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <KText style={style} numberOfLines={numberOfLines}>{t}</KText>;
  return (
    <KText style={style} numberOfLines={numberOfLines}>
      {t.slice(0, idx)}
      <KText style={[style, { backgroundColor: highlightColor, borderRadius: 4 }]}>{t.slice(idx, idx + q.length)}</KText>
      {t.slice(idx + q.length)}
    </KText>
  );
}

// ═══════════════════════════════════════════════════════
// Skeleton
// ═══════════════════════════════════════════════════════
function MessagesSkeleton() {
  const { styles, colors } = useSkeletonStyles();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = skeletonPulse(pulse);
    loop.start();
    return () => loop.stop();
  }, []);
  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const Box = ({ w, h, r = 8, style: s }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, s]} />
  );
  return (
    <View style={styles.container}>
      <Box w="100%" h={40} r={12} style={{ marginTop: 10, marginBottom: 14 }} />
      {[0, 1, 2, 3].map((i) => (
        <KRow key={i} gap="sm" style={{ paddingVertical: 12, alignItems: "center" }}>
          <Box w={56} h={56} r={16} />
          <KVStack gap={6} style={{ flex: 1 }}>
            <Box w="55%" h={14} /><Box w="40%" h={12} /><Box w="75%" h={12} />
          </KVStack>
          <Box w={34} h={12} />
        </KRow>
      ))}
    </View>
  );
}
const useSkeletonStyles = createStyles((colors) => ({
  container: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 14 },
}));

// ═══════════════════════════════════════════════════════
// Not Authenticated
// ═══════════════════════════════════════════════════════
function NotAuthenticated() {
  const { styles, colors } = useNotAuthStyles();
  return (
    <KVStack align="center" justify="center" style={styles.container}>
      <View style={styles.iconCircle}>
        <Ionicons name="chatbubbles-outline" size={28} color={colors.textTertiary} />
      </View>
      <KText variant="h3" bold center>Inscris-toi pour voir tes conversations</KText>
      <KText variant="bodySmall" color="textSecondary" center style={{ lineHeight: 20 }}>
        Échangez directement avec la communauté Kreeny.
      </KText>
      <KPressable testID="messages-login-btn" onPress={() => router.push("/signup")} style={styles.loginBtn}>
        <KText variant="label" bold color="textInverse">Créer un compte</KText>
      </KPressable>
      <KPressable onPress={() => router.push("/login")}>
        <KText variant="bodySmall" color="textSecondary">Déjà un compte ? <KText variant="bodySmall" bold style={{ color: colors.primary }}>Se connecter</KText></KText>
      </KPressable>
    </KVStack>
  );
}
const useNotAuthStyles = createStyles((colors, isDark) => ({
  container: { flex: 1, padding: 32, gap: 16 },
  iconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center", justifyContent: "center",
  },
  loginBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 32, marginTop: 8,
  },
}));

// ═══════════════════════════════════════════════════════
// Thread Card — Premium (véhicule + nom + dernier msg)
// ═══════════════════════════════════════════════════════
function ThreadCard({ thread, query, tab, onArchiveToggle }: {
  thread: any; query: string; tab: string; onArchiveToggle: (thread: any) => void;
}) {
  const { styles, colors, isDark } = useThreadStyles();
  const lastTime = thread.lastMessageAt ?? thread.createdAt;
  const highlightColor = isDark ? "rgba(224,36,94,0.25)" : "rgba(224,36,94,0.18)";
  const hasUnread = !!thread.hasUnread;
  const swipeRef = useRef<Swipeable>(null);

  const isArchived = tab === "archived";
  const actionLabel = isArchived ? "Désarchiver" : "Archiver";
  const actionIcon = isArchived ? "arrow-undo-outline" : "archive-outline";

  const renderSwipeAction = () => (
    <KPressable
      onPress={() => {
        swipeRef.current?.close();
        onArchiveToggle(thread);
      }}
      style={styles.swipeAction}
    >
      <Ionicons name={actionIcon as any} size={18} color="#FFF" />
      <KText variant="caption" bold style={{ color: "#FFF", fontSize: 11 }}>{actionLabel}</KText>
    </KPressable>
  );

  // Dernier message preview
  const lastText = thread.lastMessageText || "Aucun message";
  const isFromMe = thread.lastMessageIsFromMe;

  return (
    <Swipeable
      ref={swipeRef}
      overshootLeft={false}
      overshootRight={false}
      renderLeftActions={renderSwipeAction}
      renderRightActions={renderSwipeAction}
    >
      <KPressable
        testID={`thread-card-${String(thread._id)}`}
        onPress={() => router.push(`/messages/${String(thread._id)}`)}
        onLongPress={() => {
          Alert.alert(
            actionLabel,
            isArchived ? "Remettre dans les conversations actives ?" : "Archiver cette conversation ?",
            [
              { text: "Annuler", style: "cancel" },
              { text: actionLabel, style: isArchived ? "default" : "destructive", onPress: () => onArchiveToggle(thread) },
            ]
          );
        }}
        style={styles.card}
      >
        {/* Thumbnail véhicule + avatar overlay */}
        <View style={{ width: 60, height: 60, borderRadius: 18, position: "relative" }}>
          {thread.vehicleCoverUrl ? (
            <KImage source={{ uri: thread.vehicleCoverUrl }} style={styles.vehicleImg} />
          ) : (
            <View style={[styles.vehicleImg, styles.vehicleFallback]}>
              <Ionicons name="car-sport" size={22} color={colors.primary} />
            </View>
          )}
          {thread.otherAvatarUrl ? (
            <KImage source={{ uri: thread.otherAvatarUrl }} style={styles.avatarOverlay} />
          ) : (
            <View style={[styles.avatarOverlay, styles.avatarFallback]}>
              <Ionicons name="person" size={12} color="#FFF" />
            </View>
          )}
        </View>

        {/* Content */}
        <View style={{ flex: 1 }}>
          {/* Row 1: Titre véhicule + date + badge */}
          <KRow justify="space-between" gap="sm" style={{ alignItems: "center" }}>
            <HighlightText
              text={thread.vehicleTitle || "Discussion"}
              query={query}
              style={{ flex: 1, fontSize: 15, fontWeight: hasUnread ? "900" : "700", color: colors.text }}
              highlightColor={highlightColor}
              numberOfLines={1}
            />
            <KRow gap={6} style={{ alignItems: "center", marginLeft: 8 }}>
              <KText variant="caption" color={hasUnread ? "text" : "textTertiary"} bold={hasUnread} style={{ fontSize: 11 }}>
                {formatTimeSmart(lastTime)}
              </KText>

              {/* Read receipts si dernier msg de moi */}
              {isFromMe && !hasUnread ? (
                <Ionicons
                  name={thread.isLastReadByOther ? "checkmark-done" : "checkmark"}
                  size={15}
                  color={thread.isLastReadByOther ? colors.primary : colors.textTertiary}
                />
              ) : null}

              {/* Badge non-lu */}
              {hasUnread ? (
                <View style={styles.unreadBadge}>
                  <KText variant="caption" bold style={{ color: "#FFF", fontSize: 10 }}>1</KText>
                </View>
              ) : null}

              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </KRow>
          </KRow>

          {/* Row 2: Nom de l'autre utilisateur */}
          <HighlightText
            text={thread.otherDisplayName || "Utilisateur"}
            query={query}
            style={{ fontSize: 13, fontWeight: "600", color: colors.text, marginTop: 2 }}
            highlightColor={highlightColor}
            numberOfLines={1}
          />

          {/* Row 3: Preview du dernier message */}
          <KRow style={{ marginTop: 2 }}>
            {isFromMe ? (
              <KText variant="caption" color="textTertiary" style={{ fontSize: 12, fontWeight: "600" }}>Vous : </KText>
            ) : null}
            <HighlightText
              text={lastText}
              query={query}
              style={{
                flex: 1,
                fontSize: 12,
                fontWeight: hasUnread ? "600" : "400",
                color: hasUnread ? colors.text : colors.textSecondary,
                lineHeight: 17,
              }}
              highlightColor={highlightColor}
              numberOfLines={1}
            />
          </KRow>
        </View>
      </KPressable>
    </Swipeable>
  );
}

const useThreadStyles = createStyles((colors, isDark) => ({
  card: {
    flexDirection: "row", alignItems: "center", gap: 12, padding: 14,
    borderRadius: 20, backgroundColor: colors.card,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
    marginBottom: 10,
  },
  vehicleImg: {
    width: 60, height: 60, borderRadius: 18, backgroundColor: colors.bgTertiary,
  },
  vehicleFallback: {
    alignItems: "center" as const, justifyContent: "center" as const,
    backgroundColor: isDark ? colors.bgTertiary : colors.primaryLight,
  },
  avatarOverlay: {
    position: "absolute" as const, right: -4, bottom: -4,
    width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: colors.card,
    backgroundColor: colors.bgTertiary,
  },
  avatarFallback: {
    backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.25)",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  unreadBadge: {
    minWidth: 18, height: 18, paddingHorizontal: 5, borderRadius: 999,
    backgroundColor: "#E0245E",
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  swipeAction: {
    width: 88, justifyContent: "center" as const, alignItems: "center" as const,
    gap: 4, backgroundColor: isDark ? "#333" : "#111",
    borderRadius: 18, marginBottom: 10,
  },
}));

// ═══════════════════════════════════════════════════════
// Tabs (Actifs / Archivés)
// ═══════════════════════════════════════════════════════
function TabSwitch({ tab, onChangeTab, activeCount, archivedCount }: {
  tab: string; onChangeTab: (t: string) => void; activeCount: number; archivedCount: number;
}) {
  const { styles, colors } = useTabStyles();
  return (
    <KRow style={styles.tabsRow}>
      <KPressable
        onPress={() => onChangeTab("active")}
        style={[styles.tabBtn, tab === "active" && styles.tabBtnActive]}
      >
        <KText
          variant="caption"
          bold
          style={[styles.tabLabel, tab === "active" && { color: colors.text }]}
        >
          Actifs ({activeCount})
        </KText>
      </KPressable>
      <KPressable
        onPress={() => onChangeTab("archived")}
        style={[styles.tabBtn, tab === "archived" && styles.tabBtnActive]}
      >
        <KText
          variant="caption"
          bold
          style={[styles.tabLabel, tab === "archived" && { color: colors.text }]}
        >
          Archivés ({archivedCount})
        </KText>
      </KPressable>
    </KRow>
  );
}
const useTabStyles = createStyles((colors, isDark) => ({
  tabsRow: {
    backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)",
    borderRadius: 12, padding: 3, marginTop: 10,
  },
  tabBtn: {
    flex: 1, height: 32, borderRadius: 10,
    alignItems: "center" as const, justifyContent: "center" as const,
  },
  tabBtnActive: {
    backgroundColor: colors.card,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.08)",
  },
  tabLabel: {
    fontSize: 12, color: colors.textTertiary,
  },
}));

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
export default function MessagesScreen() {
  const { styles, colors } = useStyles();
  const { isLoading, isAuthenticated } = useAuthStatus();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("active");
  const insets = useSafeAreaInsets();

  const setArchived = useMutation(api.chat.setArchived);

  // ✅ Deux queries séparées pour active et archived (compteurs)
  const activeThreads = useQuery(api.chat.listMyThreads, isAuthenticated ? { includeArchived: false } : "skip");
  const archivedThreads = useQuery(api.chat.listMyThreads, isAuthenticated ? { includeArchived: true } : "skip");

  const threads = tab === "active" ? activeThreads : archivedThreads;

  const filtered = useMemo(() => {
    if (!threads) return [];
    const q = query.trim().toLowerCase();
    if (!q) return threads;
    return threads.filter((t: any) => {
      const vehicleTitle = String(t.vehicleTitle || "").toLowerCase();
      const otherName = String(t.otherDisplayName || "").toLowerCase();
      const lastText = String(t.lastMessageText || "").toLowerCase();
      return vehicleTitle.includes(q) || otherName.includes(q) || lastText.includes(q);
    });
  }, [threads, query]);

  const handleArchiveToggle = useCallback(async (thread: any) => {
    const isCurrentlyArchived = tab === "archived";
    try {
      await setArchived({ threadId: thread._id, archived: !isCurrentlyArchived });
    } catch (e) {
      console.log("Archive error:", e);
    }
  }, [tab, setArchived]);

  const handleChangeTab = useCallback((t: string) => {
    setTab(t);
    setQuery("");
  }, []);

  if (isLoading) return <MessagesSkeleton />;
  if (!isAuthenticated) {
    return (
      <View testID="messages-screen" style={{ flex: 1, backgroundColor: colors.bg }}>
        <NotAuthenticated />
      </View>
    );
  }
  if (threads === undefined) return <MessagesSkeleton />;

  const emptyTitle = query?.trim()
    ? "Aucun résultat"
    : tab === "active"
      ? "Aucune conversation active"
      : "Aucune conversation archivée";

  const emptySubtitle = query?.trim()
    ? "Essaie avec un nom, un véhicule ou un mot du dernier message."
    : tab === "active"
      ? "Une conversation se crée automatiquement quand tu envoies une demande de réservation."
      : "Les conversations archivées (manuellement ou automatiquement) apparaîtront ici.";

  return (
    <View testID="messages-screen" style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingHorizontal: 18, paddingTop: insets.top + 8, paddingBottom: 4 }}>
        <KText variant="displayMedium">Messages</KText>
        <KText variant="bodySmall" color="textSecondary" style={{ marginTop: 2 }}>Vos conversations</KText>

        {/* Search */}
        <View style={{ paddingTop: 10 }}>
          <KRow gap="sm" style={styles.searchBar}>
            <Ionicons name="search" size={16} color={colors.textTertiary} />
            <TextInput
              testID="messages-search-input" value={query} onChangeText={setQuery}
              placeholder="Rechercher une conversation…" placeholderTextColor={colors.inputPlaceholder}
              style={styles.searchInput} returnKeyType="search" autoCapitalize="none" autoCorrect={false}
            />
            {query.length > 0 && (
              <KPressable testID="messages-search-clear" onPress={() => setQuery("")}>
                <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
              </KPressable>
            )}
          </KRow>
        </View>

        {/* Tabs */}
        <TabSwitch
          tab={tab}
          onChangeTab={handleChangeTab}
          activeCount={activeThreads?.length ?? 0}
          archivedCount={archivedThreads?.length ?? 0}
        />
      </View>

      {filtered.length === 0 ? (
        <KVStack align="center" justify="center" style={{ flex: 1, padding: 24 }}>
          <KText variant="label" bold center>{emptyTitle}</KText>
          <KText variant="bodySmall" color="textSecondary" center style={{ lineHeight: 20, marginTop: 6 }}>
            {emptySubtitle}
          </KText>
        </KVStack>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(t: any) => String(t._id)}
          contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <ThreadCard
              thread={item}
              query={query}
              tab={tab}
              onArchiveToggle={handleArchiveToggle}
            />
          )}
        />
      )}
    </View>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  searchBar: {
    height: 40, paddingHorizontal: 12, borderRadius: 12, alignItems: "center",
    backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.04)",
    borderWidth: 1, borderColor: isDark ? colors.border : "rgba(0,0,0,0.05)",
  },
  searchInput: {
    flex: 1, height: 40, fontSize: 13, fontWeight: "500", color: colors.inputText,
  },
}));
