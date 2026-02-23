import { query } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { authComponent } from "./auth";

export const getOwnerDashboard = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const ownerUserId = String(user.userId ?? user.email ?? user._id);

    // Demandes reçues
    const requested = await ctx.db
      .query("reservations")
      .filter((q) =>
        q.and(q.eq(q.field("ownerUserId"), ownerUserId), q.eq(q.field("status"), "requested"))
      )
      .order("desc")
      .take(3);

    // Actions urgentes (constats)
    const pickupPending = await ctx.db
      .query("reservations")
      .filter((q) =>
        q.and(q.eq(q.field("ownerUserId"), ownerUserId), q.eq(q.field("status"), "pickup_pending"))
      )
      .order("desc")
      .take(3);

    const dropoffPending = await ctx.db
      .query("reservations")
      .filter((q) =>
        q.and(q.eq(q.field("ownerUserId"), ownerUserId), q.eq(q.field("status"), "dropoff_pending"))
      )
      .order("desc")
      .take(3);

    // En cours
    const inProgress = await ctx.db
      .query("reservations")
      .filter((q) =>
        q.and(q.eq(q.field("ownerUserId"), ownerUserId), q.eq(q.field("status"), "in_progress"))
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