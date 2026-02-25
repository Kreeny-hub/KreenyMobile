import { ConvexError, v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { authComponent } from "./auth";

// ✅ FIX: Auth obligatoire — plus de mutation ouverte à tous
export const generateUploadUrl = mutation(async (ctx) => {
  const user = await authComponent.getAuthUser(ctx);
  if (!user) throw new ConvexError("Unauthenticated");

  return await ctx.storage.generateUploadUrl();
});

/** Résout un storageId en URL publique. Utilisé côté client pour les avatars etc. */
export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});
