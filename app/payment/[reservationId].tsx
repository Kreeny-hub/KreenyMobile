import { useState, useCallback, useRef, useEffect } from "react";
import { View, ScrollView, Alert, Animated, ActivityIndicator, Platform } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useQuery, useAction } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../convex/_generated/api";
import { KText, KVStack, KRow, KPressable, KImage, createStyles } from "../../src/ui";
import { haptic, shadows } from "../../src/theme";
import { staggeredEntrance, fadeUpStyle } from "../../src/theme/motion";
import { showErrorToast } from "../../src/presentation/components/Toast";

// ── Stripe import (optional — works without it in DEV mode) ──
let useStripe: any = null;
let StripePaymentSheet: any = null;
try {
  const stripe = require("@stripe/stripe-react-native");
  useStripe = stripe.useStripe;
} catch {
  // Stripe not installed — DEV mode only
}

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function daysBetween(a: string, b: string) {
  const d = new Date(b).getTime() - new Date(a).getTime();
  return d > 0 ? Math.round(d / 86400000) : 0;
}
function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}
function moneyMAD(n: number) { return `${n.toLocaleString("fr-FR")} MAD`; }

// ═══════════════════════════════════════════════════════
// Price Row
// ═══════════════════════════════════════════════════════
function PriceRow({ label, amount, bold, color }: { label: string; amount: string; bold?: boolean; color?: string }) {
  return (
    <KRow justify="space-between" style={{ paddingVertical: 6 }}>
      <KText variant={bold ? "label" : "bodySmall"} bold={bold} color={color ? undefined : (bold ? undefined : "textSecondary")} style={color ? { color } : undefined}>{label}</KText>
      <KText variant={bold ? "label" : "bodySmall"} bold={bold} color={color ? undefined : (bold ? undefined : "textSecondary")} style={color ? { color } : undefined}>{amount}</KText>
    </KRow>
  );
}

