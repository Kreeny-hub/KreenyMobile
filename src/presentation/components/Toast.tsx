import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, View, Pressable, Dimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KText, KRow, createStyles } from "../../ui";
import { haptic } from "../../theme";

const { width: SW } = Dimensions.get("window");

type ToastType = "error" | "success" | "info";

interface ToastData {
  type: ToastType;
  title: string;
  message?: string;
}

// ═══════════════════════════════════════════════════════
// Global toast controller
// ═══════════════════════════════════════════════════════
let _showToast: ((data: ToastData) => void) | null = null;

export function showToast(data: ToastData) {
  _showToast?.(data);
}

export function showErrorToast(error: unknown) {
  // Import dynamically to avoid circular deps
  const { translateError } = require("../../lib/errorMessages");
  const { title, message } = translateError(error);
  showToast({ type: "error", title, message });
}

export function showSuccessToast(title: string, message?: string) {
  showToast({ type: "success", title, message });
}

// ═══════════════════════════════════════════════════════
// Toast component — render once in root layout
// ═══════════════════════════════════════════════════════
export function ToastProvider() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastData | null>(null);
  const translateY = useRef(new Animated.Value(-120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timeout = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback(() => {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -120, duration: 250, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [translateY, opacity]);

  const show = useCallback((data: ToastData) => {
    if (timeout.current) clearTimeout(timeout.current);
    setToast(data);

    if (data.type === "error") haptic.error();
    else if (data.type === "success") haptic.success();
    else haptic.light();

    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 90, friction: 12 }),
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();

    timeout.current = setTimeout(dismiss, data.type === "error" ? 4500 : 3000);
  }, [translateY, opacity, dismiss]);

  useEffect(() => {
    _showToast = show;
    return () => { _showToast = null; };
  }, [show]);

  if (!toast) return null;

  const config = TOAST_CONFIG[toast.type];

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 8, transform: [{ translateY }], opacity },
      ]}
      pointerEvents="box-none"
    >
      <Pressable onPress={dismiss} style={[styles.toast, { borderColor: config.border }]}>
        <View style={[styles.iconCircle, { backgroundColor: config.iconBg }]}>
          <Ionicons name={config.icon} size={18} color={config.iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <KText variant="label" bold numberOfLines={1}>{toast.title}</KText>
          {toast.message && (
            <KText variant="caption" color="textSecondary" numberOfLines={2} style={{ marginTop: 1, lineHeight: 17 }}>
              {toast.message}
            </KText>
          )}
        </View>
        <Ionicons name="close" size={16} color={colors.textTertiary} />
      </Pressable>
    </Animated.View>
  );
}

const TOAST_CONFIG: Record<ToastType, {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  border: string;
}> = {
  error: {
    icon: "alert-circle",
    iconColor: "#EF4444",
    iconBg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.15)",
  },
  success: {
    icon: "checkmark-circle",
    iconColor: "#10B981",
    iconBg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.15)",
  },
  info: {
    icon: "information-circle",
    iconColor: "#3B82F6",
    iconBg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.15)",
  },
};

const useStyles = createStyles((colors, isDark) => ({
  container: {
    position: "absolute", left: 0, right: 0, zIndex: 9999,
    alignItems: "center", paddingHorizontal: 14,
  },
  toast: {
    flexDirection: "row", alignItems: "center", gap: 12,
    width: "100%", maxWidth: SW - 28,
    backgroundColor: colors.card,
    borderRadius: 16, borderWidth: 1,
    paddingHorizontal: 14, paddingVertical: 12,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.4 : 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  iconCircle: {
    width: 34, height: 34, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
  },
}));
