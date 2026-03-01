import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, typography, spacing } from "../../theme";

type EmptyStatePreset =
  | "no-results"
  | "no-messages"
  | "no-reservations"
  | "no-listings"
  | "no-reviews"
  | "offline"
  | "error"
  | "first-time";

const PRESETS: Record<EmptyStatePreset, { emoji: string; title: string; desc: string }> = {
  "no-results": { emoji: "🔍", title: "Aucun résultat", desc: "Essayez avec d'autres critères ou explorez les collections." },
  "no-messages": { emoji: "💬", title: "Pas encore de messages", desc: "Vos conversations apparaîtront ici une fois que vous aurez réservé ou reçu une demande." },
  "no-reservations": { emoji: "📅", title: "Aucune réservation", desc: "Trouvez le véhicule idéal et lancez votre première réservation !" },
  "no-listings": { emoji: "🚗", title: "Aucune annonce publiée", desc: "Publiez votre véhicule et commencez à gagner dès cette semaine." },
  "no-reviews": { emoji: "⭐", title: "Pas encore d'avis", desc: "Les avis apparaîtront après votre première location terminée." },
  offline: { emoji: "📡", title: "Pas de connexion", desc: "Vérifiez votre connexion internet et réessayez." },
  error: { emoji: "😅", title: "Quelque chose s'est mal passé", desc: "Ce n'est pas vous, c'est nous. Réessayez dans un instant." },
  "first-time": { emoji: "👋", title: "Bienvenue sur Kreeny !", desc: "Louez une voiture ou publiez la vôtre en quelques minutes." },
};

interface KEmptyStateProps {
  /** Use a preset for common states */
  preset?: EmptyStatePreset;
  /** Legacy: Ionicons icon name (ignored if preset has emoji) */
  icon?: keyof typeof Ionicons.glyphMap;
  /** Custom emoji (overrides preset) */
  emoji?: string;
  /** Custom title (overrides preset) */
  title?: string;
  /** Custom description (overrides preset) */
  description?: string;
  /** Action button label */
  actionTitle?: string;
  /** Action callback */
  onAction?: () => void;
  /** Compact mode */
  compact?: boolean;
}

import { Text, Pressable } from "react-native";

export function KEmptyState({
  preset = "no-results",
  icon,
  emoji,
  title,
  description,
  actionTitle,
  onAction,
  compact = false,
}: KEmptyStateProps) {
  const { colors } = useTheme();
  const data = PRESETS[preset];

  const displayEmoji = emoji || data.emoji;
  const displayTitle = title || data.title;
  const displayDesc = description || data.desc;

  return (
    <View style={{
      alignItems: "center", justifyContent: "center",
      paddingHorizontal: compact ? 32 : 40,
      paddingVertical: compact ? 32 : 60,
    }}>
      <View style={{
        width: 72, height: 72, borderRadius: 36,
        backgroundColor: colors.primaryLight || "#F0F3FA",
        alignItems: "center", justifyContent: "center",
        marginBottom: 16,
      }}>
        {displayEmoji ? (
          <Text style={{ fontSize: 32 }}>{displayEmoji}</Text>
        ) : icon ? (
          <Ionicons name={icon} size={32} color={colors.primary} />
        ) : null}
      </View>
      <Text style={[typography.h2, { color: colors.text, textAlign: "center", marginBottom: 8 }]}>
        {displayTitle}
      </Text>
      <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", lineHeight: 20 }]}>
        {displayDesc}
      </Text>
      {actionTitle && onAction && (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => ({
            marginTop: 16, paddingVertical: 10, paddingHorizontal: 20,
            borderRadius: 12, borderWidth: 1.5,
            borderColor: colors.primary + "30",
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 14, fontWeight: "700", color: colors.primary }}>{actionTitle}</Text>
        </Pressable>
      )}
    </View>
  );
}
