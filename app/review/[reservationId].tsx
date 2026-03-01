import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Keyboard, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from "react-native";
import { router, Stack, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "../../convex/_generated/api";
import { haptic, duration, easing } from "../../src/theme";
import { KText, KVStack, KRow, KPressable, KImage, KStarRating, createStyles } from "../../src/ui";
import { Alert } from "react-native";

// ═══════════════════════════════════════════════════════
// Criteria config per role
// ═══════════════════════════════════════════════════════
const RENTER_CRITERIA = [
  { key: "communication", label: "Communication", emoji: "💬", question: "Comment était la communication\navec le propriétaire ?" },
  { key: "conformity", label: "Conformité", emoji: "✅", question: "Le véhicule correspondait-il\nà l'annonce ?" },
  { key: "cleanliness", label: "Propreté", emoji: "✨", question: "Dans quel état de propreté\nétait le véhicule ?" },
  { key: "punctuality", label: "Ponctualité", emoji: "⏰", question: "Les horaires ont-ils\nété respectés ?" },
] as const;

const OWNER_CRITERIA = [
  { key: "communication", label: "Communication", emoji: "💬", question: "Comment était la communication\navec le locataire ?" },
  { key: "cleanliness", label: "Propreté au retour", emoji: "✨", question: "Dans quel état de propreté\nle véhicule a-t-il été rendu ?" },
  { key: "vehicleCare", label: "Soin du véhicule", emoji: "🛡️", question: "Le locataire a-t-il pris\nsoin du véhicule ?" },
  { key: "punctuality", label: "Ponctualité", emoji: "⏰", question: "Les horaires de retour\nont-ils été respectés ?" },
] as const;

const RATING_LABELS = ["", "Très mauvais", "Mauvais", "Correct", "Bien", "Excellent"];

type RatingsState = Record<string, number>;

// ═══════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════
export default function ReviewScreen() {
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();
  const { styles, colors } = useStyles();
  const insets = useSafeAreaInsets();

  const canReviewData = useQuery(api.reviews.canReview, reservationId ? { reservationId: reservationId as any } : "skip");
  const reservation = useQuery(api.reservations.getReservation, reservationId ? { id: reservationId as any } : "skip");
  const submitMutation = useMutation(api.reviews.submit);

  const [ratings, setRatings] = useState<RatingsState>({});
  const [step, setStep] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide", () => setKeyboardVisible(false));
    return () => { showSub.remove(); hideSub.remove(); };
  }, []);

  // Loading
  if (!canReviewData || !reservation) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.center, { paddingTop: insets.top }]}><KText variant="body" color="textSecondary">Chargement...</KText></View>
      </>
    );
  }

  // Already reviewed → show success page
  if (!canReviewData.canReview && canReviewData.reason === "already_reviewed") {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark-circle" size={44} color="#10B981" />
          </View>
          <KText variant="displaySmall" bold center style={{ marginTop: 20 }}>Avis publié !</KText>
          <KText variant="body" color="textSecondary" center style={{ marginTop: 8, lineHeight: 22, maxWidth: 280 }}>
            Ton avis a bien été pris en compte. Merci pour ta contribution !
          </KText>
          <KVStack gap="sm" style={{ width: "100%", marginTop: 28, paddingHorizontal: 8 }}>
            <KPressable onPress={() => router.replace("/profile/reservations")} style={styles.successPrimaryBtn}>
              <KText variant="label" bold color="textInverse">Voir mes réservations</KText>
            </KPressable>
            <KPressable onPress={() => router.back()} style={styles.successSecondaryBtn}>
              <KText variant="label" bold>Retour</KText>
            </KPressable>
          </KVStack>
        </View>
      </>
    );
  }

  // Blocked (other reasons)
  if (!canReviewData.canReview) {
    const messages: Record<string, string> = {
      not_authenticated: "Connecte-toi pour laisser un avis.",
      not_found: "Réservation introuvable.",
      not_completed: "Tu peux laisser un avis une fois la location terminée.",
      not_participant: "Tu ne fais pas partie de cette réservation.",
    };
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <Text style={{ fontSize: 48, lineHeight: 60 }}>📝</Text>
          <KText variant="label" bold center style={{ marginTop: 12 }}>{messages[canReviewData.reason] ?? "Impossible."}</KText>
          <KPressable onPress={() => router.back()} style={styles.pillBtn}>
            <KText variant="label" bold style={{ color: colors.primary }}>Retour</KText>
          </KPressable>
        </View>
      </>
    );
  }

  const isRenter = canReviewData.role === "renter";
  const criteria = isRenter ? RENTER_CRITERIA : OWNER_CRITERIA;
  const vehicle = reservation?.vehicle;
  const totalSteps = criteria.length + 1;
  const isCommentStep = step === criteria.length;
  const currentCriterion = !isCommentStep ? criteria[step] : null;

  // ── SUCCESS PAGE ──
  if (submitted) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <View style={styles.successCircle}>
            <Ionicons name="checkmark-circle" size={44} color="#10B981" />
          </View>
          <KText variant="displaySmall" bold center style={{ marginTop: 20 }}>Merci ! 🎉</KText>
          <KText variant="body" color="textSecondary" center style={{ marginTop: 8, lineHeight: 22, maxWidth: 280 }}>
            Ton avis a bien été publié. Il aide la communauté Kreeny à s'améliorer.
          </KText>

          {/* Recap */}
          <KRow gap={6} align="center" style={{ marginTop: 20 }}>
            <Ionicons name="star" size={22} color="#F59E0B" />
            <KText variant="displayMedium" bold>{average}</KText>
            <KText variant="body" color="textSecondary">/5</KText>
          </KRow>

          <KVStack gap="sm" style={{ width: "100%", marginTop: 28, paddingHorizontal: 8 }}>
            <KPressable onPress={() => router.replace("/profile/reservations")} style={styles.successPrimaryBtn}>
              <KText variant="label" bold color="textInverse">Voir mes réservations</KText>
            </KPressable>
            <KPressable onPress={() => router.back()} style={styles.successSecondaryBtn}>
              <KText variant="label" bold>Retour</KText>
            </KPressable>
          </KVStack>
        </View>
      </>
    );
  }

  const animateTransition = (next: number) => {
    const goingForward = next > step;
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 220, easing: easing.exit, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: goingForward ? -30 : 30, duration: 220, easing: easing.exit, useNativeDriver: true }),
    ]).start(() => {
      setStep(next);
      slideAnim.setValue(goingForward ? 30 : -30);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 340, easing: easing.enter, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 340, easing: easing.enter, useNativeDriver: true }),
      ]).start();
    });
  };

  const onRate = (key: string, val: number) => {
    haptic.medium();
    setRatings((prev) => ({ ...prev, [key]: val }));
    setTimeout(() => {
      if (step < criteria.length) animateTransition(step + 1);
    }, 550);
  };

  const goBack = () => { if (step > 0) animateTransition(step - 1); };

  const allRated = criteria.every((c) => (ratings[c.key] ?? 0) > 0);
  const average = allRated
    ? Math.round((criteria.reduce((sum, c) => sum + (ratings[c.key] ?? 0), 0) / criteria.length) * 10) / 10
    : 0;

  const onSubmit = async () => {
    if (!allRated) return;
    setSubmitting(true);
    try {
      await submitMutation({
        reservationId: reservationId as any,
        ratings: {
          communication: ratings.communication,
          punctuality: ratings.punctuality,
          cleanliness: ratings.cleanliness,
          conformity: isRenter ? ratings.conformity : undefined,
          vehicleCare: !isRenter ? ratings.vehicleCare : undefined,
        },
        comment: comment.trim() || undefined,
      });
      haptic.success();
      setSubmitted(true);
    } catch (e) {
      haptic.error();
      Alert.alert("Erreur", e instanceof Error ? e.message : "Impossible de publier l'avis.");
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
        style={{ flex: 1, backgroundColor: colors.bg }}
      >
        <View style={{ flex: 1, paddingTop: insets.top }}>

          {/* ── Custom header: X close + vehicle mini ── */}
          <View style={styles.header}>
            <KPressable onPress={() => router.back()} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color={colors.text} />
            </KPressable>
            {vehicle && (
              <KRow gap={8} align="center" style={{ flex: 1, marginLeft: 12 }}>
                {vehicle.coverUrl ? (
                  <KImage source={{ uri: vehicle.coverUrl }} style={styles.vehicleThumb} />
                ) : null}
                <KText variant="bodySmall" bold numberOfLines={1} style={{ flex: 1 }}>{vehicle.title}</KText>
              </KRow>
            )}
            <KText variant="caption" color="textTertiary">{step + 1}/{totalSteps}</KText>
          </View>

          {/* Progress bar */}
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: `${((step + 1) / totalSteps) * 100}%` }]} />
          </View>

          {/* Content */}
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{ flexGrow: 1, justifyContent: isCommentStep ? "flex-start" : "center", padding: 24, paddingTop: isCommentStep ? 24 : 0 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

              {/* ── Criterion step ── */}
              {!isCommentStep && currentCriterion && (
                <KVStack align="center" gap={20}>
                  <View style={styles.emojiWrap}><Text style={styles.emoji}>{currentCriterion.emoji}</Text></View>
                  <KText style={styles.question}>
                    {currentCriterion.question}
                  </KText>
                  <KText variant="bodySmall" color="textTertiary" center>
                    {currentCriterion.label}
                  </KText>

                  <View style={{ marginTop: 12 }}>
                    <KStarRating
                      rating={ratings[currentCriterion.key] ?? 0}
                      onRate={(v) => onRate(currentCriterion.key, v)}
                      size={44}
                      gap={12}
                    />
                  </View>

                  {(ratings[currentCriterion.key] ?? 0) > 0 && (
                    <View style={[styles.ratingBadge, { backgroundColor: colors.primary + "15" }]}>
                      <KText variant="label" bold style={{ color: colors.primary }}>
                        {RATING_LABELS[ratings[currentCriterion.key]]}
                      </KText>
                    </View>
                  )}
                </KVStack>
              )}

              {/* ── Comment step ── */}
              {isCommentStep && (
                <KVStack gap={20}>
                  {/* Summary */}
                  <KVStack align="center" gap={8}>
                    <View style={styles.emojiWrap}><Text style={styles.emoji}>🎯</Text></View>
                    <KText variant="h2" bold center>Note globale</KText>
                    <KRow gap={6} align="center">
                      <Ionicons name="star" size={22} color="#F59E0B" />
                      <KText variant="displayMedium" bold>{average}</KText>
                      <KText variant="body" color="textSecondary">/5</KText>
                    </KRow>
                  </KVStack>

                  {/* Mini recap — tappable to edit */}
                  <View style={styles.recapCard}>
                    {criteria.map((c, i) => (
                      <KPressable key={c.key} onPress={() => animateTransition(i)} style={styles.recapRow}>
                        <KText variant="bodySmall">{c.label}</KText>
                        <KRow gap={4} align="center">
                          <KStarRating rating={ratings[c.key] ?? 0} size={13} />
                          <KText variant="bodySmall" bold>{ratings[c.key]}</KText>
                        </KRow>
                      </KPressable>
                    ))}
                  </View>

                  {/* Comment */}
                  <KVStack gap={8}>
                    <KText variant="label" bold>Un commentaire ? (optionnel)</KText>
                    <TextInput
                      value={comment}
                      onChangeText={setComment}
                      placeholder="Raconte ton expérience..."
                      placeholderTextColor={colors.inputPlaceholder}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      maxLength={500}
                      autoCapitalize="sentences"
                      autoCorrect={true}
                      spellCheck={true}
                      onFocus={() => setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300)}
                      style={styles.textArea}
                    />
                    <KText variant="caption" color="textTertiary" style={styles.charCount}>{comment.length}/500</KText>
                  </KVStack>

                  {/* Inline actions — visible when keyboard is up */}
                  {keyboardVisible && (
                    <KRow gap={12} align="center" style={styles.inlineActions}>
                      <KPressable onPress={goBack} style={styles.backTextBtn}>
                        <KText variant="bodySmall" style={styles.backText}>← Précédent</KText>
                      </KPressable>
                      <View style={styles.flex1} />
                      <KPressable onPress={onSubmit} disabled={submitting || !allRated}
                        style={[styles.submitBtn, (submitting || !allRated) && styles.submitDisabled]}>
                        <KText variant="label" bold style={styles.submitLabel}>
                          {submitting ? "Publication..." : "Publier mon avis"}
                        </KText>
                      </KPressable>
                    </KRow>
                  )}
                </KVStack>
              )}

            </Animated.View>
          </ScrollView>

          {/* ── Bottom bar — hidden when keyboard covers it ── */}
          {!(isCommentStep && keyboardVisible) && (
          <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 16) }]}>
            {step > 0 ? (
              <KPressable onPress={goBack} style={styles.backTextBtn}>
                <KText variant="bodySmall" style={styles.backText}>← Précédent</KText>
              </KPressable>
            ) : (
              <View />
            )}
            <View style={styles.flex1} />
            {isCommentStep && (
              <KPressable onPress={onSubmit} disabled={submitting || !allRated}
                style={[styles.submitBtn, (submitting || !allRated) && styles.submitDisabled]}>
                <KText variant="label" bold style={styles.submitLabel}>
                  {submitting ? "Publication..." : "Publier mon avis"}
                </KText>
              </KPressable>
            )}
          </View>
          )}

        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: colors.bg, gap: 8 },
  successCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  successPrimaryBtn: { backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  successSecondaryBtn: { backgroundColor: colors.card, borderRadius: 16, paddingVertical: 14, alignItems: "center", borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)" },
  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 10, gap: 8,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  vehicleThumb: { width: 36, height: 28, borderRadius: 6 },
  progressBar: {
    height: 3, backgroundColor: isDark ? colors.bgTertiary : "#E5E7EB",
    marginHorizontal: 16, borderRadius: 2, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: colors.primary, borderRadius: 2 },
  emoji: { fontSize: 52, textAlign: "center" },
  emojiWrap: { width: 88, height: 88, alignItems: "center", justifyContent: "center", overflow: "visible", marginBottom: 4 },
  question: {
    fontSize: 22, fontWeight: "800", color: colors.text, textAlign: "center",
    lineHeight: 30, letterSpacing: -0.3,
  },
  ratingBadge: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  recapCard: {
    borderRadius: 16, overflow: "hidden",
    backgroundColor: isDark ? colors.bgTertiary : "#F9FAFB",
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  recapRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.04)",
  },
  textArea: {
    backgroundColor: colors.inputBg, borderRadius: 14, borderWidth: 1.5,
    borderColor: isDark ? colors.inputBorder : "rgba(0,0,0,0.06)",
    padding: 14, fontSize: 15, fontWeight: "500", color: colors.inputText, minHeight: 100,
  },
  bottomBar: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingTop: 12,
  },
  backTextBtn: {
    paddingVertical: 10, paddingHorizontal: 4,
  },
  backText: { color: colors.textSecondary },
  submitBtn: {
    backgroundColor: colors.primary, borderRadius: 14,
    paddingHorizontal: 24, height: 46,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitDisabled: { opacity: 0.5 },
  submitLabel: { color: "#FFF", fontSize: 15 },
  charCount: { alignSelf: "flex-end" },
  inlineActions: { paddingTop: 8 },
  flex1: { flex: 1 },
  pillBtn: {
    marginTop: 16, paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 12, borderWidth: 1.5, borderColor: colors.primary + "30",
  },
}));
