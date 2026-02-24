import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import type { ChatAction } from "./_lib/chatActions";
import { DEV_CHAT_ACTIONS } from "./_lib/chatActions";
import { getRoleOrThrow, loadReservationOrThrow } from "./_lib/reservationGuards";
import { transitionReservationStatus } from "./_lib/reservationTransitions";
import { authComponent } from "./auth";

type ActionResult =
  | { ok: true }
  | {
    ok: false;
    code:
    | "Forbidden"
    | "InvalidStatus"
    | "PaymentNotInitialized"
    | "UnknownAction"
    | "OnlyRenterCanPay";
  };

export const runChatAction = mutation({
  args: {
    threadId: v.id("threads"),
    action: v.union(
      v.literal("PAY_NOW"),
      v.literal("DEV_MARK_PAID"),
      v.literal("DEV_DROPOFF_PENDING")
    ),
  },
  handler: async (ctx, args): Promise<ActionResult> => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = String(user.userId ?? user.email ?? user._id);
    const action = args.action as ChatAction;

    // 🚫 Bloquer les actions DEV en production
if (process.env.NODE_ENV === "production" && DEV_CHAT_ACTIONS.has(action)) {
  return { ok: false, code: "Forbidden" };
}

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError("ThreadNotFound");

    // ✅ sécurité: participant seulement
    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      return { ok: false, code: "Forbidden" };
    }

    const reservation = await loadReservationOrThrow(ctx, thread.reservationId);
    const role = getRoleOrThrow(reservation, me);

    switch (action) {
      /**
       * PAY_NOW
       * - locataire uniquement
       * - uniquement si accepted_pending_payment
       * - ne change pas le status, seulement paymentStatus
       */
      case "PAY_NOW": {
        if (role !== "renter") {
          return { ok: false, code: "OnlyRenterCanPay" };
        }

        if (reservation.status !== "accepted_pending_payment") {
          return { ok: false, code: "InvalidStatus" };
        }

        await transitionReservationStatus({
          ctx,
          reservationId: reservation._id,
          renterUserId: reservation.renterUserId,
          ownerUserId: String(reservation.ownerUserId ?? ""),
          actorUserId: me,

          // ✅ statut inchangé
          nextStatus: reservation.status,
          eventType: "payment_initialized",

          // ✅ patch paiement
          patch: { paymentStatus: "requires_action" },

          idempotencyKey: `res:${String(reservation._id)}:payment_initialized`,
        });

        return { ok: true };
      }

      /**
       * DEV_MARK_PAID
       * - locataire uniquement
       * - accepted_pending_payment
       * - paymentStatus requires_action
       */
      case "DEV_MARK_PAID": {
        if (role !== "renter") return { ok: false, code: "Forbidden" };

        if (reservation.status !== "accepted_pending_payment") {
          return { ok: false, code: "InvalidStatus" };
        }

        if (reservation.paymentStatus !== "requires_action") {
          return { ok: false, code: "PaymentNotInitialized" };
        }

        await transitionReservationStatus({
          ctx,
          reservationId: reservation._id,
          renterUserId: reservation.renterUserId,
          ownerUserId: String(reservation.ownerUserId ?? ""),
          actorUserId: me,

          nextStatus: "pickup_pending",
          eventType: "payment_captured",
          patch: { paymentStatus: "captured" },

          idempotencyKey: `res:${String(reservation._id)}:payment_captured`,
        });

        return { ok: true };
      }

      /**
       * DEV_DROPOFF_PENDING
       * - owner OU renter
       * - uniquement si in_progress
       */
      case "DEV_DROPOFF_PENDING": {
        if (reservation.status !== "in_progress") {
          return { ok: false, code: "InvalidStatus" };
        }

        await transitionReservationStatus({
          ctx,
          reservationId: reservation._id,
          renterUserId: reservation.renterUserId,
          ownerUserId: String(reservation.ownerUserId ?? ""),
          actorUserId: me,

          nextStatus: "dropoff_pending",
          eventType: "dropoff_pending",

          idempotencyKey: `res:${String(reservation._id)}:dropoff_pending`,
        });

        return { ok: true };
      }

      default:
        return { ok: false, code: "UnknownAction" };
    }
  },
});