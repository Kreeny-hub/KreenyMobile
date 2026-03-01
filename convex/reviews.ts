import { v, ConvexError } from "convex/values";
import { query, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { userKey } from "./_lib/userKey";
import { authComponent } from "./auth";

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════
function computeAverage(ratings: Record<string, number | undefined>): number {
  const values = Object.values(ratings).filter((v): v is number => v !== undefined && v > 0);
  if (values.length === 0) return 0;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

// ═══════════════════════════════════════════════════════
// Queries
// ═══════════════════════════════════════════════════════

export const getForVehicle = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, { vehicleId }) => {
    const reviews = await ctx.db.query("reviews").withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicleId)).order("desc").collect();
    return await Promise.all(reviews.map(async (r) => {
      const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", r.authorUserId)).first();
      const avatarUrl = profile?.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null;
      return { ...r, authorName: profile?.displayName ?? "Utilisateur", authorAvatarUrl: avatarUrl };
    }));
  },
});

export const getStatsForVehicle = query({
  args: { vehicleId: v.id("vehicles") },
  handler: async (ctx, { vehicleId }) => {
    const reviews = await ctx.db.query("reviews").withIndex("by_vehicle", (q) => q.eq("vehicleId", vehicleId)).collect();
    if (reviews.length === 0) return { count: 0, average: 0, criteria: {} };
    const sums: Record<string, { total: number; count: number }> = {};
    let globalSum = 0;
    for (const r of reviews) {
      globalSum += r.averageRating;
      for (const [key, val] of Object.entries(r.ratings)) {
        if (typeof val === "number" && val > 0) {
          if (!sums[key]) sums[key] = { total: 0, count: 0 };
          sums[key].total += val;
          sums[key].count += 1;
        }
      }
    }
    const criteria: Record<string, number> = {};
    for (const [key, { total, count }] of Object.entries(sums)) criteria[key] = Math.round((total / count) * 10) / 10;
    return { count: reviews.length, average: Math.round((globalSum / reviews.length) * 10) / 10, criteria };
  },
});

export const getForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const reviews = await ctx.db.query("reviews").withIndex("by_targetUser", (q) => q.eq("targetUserId", userId)).order("desc").collect();
    return await Promise.all(reviews.map(async (r) => {
      const profile = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", r.authorUserId)).first();
      const vehicle = await ctx.db.get(r.vehicleId);
      const avatarUrl = profile?.avatarStorageId ? await ctx.storage.getUrl(profile.avatarStorageId) : null;
      return { ...r, authorName: profile?.displayName ?? "Utilisateur", authorAvatarUrl: avatarUrl, vehicleTitle: vehicle?.title ?? "Véhicule" };
    }));
  },
});

export const getStatsForUser = query({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    const reviews = await ctx.db.query("reviews").withIndex("by_targetUser", (q) => q.eq("targetUserId", userId)).collect();
    if (reviews.length === 0) return { count: 0, average: 0, criteria: {} };
    const sums: Record<string, { total: number; count: number }> = {};
    let globalSum = 0;
    for (const r of reviews) {
      globalSum += r.averageRating;
      for (const [key, val] of Object.entries(r.ratings)) {
        if (typeof val === "number" && val > 0) {
          if (!sums[key]) sums[key] = { total: 0, count: 0 };
          sums[key].total += val;
          sums[key].count += 1;
        }
      }
    }
    const criteria: Record<string, number> = {};
    for (const [key, { total, count }] of Object.entries(sums)) criteria[key] = Math.round((total / count) * 10) / 10;
    return { count: reviews.length, average: Math.round((globalSum / reviews.length) * 10) / 10, criteria };
  },
});

