/**
 * convex/stripe.ts
 * ────────────────────────────────────────────────────
 * Stripe backend integration:
 *   - createPaymentIntent  → called by frontend before PaymentSheet
 *   - createDepositHold    → authorization hold for caution
 *   - handleWebhook        → confirms payment server-side
 *   - releaseDeposit       → cancel deposit hold after clean return
 *   - captureDeposit       → capture deposit after dispute
 *
 * Environment variables required in Convex dashboard:
 *   STRIPE_SECRET_KEY       → sk_test_... or sk_live_...
 *   STRIPE_WEBHOOK_SECRET   → whsec_...
 *   STRIPE_PUBLISHABLE_KEY  → pk_test_... (returned to frontend)
 *
 * If STRIPE_SECRET_KEY is not set, all functions fall back to DEV mode.
 */

import { v, ConvexError } from "convex/values";
import { action, internalAction, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { authComponent } from "./auth";
import { userKey } from "./_lib/userKey";
import { emitReservationEvent } from "./_lib/reservationEvents";
import { transitionReservationStatus } from "./_lib/reservationTransitions";

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

function getStripeKey(ctx: any): string | null {
  try {
    return process.env.STRIPE_SECRET_KEY ?? null;
  } catch {
    return null;
  }
}

/** Minimal Stripe API caller (no SDK dependency) */
async function stripeRequest(
  method: "POST" | "GET" | "DELETE",
  path: string,
  body?: Record<string, any>,
  secretKey?: string
) {
  const key = secretKey;
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");

  const url = `https://api.stripe.com/v1${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };

  let encodedBody: string | undefined;
  if (body) {
    encodedBody = encodeStripeParams(body);
  }

  const resp = await fetch(url, {
    method,
    headers,
    body: encodedBody,
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message ?? `Stripe error ${resp.status}`);
  }
  return data;
}

/** Encode nested objects for Stripe's form-encoded API */
function encodeStripeParams(obj: Record<string, any>, prefix = ""): string {
  const parts: string[] = [];
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (val === undefined || val === null) continue;
    if (typeof val === "object" && !Array.isArray(val)) {
      parts.push(encodeStripeParams(val, fullKey));
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(String(val))}`);
    }
  }
  return parts.join("&");
}

// ═══════════════════════════════════════════════════════
// 1. GET CONFIG (publishable key for frontend)
// ═══════════════════════════════════════════════════════
export const getStripeConfig = action({
  args: {},
  handler: async () => {
    const pk = process.env.STRIPE_PUBLISHABLE_KEY ?? null;
    return {
      publishableKey: pk,
      isConfigured: !!pk && !!process.env.STRIPE_SECRET_KEY,
    };
  },
});

// ═══════════════════════════════════════════════════════
// 2. CREATE PAYMENT INTENT (called before PaymentSheet)
// ═══════════════════════════════════════════════════════
export const createPaymentIntent = action({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    // Get reservation
    const reservation: any = await ctx.runQuery(
      internal.stripe._queryReservation,
      { reservationId: args.reservationId }
    );
    if (!reservation) throw new ConvexError("ReservationNotFound");
    if (reservation.renterUserId !== me) throw new ConvexError("Forbidden");
    if (reservation.status !== "accepted_pending_payment") throw new ConvexError("InvalidStatus");

    const amount = (reservation.totalAmount ?? 0) + (reservation.commissionAmount ?? 0);
    if (amount <= 0) throw new ConvexError("InvalidAmount");

    const secretKey = getStripeKey(ctx);

    // ── DEV MODE ──
    if (!secretKey) {
      // Mark as initialized and return fake data
      await ctx.runMutation(internal.stripe._markPaymentInitialized, {
        reservationId: args.reservationId,
        stripePaymentIntentId: `DEV_PI_${Date.now()}`,
        renterUserId: me,
      });
      return {
        clientSecret: null,
        devMode: true,
        amount,
        currency: reservation.currency ?? "mad",
      };
    }

    // ── REAL STRIPE ──
    // Ensure renter has a Stripe customer
    let customerId = reservation.renterStripeCustomerId;
    if (!customerId) {
      const profile: any = await ctx.runQuery(internal.stripe._getProfileInternal, { userId: me });
      const customer = await stripeRequest("POST", "/customers", {
        name: profile?.displayName ?? "Kreeny User",
        phone: profile?.phone ?? undefined,
        metadata: { kreenyUserId: me },
      }, secretKey);
      customerId = customer.id;
      await ctx.runMutation(internal.stripe._saveStripeCustomerId, { userId: me, stripeCustomerId: customerId! });
    }

    // Create PaymentIntent
    const pi = await stripeRequest("POST", "/payment_intents", {
      amount: Math.round(amount * 100), // centimes
      currency: (reservation.currency ?? "mad").toLowerCase(),
      customer: customerId,
      setup_future_usage: "off_session", // save card for deposit hold later
      metadata: {
        reservationId: String(args.reservationId),
        type: "rental_payment",
      },
    }, secretKey);

    // Create ephemeral key for PaymentSheet
    const ephemeralKey = await stripeRequest("POST", "/ephemeral_keys", {
      customer: customerId,
    }, secretKey);

    // Mark reservation as payment initialized
    await ctx.runMutation(internal.stripe._markPaymentInitialized, {
      reservationId: args.reservationId,
      stripePaymentIntentId: pi.id,
      renterUserId: me,
    });

    return {
      clientSecret: pi.client_secret,
      ephemeralKey: ephemeralKey.secret,
      customerId,
      devMode: false,
      amount,
      currency: reservation.currency ?? "mad",
    };
  },
});

