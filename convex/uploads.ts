import { ConvexError, v } from "convex/values";
import { mutation } from "./_generated/server";
import { authComponent } from "./auth";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2MB
const MAX_REPORT_BYTES = 15 * 1024 * 1024; // 15MB

const AVATAR_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);
const REPORT_MIMES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export const generateSensitiveUploadUrl = mutation({
  args: {
    kind: v.union(
      v.literal("avatar"),
      v.literal("condition_required_photo"),
      v.literal("condition_detail_photo"),
      v.literal("condition_video360")
    ),
    mimeType: v.string(),
    byteSize: v.number(),
    reservationId: v.optional(v.id("reservations")),
    reportId: v.optional(v.id("conditionReports")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = String(user.userId ?? user.email ?? user._id);

    // règles taille + type
    if (args.kind === "avatar") {
      if (args.byteSize > MAX_AVATAR_BYTES) {
        return { ok: false as const, code: "FILE_TOO_LARGE" as const };
      }
      if (!AVATAR_MIMES.has(args.mimeType)) {
        return { ok: false as const, code: "BAD_MIME" as const };
      }
    } else {
      if (args.byteSize > MAX_REPORT_BYTES) {
        return { ok: false as const, code: "FILE_TOO_LARGE" as const };
      }
      if (!REPORT_MIMES.has(args.mimeType)) {
        return { ok: false as const, code: "BAD_MIME" as const };
      }

      // option sécurité minimale: pour constats, on exige reservationId
      if (!args.reservationId) {
        return { ok: false as const, code: "MISSING_RESERVATION" as const };
      }

      // ✅ Ownership check : vérifier que l'utilisateur est owner ou renter
      const reservation = await ctx.db.get(args.reservationId);
      if (!reservation) {
        return { ok: false as const, code: "RESERVATION_NOT_FOUND" as const };
      }
      if (reservation.renterUserId !== me && reservation.ownerUserId !== me) {
        return { ok: false as const, code: "FORBIDDEN" as const };
      }
    }

    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { ok: true as const, uploadUrl };
  },
});

export const finalizeSensitiveUpload = mutation({
  args: {
    kind: v.union(
      v.literal("avatar"),
      v.literal("condition_required_photo"),
      v.literal("condition_detail_photo"),
      v.literal("condition_video360")
    ),
    storageId: v.id("_storage"),
    mimeType: v.string(),
    byteSize: v.number(),
    reservationId: v.optional(v.id("reservations")),
    reportId: v.optional(v.id("conditionReports")),
  },
  handler: async (ctx, args) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");
    const me = String(user.userId ?? user.email ?? user._id);

    const now = Date.now();

    // Enregistre un “registre” des fichiers sensibles
    const fileId = await ctx.db.insert("userFiles", {
      userId: me,
      kind: args.kind,
      storageId: args.storageId,
      mimeType: args.mimeType,
      byteSize: args.byteSize,
      createdAt: now,
      reservationId: args.reservationId,
      reportId: args.reportId,
    });

    return { ok: true as const, fileId };
  },
});