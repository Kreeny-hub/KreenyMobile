import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import type { ChatAction } from "./_lib/chatActions";
import { DEV_CHAT_ACTIONS } from "./_lib/chatActions";
import { getRoleOrThrow, loadReservationOrThrow } from "./_lib/reservationGuards";
import { transitionReservationStatus } from "./_lib/reservationTransitions";
import { releaseVehicleLocks } from "./_lib/vehicleLocks";
import { userKey } from "./_lib/userKey";
import { authComponent } from "./auth";
import { computeCancellationRefund, computeOwnerCancellationRefund, type CancellationPolicy } from "./_lib/cancellationPolicy";

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
    | "OnlyOwnerCanAccept";
  };

export const runChatAction = mutation({
  args: {
    threadId: v.id("threads"),
    action: v.union(
      v.literal("PAY_NOW"),
      v.literal("ACCEPT"),
      v.literal("REJECT"),
      v.literal("TRIGGER_RETURN"),
      v.literal("CANCEL_RESERVATION"),
      v.literal("OWNER_CANCEL"),
      v.literal("DEV_MARK_PAID"),
      v.literal("DEV_DROPOFF_PENDING")
    ),
  },
  handler: async (ctx, args): Promise<ActionResult> => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);
    const action = args.action as ChatAction;

    if (process.env.NODE_ENV === "production" && DEV_CHAT_ACTIONS.has(action)) {
      return { ok: false, code: "Forbidden" };
    }

    const thread = await ctx.db.get(args.threadId);
    if (!thread) throw new ConvexError("ThreadNotFound");

    if (thread.renterUserId !== me && thread.ownerUserId !== me) {
      return { ok: false, code: "Forbidden" };
    }

    const reservation = await loadReservationOrThrow(ctx, thread.reservationId);
    const role = getRoleOrThrow(reservation, me);

    switch (action) {
      case "ACCEPT": {
        if (role !== "owner") return { ok: false, code: "OnlyOwnerCanAccept" };
        if (reservation.status !== "requested") return { ok: false, code: "InvalidStatus" };

        await transitionReservationStatus({
          ctx,
          reservationId: reservation._id,
          renterUserId: reservation.renterUserId,
          ownerUserId: String(reservation.ownerUserId ?? ""),
          actorUserId: me,
          nextStatus: "accepted_pending_payment",
          eventType: "reservation_accepted",
          patch: { acceptedAt: Date.now() },
          idempotencyKey: `res:${String(reservation._id)}:reservation_accepted`,
        });

        return { ok: true };
      }

      case "REJECT": {
        if (role !== "owner") return { ok: false, code: "Forbidden" };
        if (reservation.status !== "requested") return { ok: false, code: "InvalidStatus" };

        await transitionReservationStatus({
          ctx,
          reservationId: reservation._id,
          renterUserId: reservation.renterUserId,
          ownerUserId: String(reservation.ownerUserId ?? ""),
          actorUserId: me,
          nextStatus: "rejected",
          eventType: "reservation_rejected",
          idempotencyKey: `res:${String(reservation._id)}:reservation_rejected`,
        });

        await releaseVehicleLocks({
          ctx,
          vehicleId: reservation.vehicleId,
          reservationId: reservation._id,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
        });

        return { ok: true };
      }

      case "PAY_NOW": {
        if (role !== "renter") return { ok: false, code: "OnlyRenterCanPay" };
        if (reservation.status !== "accepted_pending_payment") return { ok: false, code: "InvalidStatus" };

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

      case "DEV_MARK_PAID": {
        if (role !== "renter") return { ok: false, code: "Forbidden" };
        if (reservation.status !== "accepted_pending_payment") return { ok: false, code: "InvalidStatus" };
        if (reservation.paymentStatus !== "requires_action") return { ok: false, code: "PaymentNotInitialized" };

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

      case "TRIGGER_RETURN": {
        if (reservation.status !== "in_progress") return { ok: false, code: "InvalidStatus" };

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

      case "CANCEL_RESERVATION": {
        if (role !== "renter") return { ok: false, code: "Forbidden" };

        const renterCancellable = new Set(["requested", "accepted_pending_payment", "pickup_pending"]);
        if (!renterCancellable.has(reservation.status)) return { ok: false, code: "InvalidStatus" };

        // ── Compute refund ──
        const cancelVehicle = await ctx.db.get(reservation.vehicleId);
        const cancelPolicy = ((cancelVehicle as any)?.cancellationPolicy ?? "moderate") as CancellationPolicy;
        const cancelIsPaid = reservation.paymentStatus === "captured";
        const cancelDays = Math.max(1, Math.ceil((new Date(reservation.endDate).getTime() - new Date(reservation.startDate).getTime()) / 86_400_000));
        const cancelTotal = (reservation as any).totalAmount ?? ((cancelVehicle?.pricePerDay ?? 0) * cancelDays);
        const cancelRefund = computeCancellationRefund(cancelPolicy, reservation.startDate, cancelTotal, cancelIsPaid);

        await transitionReservationStatus({
          ctx,
          reservationId: reservation._id,
          renterUserId: reservation.renterUserId,
          ownerUserId: String(reservation.ownerUserId ?? ""),
          actorUserId: me,
          nextStatus: "cancelled",
          eventType: "reservation_cancelled",
          idempotencyKey: `res:${String(reservation._id)}:renter_cancelled`,
          patch: {
            cancelledAt: Date.now(),
            cancelledBy: "renter",
            cancellationPolicy: cancelPolicy,
            refundPercent: cancelRefund.refundPercent,
            refundAmount: cancelRefund.refundAmount,
            penaltyAmount: cancelRefund.penaltyAmount,
            cancellationReason: cancelRefund.reason,
          },
          payload: { reason: "renter_cancelled", refundPercent: cancelRefund.refundPercent },
        });

        await releaseVehicleLocks({
          ctx,
          vehicleId: reservation.vehicleId,
          reservationId: reservation._id,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
        });

        return { ok: true };
      }

      case "OWNER_CANCEL": {
        if (role !== "owner") return { ok: false, code: "Forbidden" };

        const cancellable = new Set(["requested", "accepted_pending_payment", "pickup_pending"]);
        if (!cancellable.has(reservation.status)) return { ok: false, code: "InvalidStatus" };

        // ── Owner cancel → full refund ──
        const ownerCancelVehicle = await ctx.db.get(reservation.vehicleId);
        const ownerCancelIsPaid = reservation.paymentStatus === "captured";
        const ownerCancelDays = Math.max(1, Math.ceil((new Date(reservation.endDate).getTime() - new Date(reservation.startDate).getTime()) / 86_400_000));
        const ownerCancelTotal = (reservation as any).totalAmount ?? ((ownerCancelVehicle?.pricePerDay ?? 0) * ownerCancelDays);
        const ownerCancelRefund = computeOwnerCancellationRefund(ownerCancelTotal, ownerCancelIsPaid);

        await transitionReservationStatus({
          ctx,
          reservationId: reservation._id,
          renterUserId: reservation.renterUserId,
          ownerUserId: String(reservation.ownerUserId ?? ""),
          actorUserId: me,
          nextStatus: "cancelled",
          eventType: "reservation_cancelled",
          idempotencyKey: `res:${String(reservation._id)}:owner_cancelled`,
          patch: {
            cancelledAt: Date.now(),
            cancelledBy: "owner",
            cancellationPolicy: (ownerCancelVehicle as any)?.cancellationPolicy ?? "moderate",
            refundPercent: 1,
            refundAmount: ownerCancelRefund.refundAmount,
            penaltyAmount: 0,
            cancellationReason: ownerCancelRefund.reason,
          },
          payload: { reason: "owner_cancelled", refundAmount: ownerCancelRefund.refundAmount },
        });

        await releaseVehicleLocks({
          ctx,
          vehicleId: reservation.vehicleId,
          reservationId: reservation._id,
          startDate: reservation.startDate,
          endDate: reservation.endDate,
        });

        return { ok: true };
      }

      case "DEV_DROPOFF_PENDING": {
        if (reservation.status !== "in_progress") return { ok: false, code: "InvalidStatus" };

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
