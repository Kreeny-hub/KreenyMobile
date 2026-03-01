import { query } from "./_generated/server";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

export const getProfileBadge = query({
  args: {},
  handler: async (ctx) => {
    const empty = { show: false, requestedCount: 0, unreadMessages: 0, renterActionCount: 0, ownerActionCount: 0, ownerConstatCount: 0, dashboardBadge: 0 };
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return empty; }
    if (!user) return empty;

    const me = userKey(user);

    // ── Owner: demandes en attente ──
    const pendingRes = await ctx.db
      .query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", me).eq("status", "requested")
      )
      .take(100);
    const requestedCount = pendingRes.length;

    // ── Owner: constats à faire (SEULEMENT si pas encore soumis) ──
    const ownerPickup = await ctx.db.query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", me).eq("status", "pickup_pending")
      ).take(50);
    const ownerDropoff = await ctx.db.query("reservations")
      .withIndex("by_owner_status_createdAt", (q) =>
        q.eq("ownerUserId", me).eq("status", "dropoff_pending")
      ).take(50);

    let ownerConstatCount = 0;
    for (const r of [...ownerPickup, ...ownerDropoff]) {
      const phase = r.status === "pickup_pending" ? "checkin" : "checkout";
      const already = await ctx.db
        .query("conditionReports")
        .withIndex("by_reservation_phase_role", (q) =>
          q.eq("reservationId", r._id).eq("phase", phase).eq("role", "owner")
        ).unique();
      if (!already) ownerConstatCount++;
    }

    // ── Renter: paiements en attente ──
    const renterPayment = await ctx.db.query("reservations")
      .withIndex("by_renter_status_createdAt", (q) =>
        q.eq("renterUserId", me).eq("status", "accepted_pending_payment")
      ).take(50);

    // ── Renter: constats à faire (SEULEMENT si pas encore soumis) ──
    const renterPickup = await ctx.db.query("reservations")
      .withIndex("by_renter_status_createdAt", (q) =>
        q.eq("renterUserId", me).eq("status", "pickup_pending")
      ).take(50);
    const renterDropoff = await ctx.db.query("reservations")
      .withIndex("by_renter_status_createdAt", (q) =>
        q.eq("renterUserId", me).eq("status", "dropoff_pending")
      ).take(50);

    let renterConstatCount = 0;
    for (const r of [...renterPickup, ...renterDropoff]) {
      const phase = r.status === "pickup_pending" ? "checkin" : "checkout";
      const already = await ctx.db
        .query("conditionReports")
        .withIndex("by_reservation_phase_role", (q) =>
          q.eq("reservationId", r._id).eq("phase", phase).eq("role", "renter")
        ).unique();
      if (!already) renterConstatCount++;
    }

    const renterActionCount = renterPayment.length + renterConstatCount;

    // ── Messages non lus ──
    const asRenter = await ctx.db.query("threads")
      .withIndex("by_renter", (q) => q.eq("renterUserId", me)).take(100);
    const asOwner = await ctx.db.query("threads")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", me)).take(100);

    const threadMap = new Map<string, (typeof asRenter)[number]>();
    for (const t of [...asRenter, ...asOwner]) threadMap.set(String(t._id), t);

    let unreadMessages = 0;
    for (const t of threadMap.values()) {
      const lastMsg = t.lastMessageAt ?? 0;
      if (lastMsg === 0) continue;
      const isRenter = t.renterUserId === me;
      const lastRead = isRenter ? (t.renterLastReadAt ?? 0) : (t.ownerLastReadAt ?? 0);
      if (lastMsg > lastRead) unreadMessages++;
    }

    const ownerActionCount = requestedCount + ownerConstatCount;
    const dashboardBadge = requestedCount + ownerConstatCount;

    return {
      show: requestedCount > 0 || renterActionCount > 0 || ownerConstatCount > 0,
      requestedCount,
      unreadMessages,
      renterActionCount,
      ownerActionCount,
      ownerConstatCount,
      dashboardBadge,
    };
  },
});