// ═══════════════════════════════════════════════════════
// 3. CONFIRM PAYMENT (called after PaymentSheet success)
// ═══════════════════════════════════════════════════════
export const confirmPayment = action({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = userKey(user);

    const reservation: any = await ctx.runQuery(
      internal.stripe._queryReservation,
      { reservationId: args.reservationId }
    );
    if (!reservation) throw new ConvexError("ReservationNotFound");
    if (reservation.renterUserId !== me) throw new ConvexError("Forbidden");

    const secretKey = getStripeKey(ctx);

    if (!secretKey) {
      // DEV mode: just mark as paid
      await ctx.runMutation(internal.stripe._markPaymentCaptured, {
        reservationId: args.reservationId,
        renterUserId: me,
      });
      return { ok: true, devMode: true };
    }

    // REAL: Verify PaymentIntent status with Stripe
    if (reservation.stripePaymentIntentId) {
      const pi = await stripeRequest(
        "GET",
        `/payment_intents/${reservation.stripePaymentIntentId}`,
        undefined,
        secretKey
      );
      if (pi.status !== "succeeded") {
        throw new ConvexError("PaymentNotCompleted");
      }
    }

    // Mark as paid + create deposit hold
    await ctx.runMutation(internal.stripe._markPaymentCaptured, {
      reservationId: args.reservationId,
      renterUserId: me,
    });

    // Create deposit hold (authorization without capture)
    const depositAmount = reservation.depositAmount ?? 0;
    if (depositAmount > 0 && reservation.renterStripeCustomerId) {
      try {
        // Get saved payment method
        const pms = await stripeRequest(
          "GET",
          `/payment_methods?customer=${reservation.renterStripeCustomerId}&type=card`,
          undefined,
          secretKey
        );
        const pm = pms?.data?.[0];

        if (pm) {
          const holdPi = await stripeRequest("POST", "/payment_intents", {
            amount: Math.round(depositAmount * 100),
            currency: (reservation.currency ?? "mad").toLowerCase(),
            customer: reservation.renterStripeCustomerId,
            payment_method: pm.id,
            capture_method: "manual", // authorize only, don't charge
            confirm: "true",
            off_session: "true",
            metadata: {
              reservationId: String(args.reservationId),
              type: "deposit_hold",
            },
          }, secretKey);

          await ctx.runMutation(internal.stripe._saveDepositHold, {
            reservationId: args.reservationId,
            holdRef: holdPi.id,
          });
        }
      } catch (e) {
        // Non-blocking: deposit hold failure doesn't cancel the rental
        console.error("Deposit hold failed:", e);
      }
    }

    return { ok: true, devMode: false };
  },
});

// ═══════════════════════════════════════════════════════
// 4. RELEASE DEPOSIT (clean return → cancel hold)
// ═══════════════════════════════════════════════════════
export const releaseDeposit = action({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const reservation: any = await ctx.runQuery(
      internal.stripe._queryReservation,
      { reservationId: args.reservationId }
    );
    if (!reservation) throw new ConvexError("ReservationNotFound");

    const secretKey = getStripeKey(ctx);
    const holdRef = reservation.depositHoldRef;

    if (secretKey && holdRef && !holdRef.startsWith("DEV_")) {
      // Cancel the authorization hold
      await stripeRequest("POST", `/payment_intents/${holdRef}/cancel`, {}, secretKey);
    }

    await ctx.runMutation(internal.stripe._updateDepositStatus, {
      reservationId: args.reservationId,
      status: "released",
    });

    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════
// 5. CAPTURE DEPOSIT (dispute → charge the deposit)
// ═══════════════════════════════════════════════════════
export const captureDeposit = action({
  args: {
    reservationId: v.id("reservations"),
    amount: v.optional(v.number()), // partial capture
  },
  handler: async (ctx, args) => {
    const reservation: any = await ctx.runQuery(
      internal.stripe._queryReservation,
      { reservationId: args.reservationId }
    );
    if (!reservation) throw new ConvexError("ReservationNotFound");

    const secretKey = getStripeKey(ctx);
    const holdRef = reservation.depositHoldRef;
    const captureAmount = args.amount ?? reservation.depositAmount ?? 0;

    if (secretKey && holdRef && !holdRef.startsWith("DEV_")) {
      // Capture the authorization (full or partial)
      await stripeRequest("POST", `/payment_intents/${holdRef}/capture`, {
        amount_to_capture: Math.round(captureAmount * 100),
      }, secretKey);
    }

    const isPartial = captureAmount < (reservation.depositAmount ?? 0);
    await ctx.runMutation(internal.stripe._updateDepositStatus, {
      reservationId: args.reservationId,
      status: isPartial ? "partially_retained" : "retained",
    });

    return { ok: true };
  },
});

// ═══════════════════════════════════════════════════════
// INTERNAL MUTATIONS (called by actions above)
// ═══════════════════════════════════════════════════════

// Need a query to actually read the DB
import { internalQuery } from "./_generated/server";

export const _queryReservation = internalQuery({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.reservationId);
    if (!r) return null;

    // Also get renter's stripeCustomerId
    const renterProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", r.renterUserId))
      .unique();

    return {
      ...r,
      renterStripeCustomerId: renterProfile?.stripeCustomerId ?? null,
    };
  },
});

