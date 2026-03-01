import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { haptic } from "../../theme";

interface KStarRatingProps {
  /** Current rating (1-5) */
  rating: number;
  /** If provided, stars become tappable */
  onRate?: (rating: number) => void;
  /** Star size (default: 18) */
  size?: number;
  /** Color for filled stars */
  color?: string;
  /** Color for empty stars */
  emptyColor?: string;
  /** Gap between stars */
  gap?: number;
}

export function KStarRating({
  rating,
  onRate,
  size = 18,
  color = "#F59E0B",
  emptyColor = "#D1D5DB",
  gap = 2,
}: KStarRatingProps) {
  return (
    <View style={{ flexDirection: "row", gap }}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = star <= Math.round(rating);
        const icon = filled ? "star" : "star-outline";
        const iconColor = filled ? color : emptyColor;

        if (onRate) {
          return (
            <Pressable
              key={star}
              onPress={() => { haptic.light(); onRate(star); }}
              hitSlop={6}
            >
              <Ionicons name={icon} size={size} color={iconColor} />
            </Pressable>
          );
        }

        return <Ionicons key={star} name={icon} size={size} color={iconColor} />;
      })}
    </View>
  );
}
