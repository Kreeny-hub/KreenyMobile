/* ======================================================
   SOURCE DE VÉRITÉ — Tous les statuts et sets du domaine
====================================================== */

// ─── Reservation Status ────────────────────────────────
export const RESERVATION_STATUSES = [
  "requested",
  "accepted_pending_payment",
  "confirmed",
  "pickup_pending",
  "in_progress",
  "dropoff_pending",
  "completed",
  "disputed",
  "cancelled",
  "rejected",
] as const;

export type ReservationStatus = (typeof RESERVATION_STATUSES)[number];

export function isReservationStatus(v: string): v is ReservationStatus {
  return (RESERVATION_STATUSES as readonly string[]).includes(v);
}

// ─── Status Sets (utilisés dans les guards et queries) ──
/** Statuts qui bloquent les dates du véhicule (pas de nouvelle résa en chevauchement) */
export const BLOCKING_STATUSES = new Set<ReservationStatus>([
  "requested",
  "accepted_pending_payment",
  "confirmed",
  "pickup_pending",
  "in_progress",
  "dropoff_pending",
  "disputed",
]);

/** Statuts depuis lesquels le locataire peut annuler */
export const CANCELLABLE_STATUSES = new Set<ReservationStatus>([
  "requested",
  "accepted_pending_payment",
  "confirmed",
  "pickup_pending",
]);

/** Statuts terminaux (plus d'action possible) */
export const TERMINAL_STATUSES = new Set<ReservationStatus>([
  "completed",
  "cancelled",
  "rejected",
]);

// ─── Payment Status ────────────────────────────────────
export const PAYMENT_STATUSES = [
  "unpaid",
  "requires_action",
  "processing",
  "captured",
  "failed",
  "cancelled",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

// ─── Deposit Status ────────────────────────────────────
export const DEPOSIT_STATUSES = [
  "unheld",
  "held",
  "released",
  "failed",
] as const;

export type DepositStatus = (typeof DEPOSIT_STATUSES)[number];

// ─── Dev Guard ─────────────────────────────────────────
/**
 * Lève une erreur si on n'est pas en dev.
 * À appeler en début de handler pour toute mutation DEV-only.
 */
export function assertDevOnly() {
  // En Convex, process.env.NODE_ENV est "production" quand déployé sur convex.cloud
  if (process.env.NODE_ENV === "production") {
    const { ConvexError } = require("convex/values");
    throw new ConvexError("DevOnly");
  }
}
