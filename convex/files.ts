import { mutation } from "./_generated/server";
import { ConvexError } from "convex/values";
import { authComponent } from "./auth";

export const generateUploadUrl = mutation(async (ctx) => {
  const user = await authComponent.getAuthUser(ctx);
  if (!user) throw new ConvexError("Unauthenticated");

  return await ctx.storage.generateUploadUrl();
});
