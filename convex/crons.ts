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

export default crons;
