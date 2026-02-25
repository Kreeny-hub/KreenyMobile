import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
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

    await ctx.db.patch(thread._id, { lastMessageAt: now });

    return { ok: true, messageId };
  },
});
