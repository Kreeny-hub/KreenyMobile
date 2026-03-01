import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { useMutation } from "convex/react";
import { router } from "expo-router";
import { api } from "../../../convex/_generated/api";

// ═══════════════════════════════════════════════════════
// Configure notification handling
// ═══════════════════════════════════════════════════════
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ═══════════════════════════════════════════════════════
// Deep link routing — complete map
// ═══════════════════════════════════════════════════════
function routeFromNotification(data: Record<string, any>) {
  const { type, reservationId, threadId } = data;

  switch (type) {
    // ── Owner receives ──
    case "reservation_requested":
      router.push("/profile/dashboard");
      break;
    case "payment_captured":
      router.push("/profile/dashboard");
      break;
    case "reservation_cancelled_by_renter":
      router.push("/profile/dashboard");
      break;

    // ── Renter receives ──
    case "reservation_accepted":
      if (reservationId) router.push(`/payment/${reservationId}` as any);
      else router.push("/profile/reservations");
      break;
    case "reservation_rejected":
      router.push("/profile/reservations");
      break;
    case "reservation_cancelled_by_owner":
      router.push("/profile/reservations");
      break;

    // ── Both ──
    case "pickup_ready":
      router.push("/profile/reservations");
      break;
    case "reservation_completed":
      if (reservationId) router.push(`/review/${reservationId}` as any);
      else router.push("/profile/reservations");
      break;

    // ── Condition report ──
    case "condition_report_submitted":
      if (reservationId) router.push(`/reservation/${reservationId}/report` as any);
      else router.push("/profile/reservations");
      break;

    // ── Review ──
    case "review_received":
      router.push("/profile/reservations");
      break;

    // ── Admin ──
    case "admin_report":
      router.push("/admin");
      break;

    // ── Messages ──
    case "new_message":
      if (threadId) router.push(`/messages/${threadId}` as any);
      else router.push("/(tabs)/messages");
      break;

    default:
      break;
  }
}

// ═══════════════════════════════════════════════════════
// Wait for navigation to be ready before routing
// ═══════════════════════════════════════════════════════
function safeRoute(data: Record<string, any>, delayMs = 300) {
  const attempt = (ms: number, retries: number) => {
    setTimeout(() => {
      try {
        routeFromNotification(data);
      } catch (e) {
        if (retries > 0) {
          console.log("📲 Navigation not ready, retrying...");
          attempt(ms * 2, retries - 1);
        }
      }
    }, ms);
  };
  attempt(delayMs, 3);
}

// ═══════════════════════════════════════════════════════
// Hook — call once in tabs layout
// ═══════════════════════════════════════════════════════
export function usePushNotifications(isAuthenticated: boolean) {
  const registerToken = useMutation(api.push.registerPushToken);
  const registered = useRef(false);
  const listenersSet = useRef(false);

  // Deep link listeners (set once)
  useEffect(() => {
    if (listenersSet.current) return;
    listenersSet.current = true;

    // User tapped notification while app was in background/closed
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      if (data?.type) {
        console.log("📲 Notification tapped:", data.type);
        safeRoute(data);
      }
    });

    // Notification received while app is in foreground
    const receivedSub = Notifications.addNotificationReceivedListener((notification) => {
      const { title } = notification.request.content;
      console.log("📲 Notification received (foreground):", title);
      // The OS shows the alert banner automatically thanks to shouldShowAlert: true
    });

    return () => {
      responseSub.remove();
      receivedSub.remove();
    };
  }, []);

  // Token registration
  useEffect(() => {
    if (!isAuthenticated || registered.current) return;

    (async () => {
      try {
        if (!Device.isDevice) {
          console.log("📲 Push: skipped (not a physical device)");
          return;
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        let finalStatus = existing;

        if (existing !== "granted") {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== "granted") {
          console.log("📲 Push: permission not granted");
          return;
        }

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Kreeny",
            importance: Notifications.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#3B82F6",
          });
        }

        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) {
          console.error("📲 Push: No EAS projectId found! Run: npx eas init");
          return;
        }

        const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
        const token = tokenData.data;
        console.log("📲 Push token:", token);

        await registerToken({ token });
        registered.current = true;
        console.log("📲 Push: registered successfully!");
      } catch (e) {
        console.error("📲 Push registration error:", e);
      }
    })();
  }, [isAuthenticated]);

  // Handle notification that launched the app (cold start)
  useEffect(() => {
    if (!isAuthenticated) return;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        if (data?.type) {
          console.log("📲 Cold start notification:", data.type);
          safeRoute(data, 600); // longer delay for cold start
        }
      }
    });
  }, [isAuthenticated]);
}
