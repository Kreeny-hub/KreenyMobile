import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// ✅ Toutes les 5 minutes : expire les réservations acceptées mais non payées
// ✅ FIX: utilise `internal` car expireUnpaidReservations est maintenant une internalMutation
crons.interval(
  "expire unpaid reservations",
  { minutes: 5 },
  internal.reservations.expireUnpaidReservations,
  {}
);

// Toutes les heures : passe en dropoff_pending les locations dont endDate est dépassée
crons.interval(
  "auto transition expired rentals",
  { hours: 1 },
  api.reservations.autoTransitionExpiredRentals,
  {}
);

export default crons;
