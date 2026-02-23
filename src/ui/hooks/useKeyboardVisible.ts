import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

export function useKeyboardVisible() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const subShow = Keyboard.addListener(showEvent, () => setVisible(true));
    const subHide = Keyboard.addListener(hideEvent, () => setVisible(false));

    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  return visible;
}