import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  vehicles: defineTable({
    title: v.string(),
    pricePerDay: v.number(),
    city: v.string(),
    imageUrls: v.array(v.string()),
    ownerId: v.optional(v.id("users")),
    ownerUserId: v.optional(v.string()),
    createdAt: v.number(),
    isSeed: v.optional(v.boolean()),

    // ✅ RISK layer (optionnel le temps du backfill)
    depositMin: v.optional(v.number()),
    depositMax: v.optional(v.number()),
    depositSelected: v.optional(v.number()),
  }),

  reservations: defineTable({
    vehicleId: v.id("vehicles"),
    renterUserId: v.string(),
    ownerUserId: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),
    status: v.string(),
    createdAt: v.number(),
    version: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
    depositStatus: v.optional(v.string()), // "unheld" | "held" | "released" | "failed"
    depositHoldRef: v.optional(v.string()), // futur Stripe hold id

    // ✅ caution figée sur la réservation (optionnel le temps du backfill)
    depositAmount: v.optional(v.number()),

    // ✅ paiement (préparation Stripe) — optionnel pour l’instant
    currency: v.optional(v.string()), // "MAD"
    totalAmount: v.optional(v.number()), // montant location (hors caution)
    commissionAmount: v.optional(v.number()), // commission plateforme
    paymentStatus: v.optional(v.string()), // "unpaid" | "requires_action" | "authorized" | "captured" | "failed" | ...
    stripePaymentIntentId: v.optional(v.string()), // futur
  }),

  conditionReports: defineTable({
    reservationId: v.id("reservations"),
    phase: v.union(v.literal("checkin"), v.literal("checkout")),
    role: v.union(v.literal("owner"), v.literal("renter")),

    requiredPhotos: v.record(v.string(), v.id("_storage")), // slotKey -> storageId
    detailPhotos: v.array(
      v.object({
        storageId: v.id("_storage"),
        note: v.optional(v.string()),
      })
    ),
    video360StorageId: v.optional(v.id("_storage")),

    submittedByUserId: v.string(),
    completedAt: v.number(),
  })
    .index("by_reservation_phase_role", ["reservationId", "phase", "role"])
    .index("by_reservation_phase", ["reservationId", "phase"]),

  threads: defineTable({
    reservationId: v.id("reservations"),
    renterUserId: v.string(),
    ownerUserId: v.string(),
    createdAt: v.number(),
    lastMessageAt: v.optional(v.number()),
  })
    .index("by_reservation", ["reservationId"])
    .index("by_renter", ["renterUserId"])
    .index("by_owner", ["ownerUserId"]),

  messages: defineTable({
    threadId: v.id("threads"),
    reservationId: v.id("reservations"),
    type: v.union(v.literal("system"), v.literal("user"), v.literal("actions")),
    text: v.string(),
    createdAt: v.number(),

    // ✅ anti-doublons (idempotence)
    eventKey: v.optional(v.string()),

    // ✅ actions simples (UI rendra des boutons)
    actions: v.optional(
      v.array(
        v.object({
          label: v.string(),
          route: v.string(), // ex: "/profile/reservations" ou "/reservation/[id]"
        })
      )
    ),

    // optionnel: filtrer l’affichage selon le rôle (plus tard)
    visibility: v.optional(v.union(v.literal("all"), v.literal("renter"), v.literal("owner"))),
  })
    .index("by_thread", ["threadId", "createdAt"])
    .index("by_eventKey", ["eventKey"]),

  reservationEvents: defineTable({
    reservationId: v.id("reservations"),

    // ex: "reservation_created", "payment_captured", ...
    type: v.string(),

    // qui a déclenché l'event (renter / owner / system)
    actorUserId: v.string(),

    createdAt: v.number(),

    // clé d'idempotence (empêche doublons si double clic / retry réseau)
    idempotencyKey: v.optional(v.string()),

    // payload libre (phase, role, reportId, etc.)
    payload: v.optional(v.any()),
  })
    .index("by_reservation", ["reservationId", "createdAt"])
    .index("by_idempotency", ["idempotencyKey"]),

  vehicleLockBuckets: defineTable({
    vehicleId: v.id("vehicles"),
    // map: "YYYY-MM-DD" -> reservationId
    dates: v.record(v.string(), v.id("reservations")),
    updatedAt: v.number(),
  })
    .index("by_vehicle", ["vehicleId"]),

  reservationLocks: defineTable({
    vehicleId: v.id("vehicles"),
    date: v.string(), // "YYYY-MM-DD"
    reservationId: v.id("reservations"),
    createdAt: v.number(),
  })

    .index("by_reservation", ["reservationId"])
    .index("by_vehicle_date", ["vehicleId", "date"]),


});
