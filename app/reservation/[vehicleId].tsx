import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery } from "convex/react";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../convex/_generated/api";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { ensureAuth } from "../../src/presentation/utils/ensureAuth";
import { container } from "../../src/shared/config/container";
import { formatDateFR } from "../../src/shared/utils/formatDateFR";
import CalendarModal from "../../src/presentation/components/CalendarModal";
import { useUnavailableRanges } from "../../src/presentation/hooks/useUnavailableRanges";
import { useTheme } from "../../src/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function computeDays(start: string, end: string) {
  const [y1, m1, d1] = start.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  const diff = b - a;
  return diff > 0 ? Math.round(diff / 86400000) : 0;
}

function moneyMAD(n: number) {
  return `${Math.round(n)} MAD`;
}

// ═══════════════════════════════════════════════════════
// Card wrapper
// ═══════════════════════════════════════════════════════
function Card({ children, colors, isDark, style }: any) {
  return (
    <View style={[{
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.05)",
    }, style]}>
      {children}
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// Vehicle Summary
// ═══════════════════════════════════════════════════════
function VehicleSummary({ vehicle, coverUrl, colors, isDark }: any) {
  return (
    <Card colors={colors} isDark={isDark}>
      <View style={{ flexDirection: "row", gap: 14 }}>
        {/* Thumbnail */}
        {coverUrl ? (
          <Image
            source={{ uri: coverUrl }}
            style={{
              width: 90, height: 70, borderRadius: 12,
              backgroundColor: colors.bgTertiary,
            }}
            resizeMode="cover"
          />
        ) : (
          <View style={{
            width: 90, height: 70, borderRadius: 12,
            backgroundColor: isDark ? colors.bgTertiary : "#F0F3FA",
            alignItems: "center", justifyContent: "center",
          }}>
            <Ionicons name="car-sport-outline" size={24} color={colors.textTertiary} />
          </View>
        )}

        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>
            {vehicle.title}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
            <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
            <Text style={{ fontSize: 13, color: colors.textSecondary }}>{vehicle.city}</Text>
          </View>
          <Text style={{ fontSize: 14, fontWeight: "800", color: colors.primary, marginTop: 4 }}>
            {vehicle.pricePerDay} MAD <Text style={{ fontSize: 12, fontWeight: "500", color: colors.textSecondary }}>/ jour</Text>
          </Text>
        </View>
      </View>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// Date Selector Card
// ═══════════════════════════════════════════════════════
function DateSelector({
  startDate,
  endDate,
  startTime,
  endTime,
  days,
  onPress,
  colors,
  isDark,
}: any) {
  const hasSelection = startDate && endDate && days > 0;

  return (
    <Pressable onPress={onPress}>
      <Card colors={colors} isDark={isDark}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text }}>Dates de location</Text>
          <View style={{
            backgroundColor: colors.primaryLight,
            borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5,
          }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: colors.primary }}>
              {hasSelection ? `${days} jour${days > 1 ? "s" : ""}` : "Choisir"}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 10 }}>
          {/* Départ */}
          <View style={{
            flex: 1, padding: 12, borderRadius: 14,
            backgroundColor: isDark ? colors.bgTertiary : "#F7F8FA",
            gap: 4,
          }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textTertiary }}>DÉPART</Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {startDate ? formatDateFR(startDate) : "Sélectionner"}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{startTime}</Text>
          </View>

          {/* Arrow */}
          <View style={{ justifyContent: "center" }}>
            <Ionicons name="arrow-forward" size={18} color={colors.textTertiary} />
          </View>

          {/* Retour */}
          <View style={{
            flex: 1, padding: 12, borderRadius: 14,
            backgroundColor: isDark ? colors.bgTertiary : "#F7F8FA",
            gap: 4,
          }}>
            <Text style={{ fontSize: 11, fontWeight: "600", color: colors.textTertiary }}>RETOUR</Text>
            <Text style={{ fontSize: 14, fontWeight: "700", color: colors.text }}>
              {endDate ? formatDateFR(endDate) : "Sélectionner"}
            </Text>
            <Text style={{ fontSize: 12, color: colors.textSecondary }}>{endTime}</Text>
          </View>
        </View>

        {/* Tap hint */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12 }}>
          <Ionicons name="calendar-outline" size={14} color={colors.primary} />
          <Text style={{ fontSize: 12, fontWeight: "600", color: colors.primary }}>
            Appuyer pour modifier les dates
          </Text>
        </View>
      </Card>
    </Pressable>
  );
}

