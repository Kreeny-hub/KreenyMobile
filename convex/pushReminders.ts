import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

// ═══════════════════════════════════════════════════════
// Helper: tomorrow/today ISO dates
// ═══════════════════════════════════════════════════════
const pad2 = (n: number) => String(n).padStart(2, "0");
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function tomorrowISO() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function yesterdayISO() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

// ═══════════════════════════════════════════════════════
// 1. PICKUP REMINDERS — 1 day before startDate
//    Notifies both renter and owner
// ═══════════════════════════════════════════════════════
export const sendPickupReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tomorrow = tomorrowISO();

    // Find reservations starting tomorrow that are confirmed or pickup_pending
    const confirmed = await ctx.db
      .query("reservations")
      .filter((q) =>
        q.and(
          q.eq(q.field("startDate"), tomorrow),
          q.or(
            q.eq(q.field("status"), "confirmed"),
            q.eq(q.field("status"), "pickup_pending")
          )
        )
      )
      .collect();

    for (const r of confirmed) {
      const vehicle = await ctx.db.get(r.vehicleId);
      const vehicleTitle = vehicle?.title ?? "Véhicule";

      // Notify renter
      await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
        targetUserId: r.renterUserId,
        senderUserId: String(r.ownerUserId ?? ""),
        vehicleTitle,
        type: "pickup_reminder",
        reservationId: String(r._id),
      });

      // Notify owner
      if (r.ownerUserId) {
        await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
          targetUserId: String(r.ownerUserId),
          senderUserId: r.renterUserId,
          vehicleTitle,
          type: "pickup_reminder_owner",
          reservationId: String(r._id),
        });
      }
    }
  },
});

// ═══════════════════════════════════════════════════════
// 2. REVIEW REMINDERS — 1 day after completion
//    Nudges users who haven't left a review
// ═══════════════════════════════════════════════════════
export const sendReviewReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find reservations completed ~24h ago
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const twoDaysAgo = Date.now() - 48 * 60 * 60 * 1000;

    const completed = await ctx.db
      .query("reservations")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "completed"),
          q.gte(q.field("createdAt"), twoDaysAgo),
          q.lte(q.field("createdAt"), oneDayAgo)
        )
      )
      .take(100);

    for (const r of completed) {
      const vehicle = await ctx.db.get(r.vehicleId);
      const vehicleTitle = vehicle?.title ?? "Véhicule";

      // Check if renter already reviewed
      const renterReview = await ctx.db
        .query("reviews")
        .withIndex("by_reservation_author", (q) =>
          q.eq("reservationId", r._id).eq("authorUserId", r.renterUserId)
        )
        .first();

      if (!renterReview) {
        await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
          targetUserId: r.renterUserId,
          senderUserId: String(r.ownerUserId ?? ""),
          vehicleTitle,
          type: "review_reminder",
          reservationId: String(r._id),
        });
      }

      // Check if owner already reviewed
      if (r.ownerUserId) {
        const ownerReview = await ctx.db
          .query("reviews")
          .withIndex("by_reservation_author", (q) =>
            q.eq("reservationId", r._id).eq("authorUserId", String(r.ownerUserId))
          )
          .first();

        if (!ownerReview) {
          await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
            targetUserId: String(r.ownerUserId),
            senderUserId: r.renterUserId,
            vehicleTitle,
            type: "review_reminder",
            reservationId: String(r._id),
          });
        }
      }
    }
  },
});

// ═══════════════════════════════════════════════════════
// 3. DAILY OWNER SUMMARY — morning digest
//    "You have X pending requests, Y active rentals"
// ═══════════════════════════════════════════════════════
export const sendOwnerDailySummary = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Get all unique owner IDs with pending requests
    const pending = await ctx.db
      .query("reservations")
      .filter((q) => q.eq(q.field("status"), "requested"))
      .collect();

    // Group by owner
    const ownerMap = new Map<string, { pending: number; active: number }>();
    for (const r of pending) {
      const oid = String(r.ownerUserId ?? "");
      if (!oid) continue;
      const existing = ownerMap.get(oid) ?? { pending: 0, active: 0 };
      existing.pending++;
      ownerMap.set(oid, existing);
    }

    // Count active rentals per owner
    const active = await ctx.db
      .query("reservations")
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "confirmed"),
          q.eq(q.field("status"), "pickup_pending"),
          q.eq(q.field("status"), "in_progress"),
          q.eq(q.field("status"), "dropoff_pending")
        )
      )
      .collect();

    for (const r of active) {
      const oid = String(r.ownerUserId ?? "");
      if (!oid) continue;
      const existing = ownerMap.get(oid) ?? { pending: 0, active: 0 };
      existing.active++;
      ownerMap.set(oid, existing);
    }

    // Send summary to each owner
    for (const [ownerId, counts] of ownerMap.entries()) {
      if (counts.pending === 0 && counts.active === 0) continue;

      const parts: string[] = [];
      if (counts.pending > 0) parts.push(`${counts.pending} demande${counts.pending > 1 ? "s" : ""} en attente`);
      if (counts.active > 0) parts.push(`${counts.active} location${counts.active > 1 ? "s" : ""} en cours`);

      await ctx.scheduler.runAfter(0, internal.push.sendPush, {
        targetUserId: ownerId,
        title: "☀️ Bonjour !",
        body: `Tu as ${parts.join(" et ")}. Ouvre l'app pour gérer.`,
        data: { type: "daily_summary" },
      });
    }
  },
});

// ═══════════════════════════════════════════════════════
// 4. PAYMENT REMINDER — nudge renter 1h before expiry
//    For accepted_pending_payment reservations
// ═══════════════════════════════════════════════════════
export const sendPaymentReminders = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Find reservations accepted but unpaid, accepted more than 1h ago
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;

    const unpaid = await ctx.db
      .query("reservations")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "accepted_pending_payment"),
          q.gte(q.field("acceptedAt"), twoHoursAgo),
          q.lte(q.field("acceptedAt"), oneHourAgo)
        )
      )
      .take(50);

    for (const r of unpaid) {
      const vehicle = await ctx.db.get(r.vehicleId);
      const vehicleTitle = vehicle?.title ?? "Véhicule";

      await ctx.scheduler.runAfter(0, internal.push.sendPush, {
        targetUserId: r.renterUserId,
        title: "⏰ Paiement en attente",
        body: `Ta réservation pour ${vehicleTitle} expire bientôt. Finalise le paiement maintenant.`,
        data: { type: "payment_reminder", reservationId: String(r._id) },
      });
    }
  },
});
