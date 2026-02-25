import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type ReservationEventType =
  | "reservation_created"
  | "reservation_accepted"
  | "reservation_rejected"
  | "reservation_cancelled"
  | "payment_initialized"
  | "payment_captured"
  | "checkin_completed"
  | "checkout_completed"
  | "condition_report_submitted"
  | "dropoff_pending"
  | "deposit_held"
  | "deposit_released";

type Visibility = "all" | "renter" | "owner";
type SystemAction = { label: string; route: string };

function defaultIdempotencyKey(reservationId: string, type: ReservationEventType) {
  return `res:${reservationId}:${type}`;
}

async function ensureThread(
  ctx: MutationCtx,
  args: { reservationId: Id<"reservations">; renterUserId: string; ownerUserId: string }
) {
  const existing = await ctx.db
    .query("threads")
    .withIndex("by_reservation", (q) => q.eq("reservationId", args.reservationId))
    .unique();

  if (existing) return existing._id;

  const now = Date.now();
  return await ctx.db.insert("threads", {
    reservationId: args.reservationId,
    renterUserId: args.renterUserId,
    ownerUserId: args.ownerUserId,
    createdAt: now,
    lastMessageAt: now,
  });
}

function buildSystemMessage(event: {
  type: ReservationEventType;
  reservationId: Id<"reservations">;
  payload?: any;
}): { text: string; actions?: SystemAction[]; visibility: Visibility } {
  switch (event.type) {
    case "reservation_created":
      return {
        text: "Demande envoyée. Le loueur va répondre.",
        actions: [{ label: "Voir la réservation", route: "action:OPEN_RESERVATION" }],
        visibility: "all",
      };

    case "reservation_accepted":
      return {
        text: "Demande acceptée ✅ Paiement requis pour confirmer.",
        actions: [{ label: "Payer maintenant", route: "action:PAY_NOW" }],
        visibility: "renter",
      };

    case "payment_initialized":
      return {
        text: "Paiement initialisé ✅ (DEV) Tu peux simuler un paiement réussi.",
        actions: [{ label: "Simuler paiement réussi (DEV)", route: "action:DEV_MARK_PAID" }],
        visibility: "all",
      };

    case "payment_captured":
      return {
        text: "Paiement validé ✅ Constat départ requis.",
        actions: [{ label: "Faire le constat départ", route: "action:DO_CHECKIN" }],
        visibility: "all",
      };

    case "condition_report_submitted": {
      const phase = event.payload?.phase; // "checkin" | "checkout"
      const role = event.payload?.role; // "owner" | "renter"
      const who = role === "owner" ? "Le loueur" : "Le locataire";
      const when = phase === "checkin" ? "départ" : "retour";
      return { text: `${who} a soumis le constat ${when}.`, visibility: "all" };
    }

    case "checkin_completed":
      return { text: "Constat départ complété ✅ La location commence.", visibility: "all" };

    case "dropoff_pending":
      return {
        text: "Retour du véhicule : constat retour requis.",
        actions: [{ label: "Faire le constat retour", route: "action:DO_CHECKOUT" }],
        visibility: "all",
      };

    case "checkout_completed":
      return { text: "Constat retour complété ✅ Réservation terminée.", visibility: "all" };

    case "reservation_cancelled":
      return { text: "Réservation annulée.", visibility: "all" };

    case "reservation_rejected":
      return { text: "Demande refusée.", visibility: "all" };

    case "deposit_held":
      return { text: "Caution sécurisée ✅", visibility: "all" };

    case "deposit_released":
      return { text: "Caution libérée ✅", visibility: "all" };

    default:
      throw new ConvexError("UnknownEventType");
  }
}

/**
 * Event store (idempotent) + projection chat (idempotent) + MAJ thread.lastMessageAt + MAJ message actions
 */
