import { useRef } from "react";
import { Animated } from "react-native";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../convex/_generated/api";
import { haptic, easing } from "../theme";
import { KPressable, createStyles } from "../ui";

interface KFavoriteButtonProps {
  vehicleId: string;
  /** Size of the heart icon (default 20) */
  size?: number;
  /** Style variant */
  variant?: "overlay" | "inline";
}

export function KFavoriteButton({ vehicleId, size = 20, variant = "inline" }: KFavoriteButtonProps) {
  const { styles } = useBtnStyles();
  const favMap = useQuery(api.favorites.myFavoritedIds) ?? {};
  const toggleMutation = useMutation(api.favorites.toggle);
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const isFav = !!favMap[vehicleId];

  const onToggle = async () => {
    // Bounce animation
    Animated.sequence([
      Animated.timing(scaleAnim, { toValue: 0.7, duration: 80, easing: easing.exit, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1.15, duration: 180, easing: easing.enter, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 1, duration: 120, easing: easing.standard, useNativeDriver: true }),
    ]).start();

    haptic.light();

    try {
      await toggleMutation({ vehicleId: vehicleId as any });
    } catch {
      // silently fail — user probably not authenticated
    }
  };

  return (
    <KPressable
      onPress={onToggle}
      style={variant === "overlay" ? styles.overlay : styles.inline}
      hitSlop={8}
    >
      <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
        <Ionicons
          name={isFav ? "heart" : "heart-outline"}
          size={size}
          color={isFav ? "#EF4444" : variant === "overlay" ? "#6B7280" : "#9CA3AF"}
        />
      </Animated.View>
    </KPressable>
  );
}

const useBtnStyles = createStyles((colors, isDark) => ({
  overlay: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.85)",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 4, shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  inline: {
    width: 32, height: 32,
    alignItems: "center", justifyContent: "center",
  },
}));
