import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { computeActionsForStatus } from "./_lib/actionsByStatus";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";


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

    const asRenter = await ctx.db
      .query("threads")
      .withIndex("by_renter", (q) => q.eq("renterUserId", me))
      .order("desc")
      .take(100);

    const asOwner = await ctx.db
      .query("threads")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", me))
      .order("desc")
      .take(100);

    const map = new Map<string, (typeof asRenter)[number]>();
    for (const t of [...asRenter, ...asOwner]) map.set(String(t._id), t);

    const sorted = Array.from(map.values()).sort((a, b) => {
      const aTime = a.lastMessageAt ?? a.createdAt;
      const bTime = b.lastMessageAt ?? b.createdAt;
      return bTime - aTime;
    });

    // Enrich with vehicle info, last message, other user profile
    const enriched = [];
    for (const t of sorted) {
      const reservation = await ctx.db.get(t.reservationId);
      let vehicleTitle = "Véhicule";
      let vehicleCity = "";
      let coverUrl: string | null = null;

      if (reservation) {
        const vehicle = await ctx.db.get(reservation.vehicleId);
        if (vehicle) {
          vehicleTitle = vehicle.title;
          vehicleCity = vehicle.city;
          if (vehicle.imageUrls?.length) {
            coverUrl = await ctx.storage.getUrl(vehicle.imageUrls[0] as any) ?? null;
          }
        }
      }

      // Last message preview
      const lastMessages = await ctx.db
        .query("messages")
        .withIndex("by_thread", (q) => q.eq("threadId", t._id))
        .order("desc")
        .take(1);
      const lastMsg = lastMessages[0] ?? null;

      // Other user profile
      const otherUserId = t.renterUserId === me ? t.ownerUserId : t.renterUserId;
      const otherProfile = await ctx.db
        .query("userProfiles")
        .withIndex("by_user", (q) => q.eq("userId", otherUserId))
        .first();

      enriched.push({
        ...t,
        vehicleTitle,
        vehicleCity,
        coverUrl,
        lastMessageText: lastMsg?.text ?? null,
        lastMessageType: lastMsg?.type ?? null,
        otherUserName: otherProfile?.displayName ?? "Utilisateur",
        myRole: t.renterUserId === me ? "renter" as const : "owner" as const,
        reservationStatus: reservation?.status ?? null,
      });
    }

    return enriched;
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

    const existing = await ctx.db
      .query("messages")
      .withIndex("by_eventKey", (q) => q.eq("eventKey", key))
      .unique();

    const { text, actions, visibility } = computeActionsForStatus(
      reservation.status,
      reservation.paymentStatus
    );

    if (!existing) {
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

    await ctx.db.patch(existing._id, { text, actions, visibility });
    return { ok: true, created: false };
  },
});

