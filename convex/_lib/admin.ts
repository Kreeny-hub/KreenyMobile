import { ConvexError } from "convex/values";

// ── Admin user ID — CONFIGURE THIS before launch ──
// Go to Convex dashboard → userProfiles table → find your row → copy userId
// Paste it here to receive push notifications for every report
export const ADMIN_USER_ID = "k577z6y2e2m0zw6706pv12by9n81kf2d";
// Example: export const ADMIN_USER_ID = "jh7abc123def456ghi789";

export function assertAdmin(userId: string) {
  if (!ADMIN_USER_ID || userId !== ADMIN_USER_ID) {
    throw new ConvexError("Forbidden");
  }
}
