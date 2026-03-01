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
  | "deposit_released"
  | "dispute_opened"
  | "dispute_resolved";

type Visibility = "all" | "renter" | "owner";
type ActionItem = { label: string; route: string };

type MessageSpec = {
  text: string;
  archivedText: string;
  actions?: ActionItem[];
  visibility: Visibility;
};

function defaultIdempotencyKey(reservationId: string, type: ReservationEventType) {
  return `res:${reservationId}:${type}`;
}

// ═══════════════════════════════════════════════════════
// Welcome messages
// ═══════════════════════════════════════════════════════
const WELCOME_RENTER =
  "Bienvenue sur Kreeny ! 👋 Présente ton permis au propriétaire, réalise le constat via l'app et n'effectue jamais de paiement en dehors de Kreeny.";

const WELCOME_OWNER =
  "Bienvenue sur Kreeny ! 👋 Vérifie le permis du locataire, réalise le constat ensemble via l'app et n'accepte jamais de paiement en dehors de Kreeny.";

// ═══════════════════════════════════════════════════════
// Ensure thread + welcome messages
// ═══════════════════════════════════════════════════════
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
  const threadId = await ctx.db.insert("threads", {
    reservationId: args.reservationId,
    renterUserId: args.renterUserId,
    ownerUserId: args.ownerUserId,
    createdAt: now,
    lastMessageAt: now,
  });

  await ctx.db.insert("messages", {
    threadId, reservationId: args.reservationId,
    type: "welcome", text: WELCOME_RENTER,
    createdAt: now - 2,
    eventKey: `welcome:${String(args.reservationId)}:renter`,
    visibility: "renter",
  });

  await ctx.db.insert("messages", {
    threadId, reservationId: args.reservationId,
    type: "welcome", text: WELCOME_OWNER,
    createdAt: now - 1,
    eventKey: `welcome:${String(args.reservationId)}:owner`,
    visibility: "owner",
  });

  return threadId;
}

// ═══════════════════════════════════════════════════════
// Resolve display names
// ═══════════════════════════════════════════════════════
async function resolveNames(ctx: MutationCtx, renterUserId: string, ownerUserId: string) {
  const rp = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", renterUserId)).first();
  const op = await ctx.db.query("userProfiles").withIndex("by_user", (q) => q.eq("userId", ownerUserId)).first();
  return {
    renterName: rp?.displayName ?? "le locataire",
    ownerName: op?.displayName ?? "le propriétaire",
  };
}