export const _getProfileInternal = internalQuery({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
  },
});

export const _saveStripeCustomerId = internalMutation({
  args: { userId: v.string(), stripeCustomerId: v.string() },
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (profile) {
      await ctx.db.patch(profile._id, { stripeCustomerId: args.stripeCustomerId });
    }
  },
});

export const _markPaymentInitialized = internalMutation({
  args: { reservationId: v.id("reservations"), stripePaymentIntentId: v.string(), renterUserId: v.string() },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.reservationId);
    if (!r) return;

    await ctx.db.patch(args.reservationId, {
      paymentStatus: "requires_action",
      stripePaymentIntentId: args.stripePaymentIntentId,
    });

    // Emit event
    await emitReservationEvent({
      ctx,
      reservationId: args.reservationId,
      renterUserId: r.renterUserId,
      ownerUserId: String(r.ownerUserId ?? ""),
      actorUserId: args.renterUserId,
      type: "payment_initialized",
      idempotencyKey: `res:${String(args.reservationId)}:payment_initialized`,
    });
  },
});

export const _markPaymentCaptured = internalMutation({
  args: { reservationId: v.id("reservations"), renterUserId: v.string() },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.reservationId);
    if (!r) return;

    await transitionReservationStatus({
      ctx,
      reservationId: args.reservationId,
      renterUserId: r.renterUserId,
      ownerUserId: String(r.ownerUserId ?? ""),
      actorUserId: args.renterUserId,
      nextStatus: "pickup_pending",
      eventType: "payment_captured",
      patch: { paymentStatus: "captured" },
      idempotencyKey: `res:${String(args.reservationId)}:payment_captured`,
    });

    // Push notification to owner
    const vehicle = await ctx.db.get(r.vehicleId);
    if (r.ownerUserId) {
      await ctx.scheduler.runAfter(0, internal.push.sendPersonalizedPush, {
        targetUserId: String(r.ownerUserId),
        senderUserId: args.renterUserId,
        vehicleTitle: vehicle?.title ?? "un véhicule",
        type: "payment_captured",
        reservationId: String(args.reservationId),
      });
    }
  },
});

export const _saveDepositHold = internalMutation({
  args: { reservationId: v.id("reservations"), holdRef: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reservationId, {
      depositStatus: "held",
      depositHoldRef: args.holdRef,
    });
  },
});

export const _updateDepositStatus = internalMutation({
  args: {
    reservationId: v.id("reservations"),
    status: v.union(
      v.literal("released"),
      v.literal("partially_retained"),
      v.literal("retained")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reservationId, {
      depositStatus: args.status,
    });
  },
});

// ═══════════════════════════════════════════════════════
// WEBHOOK HANDLER (called from http.ts)
// ═══════════════════════════════════════════════════════
export const handleStripeWebhook = internalAction({
  args: { payload: v.string(), signature: v.string() },
  handler: async (ctx, args) => {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secretKey || !webhookSecret) return;

    // Parse event (simplified — in production use Stripe signature verification)
    let event: any;
    try {
      event = JSON.parse(args.payload);
    } catch {
      console.error("Invalid webhook payload");
      return;
    }

    const type = event.type;
    const pi = event.data?.object;
    const reservationId = pi?.metadata?.reservationId;

    if (!reservationId) return;

    switch (type) {
      case "payment_intent.succeeded": {
        if (pi.metadata?.type === "rental_payment") {
          // Payment confirmed — mark as captured
          await ctx.runMutation(internal.stripe._markPaymentCaptured, {
            reservationId: reservationId as any,
            renterUserId: "system",
          });
        }
        break;
      }
      case "payment_intent.payment_failed": {
        await ctx.runMutation(internal.stripe._markPaymentFailed, {
          reservationId: reservationId as any,
        });
        break;
      }
    }
  },
});

export const _markPaymentFailed = internalMutation({
  args: { reservationId: v.id("reservations") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reservationId, {
      paymentStatus: "failed",
    });
  },
});
