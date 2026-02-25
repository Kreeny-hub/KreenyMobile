import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import type { ChatAction } from "./_lib/chatActions";
import { DEV_CHAT_ACTIONS } from "./_lib/chatActions";
import { CANCELLABLE_STATUSES } from "./_lib/enums";
import { getRoleOrThrow, loadReservationOrThrow } from "./_lib/reservationGuards";
import { transitionReservationStatus } from "./_lib/reservationTransitions";
import { releaseVehicleLocks } from "./_lib/vehicleLocks";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";

type ActionResult =
  | { ok: true }
  | {
    ok: false;
    code:
    | "Forbidden"
    | "InvalidStatus"
    | "PaymentNotInitialized"
    | "UnknownAction"
    | "OnlyRenterCanPay"
    | "OnlyRenterCanCancel";
  };

export const runChatAction = mutation({
  args: {
    threadId: v.id("threads"),
    action: v.union(
      v.literal("PAY_NOW"),
      v.literal("CANCEL_RESERVATION"),
      v.literal("DEV_MARK_PAID"),
      v.literal("DEV_DROPOFF_PENDING")
    ),
  },
  handler: async (ctx, args): Promise<ActionResult> => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);
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

          nextStatus: reservation.status,
          eventType: "payment_initialized",
          patch: { paymentStatus: "requires_action" },

          idempotencyKey: `res:${String(reservation._id)}:payment_initialized`,
        });

        return { ok: true };
      }

      /**
       * CANCEL_RESERVATION
       * - locataire uniquement
       * - statuts annulables: requested, accepted_pending_payment, pickup_pending
       * - libère les vehicle locks
       */
      case "CANCEL_RESERVATION": {
        if (role !== "renter") {
          return { ok: false, code: "OnlyRenterCanCancel" };
        }

        if (!CANCELLABLE_STATUSES.has(reservation.status as any)) {
          return { ok: false, code: "InvalidStatus" };
        }

        await transitionReservationStatus({
          ctx,
          reservationId: reservation._id,
          renterUserId: reservation.renterUserId,
          ownerUserId: String(reservation.ownerUserId ?? ""),
          actorUserId: me,

          nextStatus: "cancelled",
          eventType: "reservation_cancelled",

          idempotencyKey: `res:${String(reservation._id)}:reservation_cancelled`,
        });

        // ✅ Libérer les locks de dates
        await releaseVehicleLocks({
          ctx,
          vehicleId: reservation.vehicleId,
          reservationId: reservation._id,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
        });

        return { ok: true };
      }

      /**
       * DEV_MARK_PAID
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
