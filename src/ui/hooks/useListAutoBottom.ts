import { useCallback, useMemo, useRef } from "react";
import { FlatList, Platform } from "react-native";

type AnyListRef = FlatList<any>;

export function useListAutoBottom() {
  const listRef = useRef<AnyListRef | null>(null);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = useCallback((animated = true) => {
    // requestAnimationFrame = évite “scroll trop tôt”
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated });
    });
  }, []);

  const onScroll = useCallback((e: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const paddingToBottom = 80; // zone tolérance
    isNearBottomRef.current =
      layoutMeasurement.height + contentOffset.y >=
      contentSize.height - paddingToBottom;
  }, []);

  const onLayout = useCallback(() => {
    // 1er rendu : on va en bas sans animation
    scrollToBottom(false);
  }, [scrollToBottom]);

  const onContentSizeChange = useCallback(() => {
    // nouveaux messages : on scrolle seulement si user était en bas
    if (isNearBottomRef.current) scrollToBottom(true);
  }, [scrollToBottom]);

  const onInputFocus = useCallback(() => {
    // iOS : le clavier applique ses insets après un tick → petit délai
    if (!isNearBottomRef.current) return;
    const delay = Platform.OS === "ios" ? 60 : 0;
    setTimeout(() => scrollToBottom(true), delay);
  }, [scrollToBottom]);

  const listProps = useMemo(
    () => ({
      ref: (r: AnyListRef | null) => {
        listRef.current = r;
      },
      onScroll,
      onLayout,
      onContentSizeChange,
      scrollEventThrottle: 16,
      keyboardDismissMode: Platform.OS === "ios" ? ("interactive" as const) : ("on-drag" as const),
      keyboardShouldPersistTaps: "handled" as const,
      // iOS: ajuste automatiquement la zone scrollable quand clavier apparaît (très important)
      automaticallyAdjustKeyboardInsets: Platform.OS === "ios",
    }),
    [onScroll, onLayout, onContentSizeChange]
  );

  return {
    listProps,
    onInputFocus,
    scrollToBottom,
    isNearBottomRef,
  };
}