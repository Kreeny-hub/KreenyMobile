import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

// ✅ FIX: Rate limit — 1 message par seconde par utilisateur par thread
const MIN_INTERVAL_MS = 1000;

export const sendMessage = mutation({
  args: {
    threadId: v.id("threads"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError("ThreadNotFound");

    // sécurité: seuls les 2 participants peuvent écrire
    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      throw new ConvexError("Forbidden");
    }

    const text = args.text.trim();
    if (!text) throw new ConvexError("EmptyMessage");
    if (text.length > 1000) throw new ConvexError("MessageTooLong");

    const now = Date.now();

    // ✅ Rate limit: vérifier le dernier message de cet utilisateur dans ce thread
    const recentMessages = await ctx.db
      .query("messages")
      .withIndex("by_thread", (q) => q.eq("threadId", args.threadId))
      .order("desc")
      .take(5);

    const myLastMessage = recentMessages.find(
      (m) => m.type === "user" && (m as any).senderUserId === me
    );

    if (myLastMessage && now - myLastMessage.createdAt < MIN_INTERVAL_MS) {
      throw new ConvexError("RateLimited");
    }

    const messageId = await ctx.db.insert("messages", {
      threadId: thread._id,
      reservationId: thread.reservationId,
      type: "user",
      text,
      createdAt: now,
      senderUserId: me,
    });

    // ✅ MAJ thread avec lastMessageAt + lastMessageText + lastMessageSenderId
    await ctx.db.patch(thread._id, {
      lastMessageAt: now,
      lastMessageText: text.length > 100 ? text.slice(0, 100) + "…" : text,
      lastMessageSenderId: me,
    });

    // 📲 Push notification to the other participant
    const recipientUserId = thread.renterUserId === me ? thread.ownerUserId : thread.renterUserId;
    await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
      targetUserId: recipientUserId,
      senderUserId: me,
      vehicleTitle: "",
      type: "new_message",
      reservationId: String(thread.reservationId),
      extraData: { threadId: String(thread._id) },
    });

    return { ok: true, messageId };
  },
});

// ══════════════════════════════════════════════════════════
// Send image message
// ══════════════════════════════════════════════════════════
export const sendImage = mutation({
  args: {
    threadId: v.id("threads"),
    storageId: v.id("_storage"),
    caption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError("ThreadNotFound");

    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      throw new ConvexError("Forbidden");
    }

    const now = Date.now();
    const text = args.caption?.trim() || "📷 Photo";

    const messageId = await ctx.db.insert("messages", {
      threadId: thread._id,
      reservationId: thread.reservationId,
      type: "user",
      text,
      createdAt: now,
      senderUserId: me,
      imageStorageId: args.storageId,
    });

    await ctx.db.patch(thread._id, {
      lastMessageAt: now,
      lastMessageText: text.length > 100 ? text.slice(0, 100) + "…" : text,
      lastMessageSenderId: me,
    });

    // Push notification
    const recipientUserId = thread.renterUserId === me ? thread.ownerUserId : thread.renterUserId;
    await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
      targetUserId: recipientUserId,
      senderUserId: me,
      vehicleTitle: "",
      type: "new_message",
      reservationId: String(thread.reservationId),
      extraData: { threadId: String(thread._id) },
    });

    return { ok: true, messageId };
  },
});

// ══════════════════════════════════════════════════════════
// Toggle emoji reaction on a message
// ══════════════════════════════════════════════════════════
export const toggleReaction = mutation({
  args: {
    messageId: v.id("messages"),
    emoji: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const msg = await ctx.db.get(args.messageId);
    if (!msg) throw new ConvexError("MessageNotFound");

    // Check user belongs to this thread
    const thread = await ctx.db.get(msg.threadId);
    if (!thread) throw new ConvexError("ThreadNotFound");
    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      throw new ConvexError("Forbidden");
    }

    const reactions = (msg as any).reactions ?? [];
    const existing = reactions.findIndex(
      (r: any) => r.emoji === args.emoji && r.userId === me
    );

    let updated;
    if (existing >= 0) {
      // Remove reaction
      updated = reactions.filter((_: any, i: number) => i !== existing);
    } else {
      // Add reaction
      updated = [...reactions, { emoji: args.emoji, userId: me }];
    }

    await ctx.db.patch(args.messageId, { reactions: updated });
    return { ok: true };
  },
});
