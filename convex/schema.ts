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

  depositMin: v.optional(v.number()),
  depositMax: v.optional(v.number()),
  depositSelected: v.optional(v.number()),
})
  .index("by_city_createdAt", ["city", "createdAt"])
  .index("by_ownerUserId", ["ownerUserId"]),

  reservations: defineTable({
    vehicleId: v.id("vehicles"),
    renterUserId: v.string(),
    ownerUserId: v.optional(v.string()),
    startDate: v.string(),
    endDate: v.string(),

    status: v.union(
      v.literal("requested"),
      v.literal("accepted_pending_payment"),
      v.literal("pickup_pending"),
      v.literal("in_progress"),
      v.literal("dropoff_pending"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("rejected")
    ),

    createdAt: v.number(),
    version: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),

    depositStatus: v.optional(
      v.union(
        v.literal("unheld"),
        v.literal("held"),
        v.literal("released"),
        v.literal("failed")
      )
    ),
    depositHoldRef: v.optional(v.string()),
    depositAmount: v.optional(v.number()),

    currency: v.optional(v.string()),
    totalAmount: v.optional(v.number()),
    commissionAmount: v.optional(v.number()),

    paymentStatus: v.optional(
      v.union(
        v.literal("unpaid"),
        v.literal("requires_action"),
        v.literal("processing"),
        v.literal("captured"),
        v.literal("failed"),
        v.literal("cancelled")
      )
    ),

    stripePaymentIntentId: v.optional(v.string()),
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_renter", ["renterUserId"])
    .index("by_owner", ["ownerUserId"])
    .index("by_status", ["status"])
    .index("by_renter_status_createdAt", ["renterUserId", "status", "createdAt"])
    .index("by_owner_status_createdAt", ["ownerUserId", "status", "createdAt"]),

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

    userFiles: defineTable({
  userId: v.string(), // identifiant user (comme tu utilises dans le reste)
  kind: v.union(
    v.literal("avatar"),
    v.literal("condition_required_photo"),
    v.literal("condition_detail_photo"),
    v.literal("condition_video360")
  ),
  storageId: v.id("_storage"),
  mimeType: v.string(),
  byteSize: v.number(),
  createdAt: v.number(),

  // optionnel mais utile pour ownership / organisation
  reservationId: v.optional(v.id("reservations")),
  reportId: v.optional(v.id("conditionReports")),
})
  .index("by_user", ["userId", "createdAt"])
  .index("by_user_kind", ["userId", "kind", "createdAt"])
  .index("by_reservation", ["reservationId", "createdAt"]),


});
