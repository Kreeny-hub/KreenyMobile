import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

export const getThreadByReservation = query({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return null; }
    if (!user) return null;
    const me = userKey(user);

    const thread = await ctx.db
      .query("threads")
      .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
      .unique();

    if (!thread) return null;

    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      return null;
    }

    return thread;
  },
});

export const listMessages = query({
  args: { threadId: v.id("threads"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return []; }
    if (!user) return [];
    const me = userKey(user);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) return [];
    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      return [];
    }

    const limit = args.limit ?? 100;

    const msgs = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("asc")
      .take(limit);

    // Resolve image URLs
    const enriched = await Promise.all(
      msgs.map(async (m) => {
        if ((m as any).imageStorageId) {
          const imageUrl = await ctx.storage.getUrl((m as any).imageStorageId);
          return { ...m, imageUrl: imageUrl ?? null };
        }
        return { ...m, imageUrl: null };
      })
    );

    return enriched;
  },
});

// ══════════════════════════════════════════════════════════
// List threads enrichis (véhicule, profil, archivage)
// includeArchived: false → actifs uniquement
// includeArchived: true  → archivés uniquement
// ══════════════════════════════════════════════════════════
export const listMyThreads = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return []; }
    if (!user) return [];
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

    // Filter: false = active only, true = archived only
    const wantArchived = args.includeArchived ?? false;
    const threads = Array.from(map.values()).filter((t) => {
      const isRenter = t.renterUserId === me;
      const isArchived = isRenter
        ? !!(t as any).archivedByRenter
        : !!(t as any).archivedByOwner;
      return wantArchived ? isArchived : !isArchived;
    });

    // Sort by last activity
    threads.sort((a, b) => {
      const aTime = a.lastMessageAt ?? a.createdAt;
      const bTime = b.lastMessageAt ?? b.createdAt;
      return bTime - aTime;
    });

    // Enrich with vehicle, profile, unread
    const enriched = await Promise.all(
      threads.map(async (t) => {
        const isRenter = t.renterUserId === me;
        const otherUserId = isRenter ? t.ownerUserId : t.renterUserId;

        // Reservation → vehicle
        let vehicleTitle = "";
        let coverUrl: string | null = null;
        const reservation = await ctx.db.get(t.reservationId);
        if (reservation) {
          const vehicle = await ctx.db.get(reservation.vehicleId);
          if (vehicle) {
            vehicleTitle = vehicle.title ?? "";
            const coverId = vehicle.imageUrls?.[0];
            if (coverId) {
              coverUrl = await ctx.storage.getUrl(coverId as any) ?? null;
            }
          }
        }

        // Other user profile
        let otherDisplayName = "";
        let otherAvatarUrl: string | null = null;
        const profile = await ctx.db
          .query("userProfiles")
          .withIndex("by_user", (q) => q.eq("userId", otherUserId))
          .first();
        if (profile) {
          otherDisplayName = profile.displayName ?? "";
          if (profile.avatarStorageId) {
            otherAvatarUrl = await ctx.storage.getUrl(profile.avatarStorageId) ?? null;
          }
        }

        // Unread
        const lastMsg = t.lastMessageAt ?? 0;
        const lastRead = isRenter ? (t.renterLastReadAt ?? 0) : (t.ownerLastReadAt ?? 0);
        const hasUnread = lastMsg > 0 && lastMsg > lastRead;
        const otherLastRead = isRenter ? (t.ownerLastReadAt ?? 0) : (t.renterLastReadAt ?? 0);
        const isLastReadByOther = lastMsg > 0 && otherLastRead >= lastMsg;

        // Get the actual last message visible to ME (respects visibility)
        const myRole = isRenter ? "renter" : "owner";
        const recentMsgs = await ctx.db
          .query("messages")
          .withIndex("by_thread", (q) => q.eq("threadId", t._id))
          .order("desc")
          .take(10);
        const lastVisibleMsg = recentMsgs.find(
          (m) => !m.visibility || m.visibility === "all" || m.visibility === myRole
        );
        const visibleLastMessageText = lastVisibleMsg
          ? (lastVisibleMsg.text.length > 100 ? lastVisibleMsg.text.slice(0, 100) + "…" : lastVisibleMsg.text)
          : ((t as any).lastMessageText ?? "");
        const visibleLastSenderId = lastVisibleMsg?.senderUserId ?? t.lastMessageSenderId;
        const lastMessageIsFromMe = visibleLastSenderId === me;

        return {
          ...t,
          vehicleTitle,
          vehicleCoverUrl: coverUrl,
          otherDisplayName,
          otherAvatarUrl,
          hasUnread,
          lastMessageIsFromMe,
          isLastReadByOther,
          lastMessageText: visibleLastMessageText,
        };
      })
    );

    return enriched;
  },
});

