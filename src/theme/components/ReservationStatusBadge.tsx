import { KBadge } from "./KBadge";

const STATUS_MAP: Record<string, { text: string; variant: "info" | "success" | "warning" | "error" | "neutral" }> = {
  requested: { text: "En attente", variant: "warning" },
  accepted_pending_payment: { text: "À payer", variant: "info" },
  pickup_pending: { text: "Constat départ", variant: "info" },
  in_progress: { text: "En cours", variant: "success" },
  dropoff_pending: { text: "Constat retour", variant: "info" },
  completed: { text: "Terminée", variant: "neutral" },
  cancelled: { text: "Annulée", variant: "error" },
  rejected: { text: "Refusée", variant: "error" },
};

interface Props {
  status: string;
  size?: "sm" | "md";
}

export function ReservationStatusBadge({ status, size }: Props) {
  const config = STATUS_MAP[status] ?? { text: status, variant: "neutral" as const };
  return <KBadge text={config.text} variant={config.variant} size={size} />;
}