// ═══════════════════════════════════════════════════════
// Archive ALL previous action messages (strip buttons, simplify text)
// Used when BOTH parties move to next step (e.g. checkin_completed)
// ═══════════════════════════════════════════════════════
async function archivePreviousActionMessages(
  ctx: MutationCtx,
  threadId: Id<"threads">,
  reservationId: Id<"reservations">
) {
  const allMsgs = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .collect();

  for (const msg of allMsgs) {
    if (
      String(msg.reservationId) === String(reservationId) &&
      msg.actions &&
      msg.actions.length > 0
    ) {
      const archived = (msg as any).archivedText;
      if (archived) {
        // Replace with archived text
        await ctx.db.patch(msg._id, { actions: [], text: archived });
      } else {
        // No archived text → delete the message entirely
        await ctx.db.delete(msg._id);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
// Archive action messages for ONE specific role only
// Used when one party completes their part (constat, review)
// ═══════════════════════════════════════════════════════
async function archiveActionMessagesForRole(
  ctx: MutationCtx,
  threadId: Id<"threads">,
  reservationId: Id<"reservations">,
  role: string
) {
  const allMsgs = await ctx.db
    .query("messages")
    .withIndex("by_thread", (q) => q.eq("threadId", threadId))
    .collect();

  for (const msg of allMsgs) {
    if (
      String(msg.reservationId) === String(reservationId) &&
      msg.actions &&
      msg.actions.length > 0 &&
      msg.visibility === role
    ) {
      const archived = (msg as any).archivedText;
      if (archived) {
        await ctx.db.patch(msg._id, { actions: [], text: archived });
      } else {
        await ctx.db.delete(msg._id);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════
// Build warm event messages per transition
// ═══════════════════════════════════════════════════════
function buildEventMessages(
  event: { type: ReservationEventType; reservationId: Id<"reservations">; payload?: any },
  names: { renterName: string; ownerName: string }
): MessageSpec[] {
  const { renterName, ownerName } = names;

  switch (event.type) {
    // ── Demande envoyée ──
    case "reservation_created":
      return [
        {
          text: `Ta demande a été envoyée ! ${ownerName} va la consulter et te répondra rapidement.`,
          archivedText: "",
          visibility: "renter",
        },
        {
          text: `Nouvelle demande de ${renterName} ! Consulte son profil pour te décider.`,
          archivedText: "Demande traitée",
          actions: [
            { label: "Accepter la demande", route: "action:ACCEPT" },
            { label: "Décliner", route: "action:REJECT" },
          ],
          visibility: "owner",
        },
      ];

    // ── Demande acceptée ──
    case "reservation_accepted":
      return [
        {
          text: `${ownerName} a accepté ta demande ! Procède au paiement pour confirmer la réservation.`,
          archivedText: "",
          actions: [{ label: "Payer et confirmer", route: "action:PAY_NOW" }],
          visibility: "renter",
        },
        {
          text: `Tu as accepté la demande de ${renterName}. En attente de son paiement.`,
          archivedText: "Demande acceptée",
          visibility: "owner",
        },
      ];

    // ── Demande refusée ──
    case "reservation_rejected":
      return [{
        text: "La demande a été déclinée.",
        archivedText: "Demande déclinée",
        visibility: "all",
      }];

    // ── Paiement en cours → SKIP ──
    case "payment_initialized":
      return [];

    // ── Paiement validé ──
    case "payment_captured":
      return [
        {
          text: "Paiement reçu, la réservation est confirmée ! Le jour J, réalisez le constat de départ ensemble avant de prendre la route.",
          archivedText: "",
          actions: [{ label: "Réaliser le constat de départ", route: "action:DO_CHECKIN" }],
          visibility: "renter",
        },
        {
          text: "Paiement reçu, la réservation est confirmée ! Le jour J, réalisez le constat de départ ensemble avant de prendre la route.",
          archivedText: "",
          actions: [{ label: "Réaliser le constat de départ", route: "action:DO_CHECKIN" }],
          visibility: "owner",
        },
      ];

    // ── Constat partiel soumis ──
    case "condition_report_submitted": {
      const phase = event.payload?.phase;
      const role = event.payload?.role;
      const who = role === "owner" ? ownerName : renterName;
      const when = phase === "checkin" ? "départ" : "retour";
      return [{
        text: `${who} a complété le constat de ${when}.`,
        archivedText: `Constat ${when} complété`,
        visibility: "all",
      }];
    }

    // ── Constat départ complété ──
    case "checkin_completed":
      return [
        {
          text: "Constat de départ validé, bonne route ! Au retour du véhicule, déclarez le retour ici.",
          archivedText: "",
          actions: [{ label: "Déclarer le retour du véhicule", route: "action:TRIGGER_RETURN" }],
          visibility: "renter",
        },
        {
          text: "Constat de départ validé, bonne route ! Au retour du véhicule, déclarez le retour ici.",
          archivedText: "",
          actions: [{ label: "Déclarer le retour du véhicule", route: "action:TRIGGER_RETURN" }],
          visibility: "owner",
        },
      ];

    // ── Retour déclaré ──
    case "dropoff_pending":
      return [
        {
          text: "Retour du véhicule déclaré. Réalisez le constat de retour ensemble pour finaliser.",
          archivedText: "",
          actions: [{ label: "Réaliser le constat de retour", route: "action:DO_CHECKOUT" }],
          visibility: "renter",
        },
        {
          text: "Retour du véhicule déclaré. Réalisez le constat de retour ensemble pour finaliser.",
          archivedText: "",
          actions: [{ label: "Réaliser le constat de retour", route: "action:DO_CHECKOUT" }],
          visibility: "owner",
        },
      ];

    // ── Location terminée ──
    case "checkout_completed":
      return [
        {
          text: "La location est terminée et la caution a été libérée. Merci d'avoir utilisé Kreeny, on espère que tout s'est bien passé !",
          archivedText: "La location est terminée et la caution a été libérée. Merci d'avoir utilisé Kreeny, on espère que tout s'est bien passé !",
          actions: [{ label: "Laisser un avis", route: `action:LEAVE_REVIEW:${String(event.reservationId)}` }],
          visibility: "renter",
        },
        {
          text: "La location est terminée et la caution a été libérée. Merci d'avoir utilisé Kreeny, on espère que tout s'est bien passé !",
          archivedText: "La location est terminée et la caution a été libérée. Merci d'avoir utilisé Kreeny, on espère que tout s'est bien passé !",
          actions: [{ label: "Laisser un avis", route: `action:LEAVE_REVIEW:${String(event.reservationId)}` }],
          visibility: "owner",
        },
      ];

    // ── Annulation ──
    case "reservation_cancelled": {
      const reason = event.payload?.reason;
      const text = reason === "owner_cancelled"
        ? `Réservation annulée par ${ownerName}.`
        : reason === "renter_cancelled"
        ? `Réservation annulée par ${renterName}.`
        : "Réservation annulée.";
      return [{ text, archivedText: text, visibility: "all" }];
    }

    // ── Caution (silencieux — info intégrée dans le message de fin) ──
    case "deposit_held":
      return [];
    case "deposit_released":
      return [];

    // ── Litige ──
    case "dispute_opened":
      return [{
        text: "Un litige a été ouvert. La caution reste bloquée en attendant la résolution.",
        archivedText: "Litige ouvert",
        visibility: "all",
      }];
    case "dispute_resolved":
      return [{ text: "Le litige a été résolu.", archivedText: "Litige résolu", visibility: "all" }];

    default:
      throw new ConvexError("UnknownEventType");
  }
}

// ═══════════════════════════════════════════════════════
// Main: emit reservation event
// ═══════════════════════════════════════════════════════
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

  // 1) Event store (idempotent)
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

  // 2) Ensure thread + welcome messages
  const threadId = await ensureThread(ctx, {
    reservationId: opts.reservationId,
    renterUserId: opts.renterUserId,
    ownerUserId: opts.ownerUserId,
  });

  // Already processed? (idempotency)
  const messageKey = `event:${String(eventId)}`;
  const alreadyProjected = await ctx.db
    .query("messages")
    .withIndex("by_eventKey", (q) => q.eq("eventKey", messageKey))
    .unique();

  if (!alreadyProjected) {
    // 3) Resolve names
    const names = await resolveNames(ctx, opts.renterUserId, opts.ownerUserId);

    // 4) Build message(s)
    const specs = buildEventMessages(
      { type: opts.type, reservationId: opts.reservationId, payload: opts.payload },
      names
    );

    // 5) Archive previous action messages
    //    - New actions or terminal events → archive ALL previous buttons
    //    - Constat submitted → archive ONLY the submitter's button
    const hasNewActions = specs.some((s) => s.actions && s.actions.length > 0);
    const isTerminal = ["reservation_rejected", "reservation_cancelled"].includes(opts.type);

    if (opts.type === "condition_report_submitted" && opts.payload?.role) {
      // Only remove the button for the party who submitted their constat
      await archiveActionMessagesForRole(ctx, threadId, opts.reservationId, opts.payload.role);
    } else if (hasNewActions || isTerminal) {
      await archivePreviousActionMessages(ctx, threadId, opts.reservationId);
    }

    // 6) Insert message(s)
    let lastText = "";
    for (let i = 0; i < specs.length; i++) {
      const spec = specs[i];
      await ctx.db.insert("messages", {
        threadId,
        reservationId: opts.reservationId,
        type: "system",
        text: spec.text,
        archivedText: spec.archivedText,
        createdAt: now + i,
        eventKey: i === 0 ? messageKey : `${messageKey}:${i}`,
        actions: spec.actions,
        visibility: spec.visibility,
      });
      lastText = spec.text;
    }

    // 7) Update thread lastMessageAt
    if (lastText) {
      const threadPatch: Record<string, any> = { lastMessageAt: now + specs.length - 1 };
      threadPatch.lastMessageText = lastText.length > 100 ? lastText.slice(0, 100) + "…" : lastText;
      threadPatch.lastMessageSenderId = "system";
      await ctx.db.patch(threadId, threadPatch);
    }
  }

  return { ok: true, eventId, threadId, deduped: Boolean(existingEvent) };
}
