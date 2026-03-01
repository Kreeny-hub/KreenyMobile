import { mutation, internalAction, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

// ═══════════════════════════════════════════════════════
// Register push token
// ═══════════════════════════════════════════════════════
export const registerPushToken = mutation({
  args: { token: v.string() },
  handler: async (ctx, { token }): Promise<void> => {
    let user;
    try { user = await authComponent.getAuthUser(ctx); } catch { return; }
    if (!user) return;
    const userId = userKey(user);

    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (profile && profile.expoPushToken !== token) {
      await ctx.db.patch(profile._id, { expoPushToken: token, updatedAt: Date.now() });
    }
  },
});

// ═══════════════════════════════════════════════════════
// Internal: get push token for a user
// ═══════════════════════════════════════════════════════
export const _getToken = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<string | null> => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return profile?.expoPushToken ?? null;
  },
});

// ═══════════════════════════════════════════════════════
// Internal: get display name for a user
// ═══════════════════════════════════════════════════════
export const _getName = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, { userId }): Promise<string> => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();
    return profile?.displayName?.split(" ")[0] ?? "Quelqu'un";
  },
});

// ═══════════════════════════════════════════════════════
// Send push notification (low-level)
// ═══════════════════════════════════════════════════════
export const sendPush = internalAction({
  args: {
    targetUserId: v.string(),
    title: v.string(),
    body: v.string(),
    data: v.optional(v.any()),
  },
  handler: async (ctx, { targetUserId, title, body, data }): Promise<{ sent: boolean }> => {
    const token: string | null = await ctx.runQuery(internal.push._getToken, { userId: targetUserId });
    if (!token) {
      console.log(`📲 No push token for ${targetUserId}`);
      return { sent: false };
    }

    try {
      const response: Response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          to: token,
          title,
          body,
          sound: "default",
          data: data ?? {},
          priority: "high",
        }),
      });

      const json = (await response.json()) as { data?: { status?: string } };
      console.log(`📲 Push → ${targetUserId}: "${title}" — ${json?.data?.status ?? "sent"}`);
      return { sent: true };
    } catch (e) {
      console.error("📲 Push error:", e);
      return { sent: false };
    }
  },
});

// ═══════════════════════════════════════════════════════
// Personalized push — resolves names then sends
// ═══════════════════════════════════════════════════════
export const sendPersonalizedPush = internalAction({
  args: {
    targetUserId: v.string(),
    senderUserId: v.string(),
    vehicleTitle: v.string(),
    type: v.string(),
    reservationId: v.string(),
    extraData: v.optional(v.any()),
  },
  handler: async (ctx, { targetUserId, senderUserId, vehicleTitle, type, reservationId, extraData }): Promise<{ sent: boolean }> => {
    const senderName: string = await ctx.runQuery(internal.push._getName, { userId: senderUserId });
    const shortTitle = vehicleTitle.length > 25 ? vehicleTitle.slice(0, 22) + "…" : vehicleTitle;

    const notif = buildNotification(type, senderName, shortTitle);
    if (!notif) return { sent: false };

    return await ctx.runAction(internal.push.sendPush, {
      targetUserId,
      title: notif.title,
      body: notif.body,
      data: { type, reservationId, ...(extraData ?? {}) },
    });
  },
});

// ═══════════════════════════════════════════════════════
// Notification copy — human, personal, actionable
// ═══════════════════════════════════════════════════════
function buildNotification(type: string, name: string, vehicle: string): { title: string; body: string } | null {
  switch (type) {
    // → Owner receives
    case "reservation_requested":
      return {
        title: `${name} veut louer ta ${vehicle}`,
        body: "Consulte les dates et réponds à sa demande.",
      };

    // → Renter receives
    case "reservation_accepted":
      return {
        title: `Bonne nouvelle ! ${name} a accepté`,
        body: `Ta ${vehicle} t'attend. Plus qu'à confirmer le paiement.`,
      };
    case "reservation_rejected":
      return {
        title: "Demande non retenue",
        body: `${name} n'a pas pu accepter pour la ${vehicle}. Trouve une autre perle !`,
      };

    // → Owner receives
    case "payment_captured":
      return {
        title: `${name} a payé pour ta ${vehicle}`,
        body: "Tout est réglé. Prépare le véhicule pour la remise.",
      };

    // → Renter receives
    case "pickup_ready":
      return {
        title: `Ta ${vehicle} est prête !`,
        body: `${name} t'attend pour la remise des clés. Bon trajet !`,
      };

    // → Both
    case "reservation_completed":
      return {
        title: "Location terminée 🎉",
        body: `Comment s'est passée ta ${vehicle} ? Laisse un avis en 30 secondes.`,
      };

    // → Any
    case "new_message":
      return {
        title: `Message de ${name}`,
        body: "Appuie pour lire et répondre.",
      };

    // ── Cancellation ──
    case "reservation_cancelled_by_renter":
      return {
        title: "Réservation annulée",
        body: `${name} a annulé sa réservation pour la ${vehicle}. Les dates sont à nouveau libres.`,
      };
    case "reservation_cancelled_by_owner":
      return {
        title: "Réservation annulée par le propriétaire",
        body: `${name} a annulé ta réservation pour la ${vehicle}. Tu seras remboursé intégralement.`,
      };

    // ── Condition report ──
    case "condition_report_submitted":
      return {
        title: `Constat ${vehicle}`,
        body: `${name} a soumis son constat. À ton tour si ce n'est pas déjà fait !`,
      };

    // ── Review ──
    case "review_received":
      return {
        title: "Nouvel avis reçu ⭐",
        body: `${name} t'a laissé un avis. Découvre ce qu'il en pense !`,
      };

    case "dispute_opened":
      return {
        title: `⚠️ Litige ouvert — ${vehicle}`,
        body: `${name} a signalé un problème. La caution reste bloquée en attendant.`,
      };

    case "dispute_resolved":
      return {
        title: `Litige résolu — ${vehicle}`,
        body: `Le litige a été examiné par notre équipe. Consulte les détails.`,
      };

    // ── Reminders ──
    case "pickup_reminder":
      return {
        title: `Rappel : ta ${vehicle} t'attend demain`,
        body: `N'oublie pas ta pièce d'identité et le constat de départ !`,
      };
    case "pickup_reminder_owner":
      return {
        title: `Rappel : remise de ta ${vehicle} demain`,
        body: `${name} vient récupérer le véhicule. Prépare les clés et le constat !`,
      };
    case "review_reminder":
      return {
        title: "Comment ça s'est passé ? ⭐",
        body: `Laisse un avis sur ta ${vehicle} en 30 secondes. Ça aide toute la communauté !`,
      };

    default:
      return null;
  }
}
