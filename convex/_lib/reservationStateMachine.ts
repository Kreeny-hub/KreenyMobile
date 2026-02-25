import { ConvexError } from "convex/values";
import { RESERVATION_STATUSES, type ReservationStatus } from "./enums";

// Liste des transitions autorisées (source de vérité)
const ALLOWED: Record<ReservationStatus, ReservationStatus[]> = {
  requested: ["accepted_pending_payment", "rejected", "cancelled"],
  accepted_pending_payment: ["pickup_pending", "cancelled"],
  pickup_pending: ["in_progress", "cancelled"],
  in_progress: ["dropoff_pending"],
  dropoff_pending: ["completed"],
  completed: [],
  rejected: [],
  cancelled: [],
};

export function assertReservationTransition(current: string, next: string) {
  if (!(current in ALLOWED)) throw new ConvexError("UnknownStatus");
  const allowed = ALLOWED[current as ReservationStatus];
  if (!allowed.includes(next as ReservationStatus)) {
    throw new ConvexError("InvalidTransition");
  }
}
