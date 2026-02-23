import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { authComponent } from "./auth";

function userKey(user: any) {
  return String(user.userId ?? user.email ?? user._id);
}

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

    const messageId = await ctx.db.insert("messages", {
      threadId: thread._id,
      reservationId: thread.reservationId,
      type: "user",
      text,
      createdAt: now,
    });

    await ctx.db.patch(thread._id, { lastMessageAt: now });

    return { ok: true, messageId };
  },
});