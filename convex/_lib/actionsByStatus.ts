type Visibility = "all" | "renter" | "owner";
type ActionItem = { label: string; route: string };

export function computeActionsForStatus(
  status: string,
  paymentStatus?: string
): { text: string; actions: ActionItem[]; visibility: Visibility } {
  switch (status) {
    case "requested":
      return {
        text: "Demande en attente",
        actions: [
          { label: "Accepter la demande", route: "action:ACCEPT" },
          { label: "Refuser la demande", route: "action:REJECT" },
        ],
        visibility: "owner",
      };

    case "accepted_pending_payment":
      if (paymentStatus === "requires_action") {
        return {
          text: "Paiement en cours",
          actions: [{ label: "Simuler paiement réussi (DEV)", route: "action:DEV_MARK_PAID" }],
          visibility: "renter",
        };
      }
      return {
        text: "Paiement requis",
        actions: [{ label: "Payer maintenant", route: "action:PAY_NOW" }],
        visibility: "renter",
      };

    case "pickup_pending":
      return {
        text: "Constat départ requis",
        actions: [{ label: "Faire le constat départ", route: "action:DO_CHECKIN" }],
        visibility: "all",
      };

    case "in_progress":
      return {
        text: "Location en cours",
        actions: [{ label: "Déclarer le retour du véhicule", route: "action:TRIGGER_RETURN" }],
        visibility: "all",
      };

    case "dropoff_pending":
      return {
        text: "Constat retour requis",
        actions: [{ label: "Faire le constat retour", route: "action:DO_CHECKOUT" }],
        visibility: "all",
      };

    default:
      return { text: "Aucune action", actions: [], visibility: "all" };
  }
}
