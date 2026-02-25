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
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || !threadId || sending) return;
    setSending(true);
    try {
      await sendMessage({ threadId: threadId as any, text });
      setDraft("");
      setTimeout(() => scrollToBottom(true), 100);
    } catch (e) {
      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setSending(false);
    }
  };

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
                        onPress={() => {
                          if (!threadId) return;

                          const doAction = async (actionName: string, successMsg: string) => {
                            try {
                              const res = await runAction({
                                threadId: threadId as any,
                                action: actionName as any,
                              });
                              if (!res.ok) {
                                Alert.alert("Indisponible", "Cette action n’est plus disponible.");
                                return;
                              }
                              Alert.alert("OK", successMsg);
                            } catch (e) {
                              Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
                            }
                          };

                          const confirm = (title: string, msg: string, onConfirm: () => void) => {
                            Alert.alert(title, msg, [
                              { text: "Annuler", style: "cancel" },
                              { text: "Confirmer", onPress: onConfirm },
                            ]);
                          };

                          if (a.route === "action:ACCEPT") {
                            confirm("Accepter la demande ?", "Le locataire devra ensuite payer pour confirmer.", () =>
                              doAction("ACCEPT", "Demande acceptée."));
                            return;
                          }
                          if (a.route === "action:REJECT") {
                            confirm("Refuser la demande ?", "Les dates seront libérées.", () =>
                              doAction("REJECT", "Demande refusée."));
                            return;
                          }
                          if (a.route === "action:PAY_NOW") {
                            confirm("Payer maintenant ?", "Le paiement sera initialisé.", () =>
                              doAction("PAY_NOW", "Paiement initialisé."));
                            return;
                          }
                          if (a.route === "action:DEV_MARK_PAID") {
                            doAction("DEV_MARK_PAID", "Paiement simulé.");
                            return;
                          }
                          if (a.route === "action:TRIGGER_RETURN") {
                            confirm("Déclarer le retour ?", "La phase de constat retour sera lancée.", () =>
                              doAction("TRIGGER_RETURN", "Retour déclaré. Constat retour requis."));
                            return;
                          }
                          if (a.route === "action:OWNER_CANCEL") {
                            confirm("Annuler la réservation ?", "Cette action est irréversible.", () =>
                              doAction("OWNER_CANCEL", "Réservation annulée."));
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

        {/* Barre d’écriture */}
        <View style={{ borderTopWidth: 1, padding: 10, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 }}>
          <TextInput
            placeholder="Écris un message…"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            onFocus={() => setTimeout(() => scrollToBottom(true), 80)}
            style={{
              flex: 1,
              borderWidth: 1,
              borderRadius: 12,
              paddingHorizontal: 12,
              paddingVertical: 10,
            }}
          />
          <Pressable
            onPress={handleSend}
            disabled={!draft.trim() || sending}
            style={{
              backgroundColor: draft.trim() && !sending ? "#000" : "#ccc",
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 16,
            }}
          >
            <Text style={{ color: "#fff", fontWeight: "700" }}>
              {sending ? "..." : "Envoyer"}
            </Text>
          </Pressable>
        </View>
      </View>
    </AppScreen>
  );
}