export const canReview = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, { reservationId }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) return { canReview: false, reason: "not_authenticated" };
    const me = userKey(user);
    const reservation = await ctx.db.get(reservationId);
    if (!reservation) return { canReview: false, reason: "not_found" };
    if (reservation.status !== "completed") return { canReview: false, reason: "not_completed" };
    const isRenter = reservation.renterUserId === me;
    const isOwner = reservation.ownerUserId === me;
    if (!isRenter && !isOwner) return { canReview: false, reason: "not_participant" };
    const existing = await ctx.db.query("reviews").withIndex("by_reservation_author", (q) => q.eq("reservationId", reservationId).eq("authorUserId", me)).first();
    if (existing) return { canReview: false, reason: "already_reviewed" };
    return { canReview: true, role: isRenter ? "renter" as const : "owner" as const, targetUserId: isRenter ? reservation.ownerUserId! : reservation.renterUserId };
  },
});

// ═══════════════════════════════════════════════════════
// Mutations
// ═══════════════════════════════════════════════════════

export const submit = mutation({
  args: {
    reservationId: v.id("reservations"),
    ratings: v.object({
      communication: v.number(),
      punctuality: v.number(),
      cleanliness: v.number(),
      conformity: v.optional(v.number()),
      vehicleCare: v.optional(v.number()),
    }),
    comment: v.optional(v.string()),
  },
  handler: async (ctx, { reservationId, ratings, comment }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    for (const [key, val] of Object.entries(ratings)) {
      if (val !== undefined && (val < 1 || val > 5 || !Number.isInteger(val))) throw new ConvexError(`Rating "${key}" must be 1-5`);
    }

    const reservation = await ctx.db.get(reservationId);
    if (!reservation) throw new ConvexError("Reservation not found");
    if (reservation.status !== "completed") throw new ConvexError("Can only review completed reservations");
    const isRenter = reservation.renterUserId === me;
    const isOwner = reservation.ownerUserId === me;
    if (!isRenter && !isOwner) throw new ConvexError("Not a participant");
    if (isRenter && !ratings.conformity) throw new ConvexError("Renter must rate conformity");
    if (isOwner && !ratings.vehicleCare) throw new ConvexError("Owner must rate vehicle care");

    const existing = await ctx.db.query("reviews").withIndex("by_reservation_author", (q) => q.eq("reservationId", reservationId).eq("authorUserId", me)).first();
    if (existing) throw new ConvexError("Already reviewed");

    const targetUserId = isRenter ? reservation.ownerUserId! : reservation.renterUserId;
    const averageRating = computeAverage(ratings);

    const reviewId = await ctx.db.insert("reviews", {
      reservationId, vehicleId: reservation.vehicleId, authorUserId: me, targetUserId,
      role: (isRenter ? "renter" : "owner") as "renter" | "owner",
      ratings, averageRating, comment: comment?.trim() || undefined, createdAt: Date.now(),
    });

    // 📲 Push notification to the reviewed person
    const vehicle = await ctx.db.get(reservation.vehicleId);
    await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
      targetUserId,
      senderUserId: me,
      vehicleTitle: vehicle?.title ?? "un véhicule",
      type: "review_received",
      reservationId: String(reservationId),
    });

    // ✅ AUTO-ARCHIVE: Archiver le thread + supprimer le bouton "Laisser un avis"
    const thread = await ctx.db
      .query("threads")
      .withIndex("by_reservation", (q) => q.eq("reservationId", reservationId))
      .unique();

    if (thread) {
      // Archive thread for the reviewer
      if (isRenter) {
        await ctx.db.patch(thread._id, { archivedByRenter: true });
      } else {
        await ctx.db.patch(thread._id, { archivedByOwner: true });
      }

      // Remove "Laisser un avis" button ONLY for the reviewer's role
      const myRole = isRenter ? "renter" : "owner";
      const msgs = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", thread._id))
        .collect();
      for (const msg of msgs) {
        if (
          msg.actions &&
          msg.actions.length > 0 &&
          msg.actions.some((a: any) => a.route?.includes("LEAVE_REVIEW")) &&
          msg.visibility === myRole
        ) {
          await ctx.db.patch(msg._id, {
            actions: [],
            text: (msg as any).archivedText || msg.text,
          });
        }
      }
    }

    return reviewId;
  },
});
