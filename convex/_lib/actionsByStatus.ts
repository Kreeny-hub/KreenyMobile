type Visibility = "all" | "renter" | "owner";
type ActionItem = { label: string; route: string };

/**
 * ⚠️ DEPRECATED — Les actions sont désormais intégrées directement dans les messages système
 * via reservationEvents.ts. Cette fonction est conservée pour compatibilité avec
 * chat.refreshThreadActions mais retourne toujours vide.
 */
export function computeActionsForStatus(
  _status: string,
  _paymentStatus?: string
): { text: string; actions: ActionItem[]; visibility: Visibility } {
  return { text: "", actions: [], visibility: "all" };
}
