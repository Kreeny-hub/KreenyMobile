import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// ✅ Toutes les 5 minutes : expire les réservations acceptées mais non payées
crons.interval(
  "expire unpaid reservations",
  { minutes: 5 },
  api.reservations.expireUnpaidReservations,
  {}
);

export default crons;