import { ConvexError } from "convex/values";
import { mutation } from "../_generated/server";
import { authComponent } from "../auth";

export default mutation({
  args: {},
  handler: async (ctx) => {
    const user = await authComponent.getAuthUser(ctx);
    if (!user) throw new ConvexError("Unauthenticated");

    const newId = String(user._id);

    // cherche un profile existant avec l’ancienne clé email
    const oldId = String(user.email ?? "");
    if (!oldId) return { ok: true, migrated: false };

    const oldProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", oldId))
      .first();

    if (!oldProfile) return { ok: true, migrated: false };

    // s’il existe déjà un profile avec newId, on ne fusionne pas ici
    const newProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_user", (q) => q.eq("userId", newId))
      .first();

    if (newProfile) {
      return { ok: true, migrated: false, reason: "new_profile_already_exists" as const };
    }

    await ctx.db.patch(oldProfile._id, { userId: newId });
    return { ok: true, migrated: true };
  },
});