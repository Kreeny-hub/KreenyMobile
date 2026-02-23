export const RESERVATION_STATUSES = [
  "requested",
  "accepted_pending_payment",
  "pickup_pending",
  "in_progress",
  "dropoff_pending",
  "completed",
  "rejected",
  "cancelled",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export const PAYMENT_STATUSES = [
  "unpaid",
  "requires_action",
  "authorized",
  "captured",
  "failed",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const DEPOSIT_STATUSES = ["unheld", "held", "released", "failed"] as const;

export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

