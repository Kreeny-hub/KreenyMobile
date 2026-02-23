import { useMemo, useState } from "react";
import { Text, Button, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { ensureAuth } from "../../src/presentation/utils/ensureAuth";
import { container } from "../../src/shared/config/container";
import { formatDateFR } from "../../src/shared/utils/formatDateFR";
import CalendarModal from "../../src/presentation/components/CalendarModal";
import { useVehicle } from "../../src/presentation/hooks/useVehicle";
import { useUnavailableRanges } from "../../src/presentation/hooks/useUnavailableRanges";

function computeDays(startDate: string, endDate: string) {
  // end exclusive: 2026-02-16 -> 2026-02-18 = 2 jours
  const [y1, m1, d1] = startDate.split("-").map(Number);
  const [y2, m2, d2] = endDate.split("-").map(Number);
  const a = new Date(y1, m1 - 1, d1).getTime();
  const b = new Date(y2, m2 - 1, d2).getTime();
  const diff = b - a;
  const days = diff > 0 ? Math.round(diff / 86400000) : 0;
  return days;
}

function moneyMAD(n: number) {
  // Simple et lisible (pas d'Intl ici pour éviter des surprises RN)
  return `${Math.round(n)} MAD`;
}

export default function Reservation() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();
  const { ranges: unavailableRanges } = useUnavailableRanges(vehicleId ?? "");
  const { vehicle, loading } = useVehicle(vehicleId ?? "");
  const { isAuthenticated } = useAuthStatus();

  const [startDate, setStartDate] = useState<string>("2026-02-16");
  const [endDate, setEndDate] = useState<string>("2026-02-18");
  const [startTime, setStartTime] = useState<string>("10:00");
  const [endTime, setEndTime] = useState<string>("18:00");

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [status, setStatus] = useState("");

  if (loading || !vehicle) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Chargement...</Text>
      </SafeAreaView>
    );
  }

  const pricePerDay = vehicle.pricePerDay ?? 0;

  // ✅ dépôt à afficher avant paiement (MVP)
  const deposit = useMemo(() => {
    return vehicle.depositSelected ?? vehicle.depositMin ?? 3000;
  }, [vehicle.depositSelected, vehicle.depositMin]);

  const days = useMemo(() => computeDays(startDate, endDate), [startDate, endDate]);
  const subtotal = useMemo(() => (days > 0 ? days * pricePerDay : 0), [days, pricePerDay]);

  const create = async () => {
    if (!ensureAuth(isAuthenticated)) return;
    if (!vehicleId) return;

    try {
      setStatus("Création de la réservation...");
      const res = await container.reservationRepository.createReservation({
        vehicleId,
        startDate,
        endDate,
      });

      setStatus(
        `Réservation créée ✅ (${String(res.reservationId)})\n${formatDateFR(startDate)} ${startTime} → ${formatDateFR(endDate)} ${endTime}`
      );
    } catch (e) {
      setStatus(e instanceof Error ? e.message : "Erreur");
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 14 }}>
      <Text style={{ fontSize: 22, fontWeight: "800" }}>Réservation</Text>

      <View style={{ gap: 6 }}>
        <Text style={{ opacity: 0.8 }}>
          {formatDateFR(startDate)} • {startTime} → {formatDateFR(endDate)} • {endTime}
        </Text>
        <Text style={{ opacity: 0.7 }}>{vehicle.title} • {vehicle.city}</Text>
      </View>

      <Pressable
        onPress={() => setCalendarOpen(true)}
        style={{
          borderWidth: 1,
          padding: 14,
          borderRadius: 14,
          gap: 6,
        }}
      >
        <Text style={{ fontWeight: "800" }}>Choisir les dates</Text>
        <Text style={{ opacity: 0.75 }}>
          {formatDateFR(startDate)} {startTime} → {formatDateFR(endDate)} {endTime}
        </Text>
      </Pressable>

      {/* ✅ Résumé prix + caution (premium calme, sans surcharge) */}
      <View
        style={{
          borderWidth: 1,
          borderRadius: 14,
          padding: 14,
          gap: 10,
        }}
      >
        <Text style={{ fontWeight: "800" }}>Récapitulatif</Text>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ opacity: 0.8 }}>
            {days > 0 ? `${days} jour(s) × ${moneyMAD(pricePerDay)}` : "Sélectionne tes dates"}
          </Text>
          <Text style={{ fontWeight: "800" }}>{moneyMAD(subtotal)}</Text>
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ opacity: 0.8 }}>Caution (empreinte)</Text>
          <Text style={{ fontWeight: "800" }}>{moneyMAD(deposit)}</Text>
        </View>

        <Text style={{ opacity: 0.65, lineHeight: 18 }}>
          La caution est une empreinte bancaire (non débitée) libérée après la location s’il n’y a pas de litige.
        </Text>

        {/* Pour l’instant: paiement MVP => total “à payer maintenant” = sous-total */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          <Text style={{ fontWeight: "800" }}>À payer maintenant</Text>
          <Text style={{ fontWeight: "900" }}>{moneyMAD(subtotal)}</Text>
        </View>
      </View>

      {days <= 0 && (
        <Text style={{ opacity: 0.7 }}>
          Choisis une date de début et une date de fin (minimum 1 jour).
        </Text>
      )}

      <Button title="Confirmer la réservation" onPress={create} disabled={days <= 0} />
      {!!status && <Text>Status: {status}</Text>}

      <CalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        pricePerDay={pricePerDay}
        unavailableRanges={unavailableRanges}
        availableFrom={null}
        availableUntil={null}
        onConfirm={({ startDate, endDate, startTime, endTime }) => {
          setStartDate(startDate);
          setEndDate(endDate);
          setStartTime(startTime);
          setEndTime(endTime);
        }}
      />
    </SafeAreaView>
  );
}