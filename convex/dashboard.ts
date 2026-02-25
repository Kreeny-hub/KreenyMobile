import { query } from "./_generated/server";
import { ConvexError } from "convex/values";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

export const getOwnerDashboard = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const ownerUserId = userKey(user);

    // ✅ Optimisé : utilise l'index by_owner_status_createdAt au lieu de .filter()
    const requested = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("status", "requested")
      )
      .order("desc")
      .take(3);

    const pickupPending = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("status", "pickup_pending")
      )
      .order("desc")
      .take(3);

    const dropoffPending = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("status", "dropoff_pending")
      )
      .order("desc")
      .take(3);

    const inProgress = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", ownerUserId).eq("status", "in_progress")
      )
      .order("desc")
      .take(3);

    return {
      counts: {
        requested: requested.length,
        pickupPending: pickupPending.length,
        dropoffPending: dropoffPending.length,
        inProgress: inProgress.length,
      },
      latest: {
        requested,
        pickupPending,
        dropoffPending,
        inProgress,
      },
    };
  },
});