export const getThread = query({
  args: { threadId: v.id("threads") },
  handler: async (ctx, args) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return null; }
    if (!user) return null;
    const me = userKey(user);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) return null;

    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      return null;
    }

    const myRole = thread.renterUserId === me ? "renter" : "owner";
    return { ...thread, myUserId: me, myRole };
  },
});

// ⚠️ DEPRECATED — Actions are now managed by reservationEvents.ts (system messages)
// Kept as no-op so existing frontend calls don't crash
export const refreshThreadActions = mutation({
  args: { threadId: v.id("threads") },
  handler: async () => {
    return { ok: true, created: false };
  },
});

// ══════════════════════════════════════════════════════════
// Mark thread as read by current user
// ══════════════════════════════════════════════════════════
export const markThreadRead = mutation({
  args: { threadId: v.id("threads") },
  handler: async (ctx, { threadId }) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return; }
    if (!user) return;
    const me = userKey(user);

    const thread = await ctx.db.get(threadId);
    if (!thread) return;

    const now = Date.now();
    if (thread.renterUserId === me) {
      await ctx.db.patch(threadId, { renterLastReadAt: now });
    } else if (thread.ownerUserId === me) {
      await ctx.db.patch(threadId, { ownerLastReadAt: now });
    }
  },
});

// ══════════════════════════════════════════════════════════
// Archive / Unarchive a thread
// ══════════════════════════════════════════════════════════
export const setArchived = mutation({
  args: { threadId: v.id("threads"), archived: v.boolean() },
  handler: async (ctx, { threadId, archived }) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const thread = await ctx.db.get(threadId);
    if (!thread) throw new ConvexError("ThreadNotFound");
    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      throw new ConvexError("Forbidden");
    }

    const isRenter = thread.renterUserId === me;
    if (isRenter) {
      await ctx.db.patch(threadId, { archivedByRenter: archived });
    } else {
      await ctx.db.patch(threadId, { archivedByOwner: archived });
    }
    return { ok: true };
  },
});

// ══════════════════════════════════════════════════════════
// Count total unread threads for current user
// ══════════════════════════════════════════════════════════
export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return 0; }
    if (!user) return 0;
    const me = userKey(user);

    const asRenter = await ctx.db.query("threads")
      .withIndex("by_renter", (q) => q.eq("renterUserId", me)).take(100);
    const asOwner = await ctx.db.query("threads")
      .withIndex("by_owner", (q) => q.eq("ownerUserId", me)).take(100);

    const map = new Map<string, (typeof asRenter)[number]>();
    for (const t of [...asRenter, ...asOwner]) map.set(String(t._id), t);

    let unread = 0;
    for (const t of map.values()) {
      const lastMsg = t.lastMessageAt ?? 0;
      if (lastMsg === 0) continue;
      const isRenter = t.renterUserId === me;
      const lastRead = isRenter ? (t.renterLastReadAt ?? 0) : (t.ownerLastReadAt ?? 0);
      if (lastMsg > lastRead) unread++;
    }
    return unread;
  },
});
