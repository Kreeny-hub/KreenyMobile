import { useCallback, useRef, useState } from "react";
import { Animated, Dimensions, FlatList, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { KText, KVStack, KRow, KPressable, createStyles } from "../src/ui";
import { duration, easing, haptic } from "../src/theme";

const { width: SW } = Dimensions.get("window");
const ONBOARDING_KEY = "kreeny_onboarding_seen";

// ═══════════════════════════════════════════════════════
// Slides data
// ═══════════════════════════════════════════════════════
const SLIDES = [
  {
    icon: "car-sport" as const,
    title: "Loue la voiture\nqu'il te faut",
    desc: "Des centaines de véhicules près de chez toi.\nCompare, choisis, réserve en quelques taps.",
    accent: "#3B82F6",
    accentLight: "#EFF6FF",
  },
  {
    icon: "wallet" as const,
    title: "Ta voiture dort ?\nFais-la travailler",
    desc: "Publie ton annonce en 3 minutes.\nFixe ton prix, tes dates, et commence à gagner.",
    accent: "#10B981",
    accentLight: "#ECFDF5",
  },
  {
    icon: "shield-checkmark" as const,
    title: "Loue l'esprit\ntranquille",
    desc: "Paiement sécurisé, assurance incluse,\nconstat photo à chaque remise.",
    accent: "#8B5CF6",
    accentLight: "#F5F3FF",
  },
];

// ═══════════════════════════════════════════════════════
// Slide component
// ═══════════════════════════════════════════════════════
function Slide({ item }: { item: (typeof SLIDES)[number] }) {
  const { styles } = useStyles();
  return (
    <View style={[styles.slide, { width: SW }]}>
      <View style={[styles.iconCircle, { backgroundColor: item.accentLight }]}>
        <View style={[styles.iconInner, { backgroundColor: item.accent + "18" }]}>
          <Ionicons name={item.icon} size={52} color={item.accent} />
        </View>
      </View>
      <KText style={styles.title}>{item.title}</KText>
      <KText style={styles.desc}>{item.desc}</KText>
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════
export default function OnboardingScreen() {
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const listRef = useRef<FlatList>(null);
  const btnScale = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Fade in on mount
  useState(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  });

  const isLast = currentIndex === SLIDES.length - 1;
  const slide = SLIDES[currentIndex];

  const markSeen = async () => {
    try { await SecureStore.setItemAsync(ONBOARDING_KEY, "true"); } catch {}
  };

  const onDone = useCallback(async () => {
    haptic.success();
    await markSeen();
    router.replace("/(tabs)/home");
  }, []);

  const onSkip = useCallback(async () => {
    haptic.light();
    await markSeen();
    router.replace("/(tabs)/home");
  }, []);

  const onNext = useCallback(() => {
    haptic.medium();
    if (isLast) {
      onDone();
    } else {
      listRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
    Animated.sequence([
      Animated.timing(btnScale, { toValue: 0.93, duration: duration.instant, easing: easing.standard, useNativeDriver: true }),
      Animated.timing(btnScale, { toValue: 1, duration: duration.fast, easing: easing.spring, useNativeDriver: true }),
    ]).start();
  }, [currentIndex, isLast, onDone, btnScale]);

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top + 12, paddingBottom: Math.max(insets.bottom, 20), opacity: fadeAnim }]}>
      {/* Skip button */}
      <KRow justify="flex-end" style={{ paddingHorizontal: 20, height: 44 }}>
        {!isLast && (
          <KPressable onPress={onSkip} style={styles.skipBtn}>
            <KText variant="bodySmall" bold color="textTertiary">Passer</KText>
          </KPressable>
        )}
      </KRow>

      {/* Slides */}
      <FlatList
        ref={listRef}
        data={SLIDES}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item }) => <Slide item={item} />}
        onMomentumScrollEnd={(e) => setCurrentIndex(Math.round(e.nativeEvent.contentOffset.x / SW))}
        scrollEventThrottle={16}
      />

      {/* Bottom controls */}
      <KVStack gap={20} style={{ paddingHorizontal: 24 }}>
        {/* Dots */}
        <KRow justify="center" gap={8}>
          {SLIDES.map((s, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === currentIndex && { backgroundColor: slide.accent, width: 28 },
              ]}
            />
          ))}
        </KRow>

        {/* CTA button */}
        <Animated.View style={{ transform: [{ scale: btnScale }] }}>
          <KPressable onPress={onNext} style={[styles.ctaBtn, { backgroundColor: slide.accent }]}>
            {isLast ? (
              <KText variant="label" bold style={{ color: "#FFF", fontSize: 16 }}>
                C'est parti !
              </KText>
            ) : (
              <>
                <KText variant="label" bold style={{ color: "#FFF", fontSize: 16 }}>
                  Continuer
                </KText>
                <Ionicons name="arrow-forward" size={18} color="#FFF" />
              </>
            )}
          </KPressable>
        </Animated.View>

        {/* Login hint on last slide */}
        {isLast && (
          <KRow justify="center" gap={4}>
            <KText variant="bodySmall" color="textTertiary">Déjà inscrit ?</KText>
            <KPressable onPress={async () => { await markSeen(); router.replace("/login"); }}>
              <KText variant="bodySmall" bold style={{ color: slide.accent }}>Se connecter</KText>
            </KPressable>
          </KRow>
        )}
      </KVStack>
    </Animated.View>
  );
}

// ═══════════════════════════════════════════════════════
// Check if onboarding has been seen
// ═══════════════════════════════════════════════════════
export async function hasSeenOnboarding(): Promise<boolean> {
  try {
    const val = await SecureStore.getItemAsync(ONBOARDING_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

const useStyles = createStyles((colors, isDark) => ({
  container: { flex: 1, backgroundColor: colors.bg },
  skipBtn: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 10 },
  slide: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: 36,
  },
  iconCircle: {
    width: 140, height: 140, borderRadius: 70,
    alignItems: "center", justifyContent: "center", marginBottom: 36,
  },
  iconInner: {
    width: 100, height: 100, borderRadius: 50,
    alignItems: "center", justifyContent: "center",
  },
  title: {
    fontSize: 28, fontWeight: "900", color: colors.text,
    textAlign: "center", letterSpacing: -0.5, marginBottom: 14, lineHeight: 36,
  },
  desc: {
    fontSize: 15, fontWeight: "500", color: colors.textSecondary,
    textAlign: "center", lineHeight: 23,
  },
  dot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: isDark ? colors.bgTertiary : "rgba(0,0,0,0.12)",
  },
  ctaBtn: {
    height: 56, borderRadius: 16, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
}));
