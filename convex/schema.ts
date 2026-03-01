import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  vehicles: defineTable({
    title: v.string(),
    pricePerDay: v.number(),
    city: v.string(),
    imageUrls: v.array(v.string()),

    // false = annonce désactivée (invisible dans les recherches)
    isActive: v.optional(v.boolean()),
    ownerId: v.optional(v.id("users")), // DEPRECATED: jamais utilisé, garder pour compat données existantes
    ownerUserId: v.optional(v.string()),
    createdAt: v.number(),
    isSeed: v.optional(v.boolean()),

    depositMin: v.optional(v.number()),
    depositMax: v.optional(v.number()),
    depositSelected: v.optional(v.number()),

    // ── Politique d'annulation ──
    cancellationPolicy: v.optional(v.string()), // "flexible" | "moderate" | "strict"

    // ── Identité véhicule ──
    brand: v.optional(v.string()),
    model: v.optional(v.string()),
    year: v.optional(v.number()),

    // ── Caractéristiques ──
    transmission: v.optional(v.string()), // "auto" | "manual"
    fuel: v.optional(v.string()),         // "essence" | "diesel" | "hybrid" | "electric"
    seats: v.optional(v.number()),
    description: v.optional(v.string()),

    // ── Features (arrays of feature keys) ──
    featuresSafety: v.optional(v.array(v.string())),
    featuresConnect: v.optional(v.array(v.string())),
    featuresAmenities: v.optional(v.array(v.string())),

    // ── Livraison ──
    delivery: v.optional(v.boolean()),
    deliveryRadiusKm: v.optional(v.number()),
    deliveryPrice: v.optional(v.number()),

    // ── Disponibilité ──
    availableFrom: v.optional(v.string()),  // ISO date
    availableUntil: v.optional(v.string()), // ISO date or null
    ownerBlockedDates: v.optional(v.array(v.string())), // ["2026-03-10", "2026-03-11", ...]
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
      v.literal("confirmed"),
      v.literal("pickup_pending"),
      v.literal("in_progress"),
      v.literal("dropoff_pending"),
      v.literal("completed"),
      v.literal("cancelled"),
      v.literal("rejected"),
      v.literal("disputed")
    ),

    createdAt: v.number(),
    version: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),

    depositStatus: v.optional(
      v.union(
        v.literal("unheld"),
        v.literal("held"),
        v.literal("released"),
        v.literal("partially_retained"),
        v.literal("retained"),
        v.literal("failed")
      )
    ),
    depositHoldRef: v.optional(v.string()),
    depositAmount: v.optional(v.number()),

    currency: v.optional(v.string()),
    totalAmount: v.optional(v.number()),
    commissionAmount: v.optional(v.number()),
    ownerPayout: v.optional(v.number()),

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

    // ── Annulation ──
    cancelledAt: v.optional(v.number()),
    cancelledBy: v.optional(v.string()),        // "renter" | "owner" | "system"
    cancellationPolicy: v.optional(v.string()),  // snapshot de la politique au moment de l'annulation
    refundPercent: v.optional(v.number()),        // 0, 0.5, 1
    refundAmount: v.optional(v.number()),         // montant remboursé en MAD
    penaltyAmount: v.optional(v.number()),        // montant retenu en MAD
    cancellationReason: v.optional(v.string()),   // raison humaine
  })
    .index("by_vehicle", ["vehicleId"])
    .index("by_renter", ["renterUserId"])
    .index("by_owner", ["ownerUserId"])
    .index("by_status", ["status"])
    .index("by_renter_status_createdAt", ["renterUserId", "status", "createdAt"])
    .index("by_owner_status_createdAt", ["ownerUserId", "status", "createdAt"])
    .index("by_vehicle_renter", ["vehicleId", "renterUserId"]),

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
    lastMessageText: v.optional(v.string()),
    lastMessageSenderId: v.optional(v.string()),
    // Unread tracking
    renterLastReadAt: v.optional(v.number()),
    ownerLastReadAt: v.optional(v.number()),
    // Archive per role
    archivedByRenter: v.optional(v.boolean()),
    archivedByOwner: v.optional(v.boolean()),
  })
    .index("by_reservation", ["reservationId"])
    .index("by_renter", ["renterUserId"])
    .index("by_owner", ["ownerUserId"]),

  messages: defineTable({
    threadId: v.id("threads"),
    reservationId: v.id("reservations"),
    type: v.union(v.literal("system"), v.literal("user"), v.literal("actions"), v.literal("welcome")),
    text: v.string(),
    createdAt: v.number(),

    // ✅ anti-doublons (idempotence)
    eventKey: v.optional(v.string()),

    // ✅ texte simplifié après archivage (quand l'étape est passée)
    archivedText: v.optional(v.string()),

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
    // ✅ Qui a envoyé le message (pour les messages de type "user")
    senderUserId: v.optional(v.string()),

    // ✅ Image jointe (storageId Convex)
    imageStorageId: v.optional(v.id("_storage")),

    // ✅ Réactions emoji
    reactions: v.optional(
      v.array(v.object({ emoji: v.string(), userId: v.string() }))
    ),

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

  userProfiles: defineTable({
    userId: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),

    // Avatar (Convex Storage)
    avatarStorageId: v.optional(v.id("_storage")),

    displayName: v.optional(v.string()),
    phone: v.optional(v.string()),
    nameChangedAt: v.optional(v.number()),  // timestamp du dernier changement de nom
    kycStatus: v.optional(v.string()),       // "none" | "pending" | "verified" | "rejected"
    kycRejectionReason: v.optional(v.string()), // motif de refus (affiché à l'utilisateur)

    // ✅ Stripe
    stripeCustomerId: v.optional(v.string()),       // ID Stripe du client (locataire)
    stripeConnectAccountId: v.optional(v.string()),  // ID Stripe Connect (loueur, pour les payouts)
    stripeConnectOnboarded: v.optional(v.boolean()), // onboarding Stripe Connect terminé ?

    // ✅ Push notifications
    expoPushToken: v.optional(v.string()),           // Expo push token (ExponentPushToken[xxx])
  })
    .index("by_user", ["userId"])
    .index("by_stripeCustomer", ["stripeCustomerId"]),


  reviews: defineTable({
    reservationId: v.id("reservations"),
    vehicleId: v.id("vehicles"),
    authorUserId: v.string(),
    targetUserId: v.string(),
    role: v.union(v.literal("renter"), v.literal("owner")),

    // Multi-criteria ratings (1-5 each)
    ratings: v.object({
      communication: v.number(),
      punctuality: v.number(),
      cleanliness: v.number(),
      conformity: v.optional(v.number()),  // renter only: véhicule conforme à l'annonce
      vehicleCare: v.optional(v.number()), // owner only: soin apporté au véhicule
    }),
    averageRating: v.number(), // computed average

    comment: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_vehicle", ["vehicleId", "createdAt"])
    .index("by_targetUser", ["targetUserId", "createdAt"])
    .index("by_author", ["authorUserId", "createdAt"])
    .index("by_reservation_author", ["reservationId", "authorUserId"]),

  favorites: defineTable({
    userId: v.string(),
    vehicleId: v.id("vehicles"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId", "createdAt"])
    .index("by_user_vehicle", ["userId", "vehicleId"]),

  // ── Reports / Signalements ──
  // ── Disputes / Litiges ──
  disputes: defineTable({
    reservationId: v.id("reservations"),
    vehicleId: v.id("vehicles"),
    openedByUserId: v.string(),
    openedByRole: v.string(),               // "owner" | "renter"
    reason: v.string(),                      // "damage" | "dirty" | "missing_part" | "km_exceeded" | "mechanical" | "other"
    description: v.string(),
    photoStorageIds: v.optional(v.array(v.id("_storage"))),
    status: v.string(),                      // "open" | "resolved_no_penalty" | "resolved_partial" | "resolved_full"
    adminNote: v.optional(v.string()),
    retainedAmount: v.optional(v.number()),  // montant retenu sur la caution
    resolvedAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_reservation", ["reservationId"])
    .index("by_status", ["status"]),

  // ── Reports / Signalements ──
  kycDocuments: defineTable({
    userId: v.string(),
    docType: v.union(v.literal("cin"), v.literal("permis")),
    side: v.union(v.literal("recto"), v.literal("verso")),
    storageId: v.id("_storage"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_doc", ["userId", "docType", "side"]),

  reports: defineTable({
    reporterUserId: v.string(),
    targetType: v.string(),        // "vehicle" | "user" | "reservation" | "message"
    targetId: v.string(),           // vehicle._id, userId, reservation._id, or message._id
    reason: v.string(),             // "inappropriate" | "fraud" | "dangerous" | "fake" | "other"
    comment: v.optional(v.string()),
    messageText: v.optional(v.string()),  // contenu du message signalé (pour admin)
    status: v.string(),             // "pending" | "reviewed" | "dismissed"
    createdAt: v.number(),
  })
    .index("by_reporter", ["reporterUserId"])
    .index("by_target", ["targetType", "targetId"])
    .index("by_status", ["status"]),
});
