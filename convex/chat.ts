import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

function userKey(user: any) {
  return String(user.userId ?? user.email ?? user._id);
}

export const getThreadByReservation = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
      .unique();

    if (!thread) return null;

    // ✅ sécurité: seuls participants
    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      throw new ConvexError("Forbidden");
    }

    return thread;
  },
});

export const listMessages = query({
  args: { threadId: v.id("threads"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError("ThreadNotFound");
    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      throw new ConvexError("Forbidden");
    }

    const limit = args.limit ?? 100;

    return await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .take(limit);
  },
});

export const listMyThreads = query({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    // Threads où je suis locataire
    const asRenter = await ctx.db
      .query("threads")
      .withIndex("by_renter", (q) => q.eq("renterUserId", me))
      .order("desc")
      .take(100);

    // Threads où je suis loueur
    const asOwner = await ctx.db
      .query("threads")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", me))
      .order("desc")
      .take(100);

    // Merge + dédoublonnage (au cas où)
    const map = new Map<string, (typeof asRenter)[number]>();
    for (const t of [...asRenter, ...asOwner]) map.set(String(t._id), t);

    // Tri par date création (plus récent d’abord)
    return Array.from(map.values()).sort((a, b) => {
      const aTime = a.lastMessageAt ?? a.createdAt;
      const bTime = b.lastMessageAt ?? b.createdAt;
      return bTime - aTime;
    });
  },
});

export const getThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError("ThreadNotFound");

    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      throw new ConvexError("Forbidden");
    }

    return thread;
  },
});

export const refreshThreadActions = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError("ThreadNotFound");

    // ✅ sécurité : seulement owner/renter du thread
    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      throw new ConvexError("Forbidden");
    }

    const reservation = await ctx.db.get(thread.reservationId);
    if (!reservation) throw new ConvexError("ReservationNotFound");

    const key = `actions:${String(thread.reservationId)}`;
    const now = Date.now();

    // cherche le message "actions" existant
    const existing = await ctx.db
      .query("messages")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", key))
      .unique();

    // calcule les actions selon le statut
    let actions: { label: string; route: string }[] = [];
    let visibility: "all" | "renter" | "owner" = "all";
    let text = "Actions disponibles";

    if (reservation.status === "accepted_pending_payment") {
      actions = [{ label: "Payer maintenant", route: "action:PAY_NOW" }];
      visibility = "renter";
      text = "Paiement requis";
    } else if (reservation.status === "pickup_pending") {
      actions = [{ label: "Faire le constat départ", route: "action:DO_CHECKIN" }];
      visibility = "all";
      text = "Constat départ requis";
    } else if (reservation.status === "dropoff_pending") {
      actions = [{ label: "Faire le constat retour", route: "action:DO_CHECKOUT" }];
      visibility = "all";
      text = "Constat retour requis";
    } else if (
      reservation.status === "completed" ||
      reservation.status === "cancelled" ||
      reservation.status === "rejected"
    ) {
      actions = [];
      visibility = "all";
      text = "Aucune action";
    }

    if (!existing) {
      // ✅ création 1 seule fois
      await ctx.db.insert("messages", {
        threadId: thread._id,
        reservationId: thread.reservationId,
        type: "actions",
        text,
        createdAt: now,
        eventKey: key,
        actions,
        visibility,
      });
      return { ok: true, created: true };
    }

    // ✅ mise à jour: patch SEULEMENT des champs modifiables
    await ctx.db.patch(existing._id, {
      text,
      actions,
      visibility,
      // ✅ on ne touche PAS createdAt : le message "actions" reste stable
    });

    return { ok: true, created: false };
  },
});

