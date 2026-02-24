export const RESERVATION_STATUSES = [
  "requested",
  "accepted_pending_payment",
  "pickup_pending",
  "in_progress",
  "dropoff_pending",
  "completed",
  "cancelled",
  "rejected",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export function isReservationStatus(v: string): v is ReservationStatus {
  return (RESERVATION_STATUSES as readonly string[]).includes(v);
}