// ═══════════════════════════════════════════════════════
// Pricing Breakdown
// ═══════════════════════════════════════════════════════
function PricingBreakdown({ days, pricePerDay, deposit, colors, isDark }: any) {
  const subtotal = days > 0 ? days * pricePerDay : 0;
  const hasDeposit = deposit > 0;

  return (
    <Card colors={colors} isDark={isDark}>
      <Text style={{ fontSize: 15, fontWeight: "700", color: colors.text, marginBottom: 14 }}>Récapitulatif</Text>

      {/* Price per day */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
        <Text style={{ color: colors.textSecondary, fontSize: 14 }}>
          {days > 0 ? `${days} jour${days > 1 ? "s" : ""} × ${moneyMAD(pricePerDay)}` : "Sélectionne tes dates"}
        </Text>
        <Text style={{ fontWeight: "800", color: colors.text, fontSize: 14 }}>{moneyMAD(subtotal)}</Text>
      </View>

      {/* Deposit */}
      {hasDeposit && (
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 10 }}>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Caution (empreinte)</Text>
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 14 }}>{moneyMAD(deposit)}</Text>
        </View>
      )}

      {/* Divider */}
      <View style={{ height: 1, backgroundColor: isDark ? colors.border : "#EFEFEF", marginVertical: 10 }} />

      {/* Total */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontWeight: "800", color: colors.text, fontSize: 15 }}>À payer maintenant</Text>
        <Text style={{ fontWeight: "800", color: colors.primary, fontSize: 18 }}>{moneyMAD(subtotal)}</Text>
      </View>

      {/* Hint */}
      {hasDeposit && (
        <Text style={{ color: colors.textTertiary, fontSize: 12, lineHeight: 17, marginTop: 10 }}>
          La caution est une empreinte bancaire non débitée, libérée après restitution du véhicule sans dommage.
        </Text>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════
// Loading Skeleton
// ═══════════════════════════════════════════════════════
function ReservationSkeleton() {
  const { colors } = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const opacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] });
  const Box = ({ w, h, r = 8, style }: any) => (
    <Animated.View style={[{ width: w, height: h, borderRadius: r, backgroundColor: colors.skeleton, opacity }, style]} />
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 18, gap: 14 }}>
      <Box w="100%" h={90} r={18} />
      <Box w="100%" h={140} r={18} />
      <Box w="100%" h={160} r={18} />
    </View>
  );
}