// ═══════════════════════════════════════════════════════
// Main Screen
// ═══════════════════════════════════════════════════════
export default function PaymentScreen() {
  const { reservationId } = useLocalSearchParams<{ reservationId: string }>();
  const { styles, colors, isDark } = useStyles();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<"summary" | "processing" | "success" | "error">("summary");
  const [paying, setPaying] = useState(false);

  const reservation = useQuery(api.reservations.getReservation, reservationId ? { id: reservationId as any } : "skip");
  const createPaymentIntent = useAction(api.stripe.createPaymentIntent);
  const confirmPayment = useAction(api.stripe.confirmPayment);

  // Stripe hook (null if SDK not installed)
  const stripe = useStripe ? useStripe() : null;

  // Animations
  const headerAnim = useRef(new Animated.Value(0)).current;
  const contentAnim = useRef(new Animated.Value(0)).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reservation) {
      staggeredEntrance([headerAnim, contentAnim, ctaAnim]).start();
    }
  }, [reservation]);

  const fadeUp = (anim: Animated.Value) => fadeUpStyle(anim, 12);

  // ── Payment handler ──
  const handlePay = useCallback(async () => {
    if (!reservationId || paying) return;
    haptic.medium();
    setPaying(true);
    setStep("processing");

    try {
      // Step 1: Create PaymentIntent
      const result = await createPaymentIntent({ reservationId: reservationId as any });

      if (result.devMode) {
        // ── DEV MODE: simulate ──
        await new Promise((r) => setTimeout(r, 1500));
        await confirmPayment({ reservationId: reservationId as any });
        setStep("success");
        haptic.success();
        return;
      }

      // ── REAL STRIPE ──
      if (!stripe) {
        Alert.alert(
          "Stripe non installé",
          "Installe @stripe/stripe-react-native et wrap ton app avec StripeProvider."
        );
        setStep("summary");
        setPaying(false);
        return;
      }

      // Step 2: Init PaymentSheet
      const { error: initError } = await stripe.initPaymentSheet({
        paymentIntentClientSecret: result.clientSecret,
        merchantDisplayName: "Kreeny",
        customerId: result.customerId,
        customerEphemeralKeySecret: result.ephemeralKey,
        style: isDark ? "alwaysDark" : "alwaysLight",
        defaultBillingDetails: { address: { country: "MA" } },
      });

      if (initError) {
        console.error("initPaymentSheet error:", initError);
        throw new Error(initError.message);
      }

      // Step 3: Present PaymentSheet
      const { error: presentError } = await stripe.presentPaymentSheet();

      if (presentError) {
        if (presentError.code === "Canceled") {
          // User cancelled — go back to summary
          setStep("summary");
          setPaying(false);
          return;
        }
        throw new Error(presentError.message);
      }

      // Step 4: Confirm in backend (verify + deposit hold)
      await confirmPayment({ reservationId: reservationId as any });
      setStep("success");
      haptic.success();

    } catch (e) {
      setPaying(false);
      setStep("error");
      haptic.error();
      showErrorToast(e);
      setTimeout(() => setStep("summary"), 2000);
    }
  }, [reservationId, paying, createPaymentIntent, confirmPayment, stripe, isDark]);

  // ── Loading ──
  if (!reservation) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  const r = reservation;
  const days = daysBetween(r.startDate, r.endDate);
  const pricePerDay = r.totalAmount && days > 0 ? Math.round(r.totalAmount / days) : 0;
  const totalAmount = r.totalAmount ?? 0;
  const depositAmount = r.depositAmount ?? 0;
  const commission = r.commissionAmount ?? 0;
  const grandTotal = totalAmount + commission;

  // ── Success ──
  if (step === "success") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={{
            width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center",
            backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#ECFDF5",
          }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center",
              backgroundColor: "#10B981",
            }}>
              <Ionicons name="checkmark" size={36} color="#FFF" />
            </View>
          </View>
          <KText variant="h2" bold style={{ marginTop: 24, textAlign: "center" }}>Paiement confirmé</KText>
          <KText variant="body" color="textSecondary" style={{ marginTop: 10, textAlign: "center", lineHeight: 22, maxWidth: 300 }}>
            Ta réservation est confirmée. Le propriétaire va préparer le véhicule pour le constat de départ.
          </KText>
          {depositAmount > 0 && (
            <View style={{
              marginTop: 20, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
              backgroundColor: isDark ? "rgba(16,185,129,0.06)" : "#F0FDF4",
            }}>
              <KRow gap={6} style={{ alignItems: "center" }}>
                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                <KText variant="caption" style={{ color: "#10B981" }}>
                  Caution de {moneyMAD(depositAmount)} sécurisée
                </KText>
              </KRow>
            </View>
          )}
          <KPressable
            onPress={() => router.back()}
            style={{
              marginTop: 32, width: "100%", alignItems: "center", paddingVertical: 15, borderRadius: 14,
              backgroundColor: colors.primary,
            }}
          >
            <KText variant="label" bold style={{ color: "#FFF" }}>Retour</KText>
          </KPressable>
        </View>
      </SafeAreaView>
    );
  }

  // ── Processing ──
  if (step === "processing") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center",
            backgroundColor: isDark ? "rgba(59,130,246,0.08)" : "#EFF6FF",
          }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
          <KText variant="label" bold style={{ marginTop: 20 }}>Traitement en cours…</KText>
          <KText variant="bodySmall" color="textSecondary" center style={{ marginTop: 6, lineHeight: 20 }}>
            Paiement sécurisé par Stripe.{"\n"}Ne ferme pas l'application.
          </KText>
        </View>
      </SafeAreaView>
    );
  }

  // ── Error ──
  if (step === "error") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
          <View style={{
            width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center",
            backgroundColor: isDark ? "rgba(239,68,68,0.08)" : "#FEF2F2",
          }}>
            <Ionicons name="close-circle" size={40} color="#EF4444" />
          </View>
          <KText variant="label" bold style={{ marginTop: 16 }}>Échec du paiement</KText>
          <KText variant="bodySmall" color="textSecondary" center style={{ marginTop: 6 }}>
            Le paiement n'a pas pu être traité. Réessaie.
          </KText>
        </View>
      </SafeAreaView>
    );
  }

  // ── Summary ──
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <KRow gap="sm" style={styles.header}>
        <KPressable onPress={() => { haptic.light(); router.back(); }} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </KPressable>
        <KText variant="label" bold style={{ fontSize: 17 }}>Paiement</KText>
      </KRow>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: 140 }}>

        {/* Vehicle summary */}
        <Animated.View style={fadeUp(headerAnim)}>
          <View style={styles.card}>
            <KRow gap={12} style={{ alignItems: "center" }}>
              <View style={styles.thumb}>
                {r.vehicle?.coverUrl ? (
                  <KImage source={{ uri: r.vehicle.coverUrl }} style={{ width: 64, height: 64 }} />
                ) : (
                  <Ionicons name="car-sport-outline" size={24} color={colors.textTertiary} />
                )}
              </View>
              <KVStack gap={2} style={{ flex: 1 }}>
                <KText variant="label" bold numberOfLines={1}>{r.vehicle?.title ?? "Véhicule"}</KText>
                <KText variant="caption" color="textSecondary">
                  {formatDate(r.startDate)} → {formatDate(r.endDate)} · {days} jour{days > 1 ? "s" : ""}
                </KText>
              </KVStack>
            </KRow>
          </View>
        </Animated.View>

        {/* Price breakdown */}
        <Animated.View style={[{ marginTop: 14 }, fadeUp(contentAnim)]}>
          <View style={styles.card}>
            <KText variant="label" bold style={{ marginBottom: 10 }}>Récapitulatif</KText>
            <PriceRow label={`${moneyMAD(pricePerDay)} × ${days} jour${days > 1 ? "s" : ""}`} amount={moneyMAD(totalAmount)} />
            {commission > 0 && <PriceRow label="Frais de service Kreeny" amount={moneyMAD(commission)} />}
            <View style={{ height: 1, backgroundColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)", marginVertical: 10 }} />
            <PriceRow label="Total à payer" amount={moneyMAD(grandTotal)} bold />
          </View>
        </Animated.View>

        {/* Deposit info */}
        {depositAmount > 0 && (
          <Animated.View style={[{ marginTop: 14 }, fadeUp(contentAnim)]}>
            <View style={[styles.card, { backgroundColor: isDark ? "rgba(16,185,129,0.06)" : "#F0FDF4", borderColor: isDark ? "rgba(16,185,129,0.15)" : "rgba(16,185,129,0.1)" }]}>
              <KRow gap={10} style={{ alignItems: "flex-start" }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? "rgba(16,185,129,0.12)" : "#DCFCE7", alignItems: "center", justifyContent: "center" }}>
                  <Ionicons name="shield-checkmark" size={20} color="#10B981" />
                </View>
                <KVStack gap={3} style={{ flex: 1 }}>
                  <KText variant="label" bold>Caution de {moneyMAD(depositAmount)}</KText>
                  <KText variant="caption" color="textSecondary" style={{ lineHeight: 18 }}>
                    Simple empreinte bancaire, pas un débit. Le montant est autorisé sur ta carte puis libéré automatiquement après le retour du véhicule en bon état.
                  </KText>
                </KVStack>
              </KRow>
            </View>
          </Animated.View>
        )}

        {/* Payment method */}
        <Animated.View style={[{ marginTop: 14 }, fadeUp(contentAnim)]}>
          <View style={styles.card}>
            <KText variant="label" bold style={{ marginBottom: 10 }}>Moyen de paiement</KText>
            <View style={styles.paymentMethod}>
              <View style={styles.cardIcon}>
                <Ionicons name="card" size={20} color={colors.primary} />
              </View>
              <KVStack gap={1} style={{ flex: 1 }}>
                <KText variant="label">Carte bancaire</KText>
                <KText variant="caption" color="textTertiary">
                  {stripe ? "Via Stripe Checkout sécurisé" : "Mode simulation (DEV)"}
                </KText>
              </KVStack>
              <View style={{
                paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                backgroundColor: stripe ? (isDark ? "rgba(16,185,129,0.1)" : "#ECFDF5") : (isDark ? "rgba(245,158,11,0.1)" : "#FFFBEB"),
              }}>
                <KText variant="caption" bold style={{ fontSize: 10, color: stripe ? "#10B981" : "#F59E0B" }}>
                  {stripe ? "STRIPE" : "DEV"}
                </KText>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Security badges */}
        <Animated.View style={[{ marginTop: 18 }, fadeUp(contentAnim)]}>
          <KRow gap={16} justify="center" style={{ paddingVertical: 4 }}>
            <KRow gap={4} style={{ alignItems: "center" }}>
              <Ionicons name="lock-closed" size={12} color={colors.textTertiary} />
              <KText variant="caption" color="textTertiary">Chiffré SSL</KText>
            </KRow>
            <KRow gap={4} style={{ alignItems: "center" }}>
              <Ionicons name="shield-checkmark" size={12} color={colors.textTertiary} />
              <KText variant="caption" color="textTertiary">PCI DSS</KText>
            </KRow>
            <KRow gap={4} style={{ alignItems: "center" }}>
              <Ionicons name="card" size={12} color={colors.textTertiary} />
              <KText variant="caption" color="textTertiary">3D Secure</KText>
            </KRow>
          </KRow>
        </Animated.View>
      </ScrollView>

      {/* Fixed CTA */}
      <Animated.View style={[styles.ctaBar, { paddingBottom: Math.max(insets.bottom, 16) }, fadeUp(ctaAnim)]}>
        <KVStack gap={2} style={{ flex: 1 }}>
          <KText variant="h3" bold>{moneyMAD(grandTotal)}</KText>
          <KText variant="caption" color="textSecondary">
            {days} jour{days > 1 ? "s" : ""} {depositAmount > 0 ? `+ caution ${moneyMAD(depositAmount)}` : ""}
          </KText>
        </KVStack>
        <KPressable
          onPress={handlePay}
          disabled={paying}
          style={[styles.payBtn, paying && { opacity: 0.6 }]}
        >
          {paying ? (
            <ActivityIndicator color="#FFF" size="small" />
          ) : (
            <>
              <Ionicons name="lock-closed" size={15} color="#FFF" />
              <KText variant="label" bold style={{ color: "#FFF" }}>Payer {moneyMAD(grandTotal)}</KText>
            </>
          )}
        </KPressable>
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = createStyles((colors, isDark) => ({
  header: {
    paddingHorizontal: 18, paddingVertical: 12, alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center",
    backgroundColor: isDark ? colors.bgTertiary : "#F3F4F6",
  },
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
  },
  thumb: {
    width: 64, height: 64, borderRadius: 14, overflow: "hidden",
    backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
    alignItems: "center", justifyContent: "center",
  },
  paymentMethod: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: isDark ? colors.bgTertiary : "#F9FAFB",
    borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  cardIcon: {
    width: 44, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center",
    backgroundColor: isDark ? "rgba(59,130,246,0.1)" : "#EFF6FF",
  },
  ctaBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 18, paddingTop: 14,
    backgroundColor: colors.bg,
    borderTopWidth: 1, borderTopColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
  },
  payBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.primary, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 14,
  },
}));
