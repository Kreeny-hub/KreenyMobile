import { Text, View, Button, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";

function statusLabel(status: string) {
  switch (status) {
    case "requested":
      return "Demande reçue";
    case "accepted_pending_payment":
      return "Acceptée — en attente de paiement";
    case "pickup_pending":
      return "Paiement validé — constat départ requis";
    case "in_progress":
      return "En cours";
    case "dropoff_pending":
      return "Retour — constat requis";
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

export default function OwnerVehicleReservations() {
  const { vehicleId } = useLocalSearchParams<{ vehicleId: string }>();

  const reservations = useQuery(
    api.reservations.listReservationsForOwnerVehicle,
    vehicleId ? { vehicleId: vehicleId as any } : "skip"
  );

  const accept = useMutation(api.reservations.acceptReservation);
  const reject = useMutation(api.reservations.rejectReservation);
  const markDropoff = useMutation(api.reservations.markDropoffPending);

  if (!vehicleId) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Missing vehicle id</Text>
      </SafeAreaView>
    );
  }

  if (!reservations) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  if (reservations.length === 0) {
    return (
      <SafeAreaView style={{ flex: 1, padding: 16 }}>
        <Text>Aucune réservation pour ce véhicule.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 12 }}>
        Réservations / demandes
      </Text>

      <View style={{ gap: 12 }}>
        {reservations.map((r) => (
          <View
            key={r._id}
            style={{
              borderWidth: 1,
              borderRadius: 12,
              padding: 12,
            }}
          >
            <Text style={{ fontWeight: "700" }}>{statusLabel(r.status)}</Text>
            <Text style={{ marginTop: 4 }}>
              Du {r.startDate} au {r.endDate}
            </Text>
            <Text style={{ marginTop: 4 }}>Locataire: {r.renterUserId}</Text>

            <View style={{ gap: 8, marginTop: 10 }}>
              {/* Actions côté loueur */}
              {r.status === "requested" && (
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button
                    title="Accepter"
                    onPress={async () => {
                      try {
                        await accept({ reservationId: r._id });
                      } catch (e) {
                        Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
                      }
                    }}
                  />
                  <Button
                    title="Refuser"
                    onPress={async () => {
                      try {
                        await reject({ reservationId: r._id });
                      } catch (e) {
                        Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
                      }
                    }}
                  />
                </View>
              )}

              {r.status === "pickup_pending" && (
                <Button
                  title="Faire le constat départ (loueur)"
                  onPress={() =>
                    router.push(
                      `/reservation/${r._id}/report?phase=checkin&role=owner`
                    )
                  }
                />
              )}

              {r.status === "in_progress" && (
                <Button
                  title="Simuler le retour (DEV)"
                  onPress={async () => {
                    try {
                      await markDropoff({ reservationId: r._id });
                      Alert.alert("OK", "Retour simulé. Constat retour requis.");
                    } catch (e) {
                      Alert.alert("Erreur", e instanceof Error ? e.message : "Erreur inconnue");
                    }
                  }}
                />
              )}

              {r.status === "dropoff_pending" && (
                <Button
                  title="Faire le constat retour (loueur)"
                  onPress={() =>
                    router.push(
                      `/reservation/${r._id}/report?phase=checkout&role=owner`
                    )
                  }
                />
              )}
            </View>
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}