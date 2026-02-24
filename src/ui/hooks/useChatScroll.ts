import { useCallback, useEffect, useRef } from "react";
import { FlatList, InteractionManager, Keyboard, Platform } from "react-native";

export function useChatScroll() {
  const listRef = useRef<FlatList<any> | null>(null);
  const didInit = useRef(false);

  const scrollToBottom = useCallback((animated: boolean) => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  // 1) Premier chargement : on force le bas
  const onMessagesReady = useCallback(
    (count: number) => {
      if (!count) return;
      if (didInit.current) return;
      didInit.current = true;

      // Après layout + interactions (plus fiable que juste requestAnimationFrame)
      InteractionManager.runAfterInteractions(() => {
        scrollToBottom(false);
        setTimeout(() => scrollToBottom(false), 120);
      });
    },
    [scrollToBottom]
  );

  // 2) Clavier : on scrolle APRÈS que l’écran ait rétréci
  useEffect(() => {
    const doScrollAfterKeyboard = () => {
      // 1er scroll rapide
      scrollToBottom(true);

    };

    const subs = [
      Keyboard.addListener("keyboardDidShow", doScrollAfterKeyboard),
      Keyboard.addListener("keyboardDidHide", () => {
        // optionnel: quand ça se ferme, on garde le bas
        setTimeout(() => scrollToBottom(true), 80);
      }),
    ];

    // iOS: parfois willShow arrive sans didShow selon contexte → on écoute aussi
    if (Platform.OS === "ios") {
      subs.push(Keyboard.addListener("keyboardWillShow", doScrollAfterKeyboard));
    }

    return () => subs.forEach((s) => s.remove());
  }, [scrollToBottom]);

  return { listRef, scrollToBottom, onMessagesReady };
}