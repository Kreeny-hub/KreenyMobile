import { Text, Pressable, View, Button, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMyReservations } from "../../src/presentation/hooks/useMyReservations";
import { formatDateFR } from "../../src/shared/utils/formatDateFR";
import { useAuthStatus } from "../../src/presentation/hooks/useAuthStatus";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

function statusLabel(status: string) {
  switch (status) {
    case "requested":
      return "Demande envoyée";
    case "accepted_pending_payment":
      return "Acceptée — paiement requis";
    case "pickup_pending":
      return "Départ — preuves à faire";
    case "in_progress":
      return "En cours";
    case "dropoff_pending":
      return "Retour — preuves à faire";
    case "completed":
      return "Terminée";
    case "rejected":
      return "Refusée";
    case "cancelled":
      return "Annulée";
    default:
      return status;
  }
}

function canPay(status: string) {
  return status === "accepted_pending_payment";
}

function canDoCheckin(status: string) {
  return status === "pickup_pending";
}

function canDoCheckout(status: string) {
  return status === "dropoff_pending";
}

export default function ReservationsScreen() {
  const { isAuthenticated, isLoading } = useAuthStatus();
  const { items, loading, error } = useMyReservations();
  const markPaid = useMutation(api.reservations.markReservationPaid);
  const markDropoff = useMutation(api.reservations.markDropoffPending);
  const initPayment = useMutation(api.reservations.initPayment);

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, justifyContent: "center" }}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16, gap: 12, justifyContent: "center" }}>
        <Text style={{ fontSize: 18, fontWeight: "700" }}>
          Connecte-toi pour voir tes réservations
        </Text>
        <Button title="Se connecter" onPress={() => router.push("/login")} />
        <Button title="Créer un compte" onPress={() => router.push("/signup")} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 20, fontWeight: "700" }}>Mes réservations</Text>

      {(loading || !items) && <Text>Loading...</Text>}
      {error && <Text>Error: {error}</Text>}

      {!loading &&
        !error &&
        items.map(({ reservation, vehicle }) => {
          const title = vehicle ? `${vehicle.title} — ${vehicle.city}` : "Véhicule supprimé";

          return (
            <Pressable
              key={reservation._id}
              style={{ paddingVertical: 12, borderBottomWidth: 1 }}
              onPress={() => router.push(`/reservation/${reservation.vehicleId}`)}
            >
              <Text style={{ fontWeight: "700" }}>{title}</Text>

              <Text style={{ marginTop: 4 }}>
                {formatDateFR(reservation.startDate)} → {formatDateFR(reservation.endDate)} •{" "}
                {statusLabel(reservation.status)}
              </Text>

              {/* Actions contextuelles */}
              <View style={{ marginTop: 10, gap: 8 }}>
                {canPay(reservation.status) && (
                  <View style={{ gap: 8 }}>
                    <Button
                      title="Payer maintenant"
                      onPress={() => {
                        Alert.alert("Payer maintenant ?", "Le paiement sera initialisé.", [
                          { text: "Annuler", style: "cancel" },
                          {
                            text: "Payer",
                            onPress: async () => {
                              try {
                                await initPayment({ reservationId: reservation._id as any });
                                Alert.alert(
                                  "Paiement",
                                  "Paiement initialisé. (Stripe bientôt) \n\nDEV: utilise le bouton ci-dessous pour simuler le paiement."
                                );
                              } catch (e) {
                                Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
                              }
                            },
                          },
                        ]);
                      }}
                    />

                    {/* ✅ DEV ONLY : simulation paiement */}
                    <Button
                      title="Simuler paiement réussi (DEV)"
                      onPress={async () => {
                        try {
                          await markPaid({ reservationId: reservation._id as any });
                          Alert.alert("Paiement validé", "Tu peux maintenant faire le constat départ.");
                        } catch (e) {
                          Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
                        }
                      }}
                    />
                  </View>
                )}

                {/* ✅ NOUVEAU : Constat départ */}
                {canDoCheckin(reservation.status) && (
                  <Button
                    title="Faire le constat départ"
                    onPress={() =>
                      router.push(
                        `/reservation/${reservation._id}/report?phase=checkin&role=renter`
                      )
                    }
                  />
                )}

                {/* ✅ Constat retour */}
                {canDoCheckout(reservation.status) && (
                  <Button
                    title="Faire le constat retour"
                    onPress={() =>
                      router.push(
                        `/reservation/${reservation._id}/report?phase=checkout&role=renter`
                      )
                    }
                  />
                )}
              </View>
            </Pressable>
          );
        })}
    </SafeAreaView>
  );
}