// ═══════════════════════════════════════════════════════
// MAIN SCREEN
// ═══════════════════════════════════════════════════════
export default function Reservation() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { isAuthenticated } = useAuthStatus();
  const { ranges: unavailableRanges } = useUnavailableRanges(vehicleId ?? "");

  // Fetch vehicle with cover image
  const vehicle = useQuery(
    api.vehicles.getVehicleWithImages,
    vehicleId ? { id: vehicleId as any } : "skip"
  );

  const coverUrl = vehicle?.resolvedImageUrls?.[0] ?? null;

  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endTime, setEndTime] = useState<string>("18:00");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  if (!vehicleId) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 18 }}>
        <Text style={{ color: colors.text }}>Véhicule introuvable</Text>
      </SafeAreaView>
    );
  }

  if (vehicle === undefined) return <ReservationSkeleton />;

  if (vehicle === null) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", gap: 12 }}>
        <Ionicons name="alert-circle-outline" size={48} color={colors.textTertiary} />
        <Text style={{ fontSize: 16, fontWeight: "700", color: colors.text }}>Annonce introuvable</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={{ color: colors.primary, fontWeight: "700" }}>Retour</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const pricePerDay = vehicle.pricePerDay ?? 0;
  const deposit = vehicle.depositSelected ?? vehicle.depositMin ?? 0;
  const days = startDate && endDate ? computeDays(startDate, endDate) : 0;
  const subtotal = days > 0 ? days * pricePerDay : 0;
  const canConfirm = days > 0 && status !== "loading";

  const onConfirm = async () => {
    if (!ensureAuth(isAuthenticated)) return;
    if (!vehicleId || !startDate || !endDate || days <= 0) return;

    try {
      setStatus("loading");
      setErrorMsg("");
      const res = await container.reservationRepository.createReservation({
        vehicleId,
        startDate,
        endDate,
      });
      setStatus("success");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : "Une erreur est survenue");
    }
  };

  if (status === "success") {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 }}>
        <View style={{
          width: 72, height: 72, borderRadius: 36,
          backgroundColor: "#ECFDF5",
          alignItems: "center", justifyContent: "center",
        }}>
          <Ionicons name="checkmark-circle" size={40} color="#10B981" />
        </View>
        <Text style={{ fontSize: 20, fontWeight: "800", color: colors.text, textAlign: "center" }}>
          Demande envoyée !
        </Text>
        <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: "center", lineHeight: 20 }}>
          Le propriétaire va examiner ta demande. Tu recevras une notification dès qu'il aura répondu.
        </Text>

        <View style={{ gap: 10, width: "100%", marginTop: 8 }}>
          <Pressable
            onPress={() => router.replace("/profile/reservations")}
            style={({ pressed }) => ({
              backgroundColor: colors.primary, borderRadius: 16,
              paddingVertical: 14, alignItems: "center",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Voir mes réservations</Text>
          </Pressable>

          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => ({
              backgroundColor: colors.card, borderRadius: 16,
              paddingVertical: 14, alignItems: "center",
              borderWidth: 1, borderColor: isDark ? colors.cardBorder : "rgba(0,0,0,0.06)",
              opacity: pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ color: colors.text, fontWeight: "700", fontSize: 15 }}>Retour à l'annonce</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 18, paddingBottom: Math.max(insets.bottom, 12) + 96, gap: 14 }}
      >
        {/* Vehicle summary */}
        <VehicleSummary vehicle={vehicle} coverUrl={coverUrl} colors={colors} isDark={isDark} />

        {/* Date selection */}
        <DateSelector
          startDate={startDate}
          endDate={endDate}
          startTime={startTime}
          endTime={endTime}
          days={days}
          onPress={() => setCalendarOpen(true)}
          colors={colors}
          isDark={isDark}
        />

        {/* Pricing */}
        <PricingBreakdown
          days={days}
          pricePerDay={pricePerDay}
          deposit={deposit}
          colors={colors}
          isDark={isDark}
        />

        {/* Info hint */}
        <View style={{
          backgroundColor: isDark ? colors.bgTertiary : "#F7F8FA",
          borderRadius: 14, padding: 14,
          flexDirection: "row", gap: 10, alignItems: "flex-start",
        }}>
          <Ionicons name="information-circle-outline" size={18} color={colors.primary} style={{ marginTop: 1 }} />
          <Text style={{ flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 18 }}>
            Ta demande sera envoyée au propriétaire qui aura 24h pour accepter ou refuser. Le paiement n'est prélevé qu'après acceptation.
          </Text>
        </View>

        {/* Error */}
        {status === "error" && errorMsg ? (
          <View style={{
            backgroundColor: "#FEF2F2",
            borderRadius: 14, padding: 14,
            flexDirection: "row", gap: 10, alignItems: "center",
          }}>
            <Ionicons name="alert-circle" size={18} color="#EF4444" />
            <Text style={{ flex: 1, fontSize: 13, color: "#DC2626", fontWeight: "600" }}>{errorMsg}</Text>
          </View>
        ) : null}
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        backgroundColor: colors.bg,
        borderTopWidth: 1,
        borderTopColor: isDark ? colors.border : "rgba(0,0,0,0.06)",
        paddingHorizontal: 18, paddingTop: 12,
        paddingBottom: Math.max(insets.bottom, 12),
        flexDirection: "row", alignItems: "center", gap: 16,
        ...(!isDark ? { shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.06, shadowRadius: 12 } : {}),
      }}>
        <View style={{ flex: 1 }}>
          {days > 0 ? (
            <>
              <Text style={{ fontWeight: "800", color: colors.text, fontSize: 17 }}>{moneyMAD(subtotal)}</Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                {days} jour{days > 1 ? "s" : ""} de location
              </Text>
            </>
          ) : (
            <Text style={{ fontWeight: "600", color: colors.textSecondary, fontSize: 14 }}>Choisis tes dates</Text>
          )}
        </View>

        <Pressable
          onPress={canConfirm ? onConfirm : () => setCalendarOpen(true)}
          style={({ pressed }) => ({
            height: 48,
            paddingHorizontal: 24,
            borderRadius: 16,
            backgroundColor: canConfirm ? colors.primary : colors.bgTertiary,
            alignItems: "center", justifyContent: "center",
            opacity: pressed ? 0.85 : 1,
          })}
        >
          {status === "loading" ? (
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Envoi...</Text>
          ) : canConfirm ? (
            <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 15 }}>Confirmer</Text>
          ) : (
            <Text style={{ color: colors.textSecondary, fontWeight: "700", fontSize: 15 }}>Choisir les dates</Text>
          )}
        </Pressable>
      </View>

      {/* Calendar Modal */}
      <CalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        pricePerDay={pricePerDay}
        unavailableRanges={unavailableRanges}
        availableFrom={null}
        availableUntil={null}
        onConfirm={({ startDate: s, endDate: e, startTime: st, endTime: et }) => {
          setStartDate(s);
          setEndDate(e);
          setStartTime(st);
          setEndTime(et);
        }}
      />
    </View>
  );
}
