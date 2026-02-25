import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Pressable, Text, TextInput, View } from "react-native";
import { api } from "../../convex/_generated/api";

import { useChatScroll } from "../../src/ui/hooks/useChatScroll";
import { AppScreen } from "../../src/ui/layout/AppScreen";

export default function ThreadScreen() {
  const params = useLocalSearchParams<{ threadId: string }>();
  const threadId = params.threadId;

  const runAction = useMutation(api.chatActions.runChatAction);
  const sendMessage = useMutation(api.chatSend.sendMessage);
  const refreshActions = useMutation(api.chat.refreshThreadActions);

  const [draft, setDraft] = useState("");

  const { listRef, scrollToBottom, onMessagesReady } = useChatScroll();

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
    return [...messagesRaw].reverse(); // oldest -> newest
  }, [messagesRaw]);

  useEffect(() => {
    if (!threadId) return;
    refreshActions({ threadId: threadId as any });
  }, [threadId, refreshActions]);

  useEffect(() => {
    onMessagesReady(messages?.length ?? 0);
  }, [messages?.length, onMessagesReady]);

  return (
    <AppScreen>
      <View style={{ flex: 1 }}>
        {/* Header local (proche de la nav bar) */}
        <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: "700" }}>Conversation</Text>
        </View>

        {/* Zone messages */}
        {!messages ? (
          <View style={{ paddingHorizontal: 16 }}>
            <Text>Chargement…</Text>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            style={{ flex: 1 }}
            data={messages}
            keyExtractor={(m) => String(m._id)}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={{ paddingHorizontal: 16 }}
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

                          if (a.route === "action:CANCEL_RESERVATION") {
                            Alert.alert(
                              "Annuler la réservation",
                              "Es-tu sûr de vouloir annuler ? Cette action est irréversible.",
                              [
                                { text: "Non", style: "cancel" },
                                {
                                  text: "Oui, annuler",
                                  style: "destructive",
                                  onPress: async () => {
                                    const res = await runAction({
                                      threadId: threadId as any,
                                      action: "CANCEL_RESERVATION",
                                    });
                                    if (!res.ok) {
                                      Alert.alert("Erreur", "Impossible d'annuler cette réservation.");
                                      return;
                                    }
                                    Alert.alert("OK", "Réservation annulée.");
                                  },
                                },
                              ]
                            );
                            return;
                          }

                          if (a.route === "action:DEV_DROPOFF_PENDING") {
                            const res = await runAction({
                              threadId: threadId as any,
                              action: "DEV_DROPOFF_PENDING",
                            });
                            if (!res.ok) {
                              Alert.alert("Indisponible", "Cette action n'est plus disponible.");
                              return;
                            }
                            Alert.alert("OK", "Retour véhicule simulé ✅");
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
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            )}
          />
        )}

        {/* Barre d’écriture (DANS LE FLOW NORMAL) */}
        <View style={{ borderTopWidth: 1, padding: 10, paddingHorizontal: 16 }}>
          <TextInput
            placeholder="Écris un message…"
            value={draft}
            onChangeText={setDraft}
            onFocus={() => setTimeout(() => scrollToBottom(true), 80)}
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