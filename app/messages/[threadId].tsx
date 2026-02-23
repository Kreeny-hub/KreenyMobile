import { useMutation, useQuery } from "convex/react";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Alert, FlatList, Keyboard, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";

export default function ThreadScreen() {
  const params = useLocalSearchParams<{ threadId: string }>();
  const threadId = params.threadId;
  const insets = useSafeAreaInsets();
  const runAction = useMutation(api.chatActions.runChatAction);
  const sendMessage = useMutation(api.chatSend.sendMessage);
  const [draft, setDraft] = useState("");
  const refreshActions = useMutation(api.chat.refreshThreadActions);
  const listRef = useRef<FlatList<any>>(null);

  const scrollToLatest = (animated = true) => {
    // Avec FlatList inverted, "le bas" = offset 0
    requestAnimationFrame(() => {
      listRef.current?.scrollToOffset({ offset: 0, animated });
    });
  };



  const thread = useQuery(
    api.chat.getThread,
    threadId ? { threadId: threadId as any } : "skip"
  );

  const messages = useQuery(
    api.chat.listMessages,
    threadId ? { threadId: threadId as any, limit: 200 } : "skip"
  );

  const meRole = useQuery(
    api.reservations.getMyRoleForReservation,
    thread ? { reservationId: thread.reservationId as any } : "skip"
  );

  useEffect(() => {
    if (!threadId) return;

    refreshActions({ threadId: threadId as any });
  }, [threadId]);

  useEffect(() => {
    const subShow = Keyboard.addListener("keyboardWillShow", () => {
      scrollToLatest(true);
    });

    const subHide = Keyboard.addListener("keyboardWillHide", () => {
      scrollToLatest(true);
    });

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={insets.top + 45}
      >
        <View style={{ flex: 1, padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", marginBottom: 12 }}>
            Conversation
          </Text>

          {!messages ? (
            <Text>Chargement…</Text>
          ) : (
            <FlatList
              ref={listRef}
              style={{ flex: 1 }}
              data={messages}
              inverted
              keyExtractor={(m) => String(m._id)}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 16 }}
              onContentSizeChange={() => scrollToLatest(false)}
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

          {/* ✅ Barre d’écriture (test) */}
          <View
            style={{
              borderTopWidth: 1,
              paddingTop: 10,
              marginTop: 10,
            }}
          >
            <TextInput
              placeholder="Écris un message…"
              value={draft}
              onChangeText={setDraft}
              onFocus={() => scrollToLatest(true)}
              style={{
                borderWidth: 1,
                borderRadius: 12,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}