export async function emitReservationEvent(opts: {
  ctx: MutationCtx;
  reservationId: Id<"reservations">;
  renterUserId: string;
  ownerUserId: string;
  type: ReservationEventType;
  actorUserId: string;
  payload?: any;
  idempotencyKey?: string;
}) {
  const { ctx } = opts;
  const now = Date.now();

  const idKey = opts.idempotencyKey ?? defaultIdempotencyKey(String(opts.reservationId), opts.type);

  // 1) Append event store (idempotent)
  const existingEvent = await ctx.db
    .query("reservationEvents")
    .withIndex("by_idempotency", (q) => q.eq("idempotencyKey", idKey))
    .unique();

  const eventId =
    existingEvent?._id ??
    (await ctx.db.insert("reservationEvents", {
      reservationId: opts.reservationId,
      type: opts.type,
      actorUserId: opts.actorUserId,
      createdAt: now,
      idempotencyKey: idKey,
      payload: opts.payload,
    }));

  // 2) Ensure thread exists
  const threadId = await ensureThread(ctx, {
    reservationId: opts.reservationId,
    renterUserId: opts.renterUserId,
    ownerUserId: opts.ownerUserId,
  });

  // 3) Project to chat (idempotent via eventId)
  const messageKey = `event:${String(eventId)}`;
  const already = await ctx.db
    .query("messages")
    .withIndex("by_eventKey", (q) => q.eq("eventKey", messageKey))
    .unique();

  if (!already) {
    const { text, actions, visibility } = buildSystemMessage({
      type: opts.type,
      reservationId: opts.reservationId,
      payload: opts.payload,
    });

    await ctx.db.insert("messages", {
      threadId,
      reservationId: opts.reservationId,
      type: "system",
      text,
      createdAt: now,
      eventKey: messageKey,
      actions,
      visibility,
    });
  }

  // 4) Update thread lastMessageAt
  await ctx.db.patch(threadId, { lastMessageAt: now });

  // 5) Update "actions message" snapshot
  const reservation = await ctx.db.get(opts.reservationId);
  if (reservation) {
    await upsertActionsMessage(ctx, {
      threadId,
      reservationId: opts.reservationId,
      status: reservation.status,
      paymentStatus: reservation.paymentStatus,
    });
  }

  return { ok: true, eventId, threadId, deduped: Boolean(existingEvent) };
}

async function upsertActionsMessage(
  ctx: MutationCtx,
  args: {
    threadId: Id<"threads">;
    reservationId: Id<"reservations">;
    status: string;
    paymentStatus?: string | undefined;
  }
) {
  const now = Date.now();
  const key = `actions:${String(args.reservationId)}`;

  const existing = await ctx.db
    .query("messages")
    .withIndex("by_eventKey", (q) => q.eq("eventKey", key))
    .unique();

  // calcule les actions selon le statut (centralisé backend)
  let actions: { label: string; route: string }[] = [];
  let visibility: Visibility = "all";
  let text = "Actions disponibles";

  switch (args.status) {
    case "requested":
      // ✅ Le locataire peut annuler pendant que le loueur n'a pas encore répondu
      actions = [
        { label: "Annuler la demande", route: "action:CANCEL_RESERVATION" },
      ];
      visibility = "renter";
      text = "En attente de réponse du loueur";
      break;

    case "accepted_pending_payment":
      actions = [
        { label: "Payer maintenant", route: "action:PAY_NOW" },
        { label: "Annuler", route: "action:CANCEL_RESERVATION" },
      ];
      visibility = "renter";
      text = "Paiement requis";
      break;

    case "pickup_pending":
      actions = [
        { label: "Faire le constat départ", route: "action:DO_CHECKIN" },
        { label: "Annuler", route: "action:CANCEL_RESERVATION" },
      ];
      visibility = "all";
      text = "Constat départ requis";
      break;

    case "dropoff_pending":
      actions = [{ label: "Faire le constat retour", route: "action:DO_CHECKOUT" }];
      visibility = "all";
      text = "Constat retour requis";
      break;

    default:
      actions = [];
      visibility = "all";
      text = "Aucune action";
  }

  if (!existing) {
    // ✅ création 1 seule fois
    await ctx.db.insert("messages", {
      threadId: args.threadId,
      reservationId: args.reservationId,
      type: "actions",
      text,
      createdAt: now,
      eventKey: key,
      actions,
      visibility,
    });
    return;
  }

  // ✅ mise à jour: patch SEULEMENT des champs modifiables
  await ctx.db.patch(existing._id, {
    text,
    actions,
    visibility,
    // ✅ on ne touche PAS createdAt : le message "actions" reste stable dans la liste
  });

  // optionnel: garder le thread "chaud" si les actions changent
  await ctx.db.patch(args.threadId, { lastMessageAt: now });
}