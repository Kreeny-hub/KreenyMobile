import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { api } from "../../convex/_generated/api";

import { useListAutoBottom } from "../../src/ui/hooks/useListAutoBottom";
import { AppScreen } from "../../src/ui/layout/AppScreen";

export default function ThreadScreen() {
  const params = useLocalSearchParams<{ threadId: string }>();
  const threadId = params.threadId;

  const runAction = useMutation(api.chatActions.runChatAction);
  const sendMessage = useMutation(api.chatSend.sendMessage);
  const refreshActions = useMutation(api.chat.refreshThreadActions);

  const [draft, setDraft] = useState("");
  const [inputBarHeight, setInputBarHeight] = useState(0);

  const { listProps, onInputFocus } = useListAutoBottom();

  const thread = useQuery(
    api.chat.getThread,
    threadId ? { threadId: threadId as any } : "skip"
  );

  const messagesRaw = useQuery(
    api.chat.listMessages,
    threadId ? { threadId: threadId as any, limit: 200 } : "skip"
  );

  const messages = useMemo(() => {
    if (!messagesRaw) return null;
    return [...messagesRaw].reverse();
  }, [messagesRaw]);

  useEffect(() => {
    if (!threadId) return;
    refreshActions({ threadId: threadId as any });
  }, [threadId, refreshActions]);

  return (
    <AppScreen withBottomSafeArea>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
          Conversation
        </Text>

        {!messages ? (
          <Text>Chargement…</Text>
        ) : (
          <FlatList
            {...listProps}
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={(m) => String(m._id)}
            contentContainerStyle={{
              paddingBottom: inputBarHeight + 12, // ✅ exact, donc max messages visibles
            }}
            renderItem={({ item }) => (
              <View style={{ paddingVertical: 8, borderBottomWidth: 1 }}>
                <Text style={{ fontWeight: item.type === "system" ? "700" : "400" }}>
                  {item.type === "system"
                    ? "Système"
                    : item.type === "actions"
                      ? "Actions"
                      : "Utilisateur"}{" "}
                  : {item.text}
                </Text>

                {!!item.actions?.length && (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    {item.actions.map((a: { label: string; route: string }, idx: number) => (
                      <Pressable
                        key={idx}
                        style={{
                          borderWidth: 1,
                          borderRadius: 10,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                        }}
                        onPress={async () => {
                          if (!threadId) return;

                          if (a.route === "action:PAY_NOW") {
                            const res = await runAction({
                              threadId: threadId as any,
                              action: "PAY_NOW",
                            });
                            if (!res.ok) {
                              Alert.alert("Indisponible", "Cette action n’est plus disponible.");
                              return;
                            }
                            Alert.alert("OK", "Paiement initialisé.");
                            return;
                          }

                          if (a.route === "action:DEV_MARK_PAID") {
                            const res = await runAction({
                              threadId: threadId as any,
                              action: "DEV_MARK_PAID",
                            });
                            if (!res.ok) {
                              Alert.alert("Indisponible", "Cette action n’est plus disponible.");
                              return;
                            }
                            Alert.alert("OK", "Paiement simulé ✅");
                            return;
                          }

                          if (!thread) return;
                          const reservationId = String(thread.reservationId);

                          if (a.route === "action:DO_CHECKIN") {
                            router.push(`/reservation/${reservationId}/report?phase=checkin`);
                            return;
                          }
                          if (a.route === "action:DO_CHECKOUT") {
                            router.push(`/reservation/${reservationId}/report?phase=checkout`);
                            return;
                          }
                          if (a.route === "action:OPEN_RESERVATION") {
                            router.push(`/profile/reservations`);
                            return;
                          }
                          if (a.route.startsWith("/")) router.push(a.route as any);
                        }}
                      >
                        <Text style={{ fontWeight: "700" }}>{a.label}</Text>
                        <Text style={{ opacity: 0.7, marginTop: 2 }}>{a.route}</Text>
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          />
        )}

        {/* Barre d’écriture */}
        <View
          onLayout={(e) => setInputBarHeight(e.nativeEvent.layout.height)}
          style={{
            borderTopWidth: 1,
            paddingTop: 10,
            marginTop: 10,
            paddingBottom: 10,
          }}
        >
          <TextInput
            placeholder="Écris un message…"
            value={draft}
            onChangeText={setDraft}
            onFocus={onInputFocus}
            style={{
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
        </View>
      </View>
    </AppScreen>
  );
}