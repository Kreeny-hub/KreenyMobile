import { cronJobs } from "convex/server";
import { api, internal } from "./_generated/api";

const crons = cronJobs();

// ✅ Toutes les 5 minutes : expire les réservations acceptées mais non payées
crons.interval(
  "expire unpaid reservations",
  { minutes: 5 },
  api.reservations.expireUnpaidReservations,
  {}
);

// Toutes les heures : passe en dropoff_pending les locations dont endDate est dépassée
crons.interval(
  "auto transition expired rentals",
  { hours: 1 },
  api.reservations.autoTransitionExpiredRentals,
  {}
);

// ═══════════════════════════════════════════════════════
// Push Reminders
// ═══════════════════════════════════════════════════════

// Tous les matins à 8h (UTC) : résumé quotidien propriétaires
crons.cron(
  "owner daily summary",
  "0 8 * * *",
  internal.pushReminders.sendOwnerDailySummary,
  {}
);

// Tous les soirs à 18h (UTC) : rappel pickup J-1
crons.cron(
  "pickup reminders",
  "0 18 * * *",
  internal.pushReminders.sendPickupReminders,
  {}
);

// Tous les jours à 10h (UTC) : rappel avis post-location
crons.cron(
  "review reminders",
  "0 10 * * *",
  internal.pushReminders.sendReviewReminders,
  {}
);

// Toutes les 30 minutes : rappel paiement avant expiration
crons.interval(
  "payment reminders",
  { minutes: 30 },
  internal.pushReminders.sendPaymentReminders,
  {}
);

export default crons;
