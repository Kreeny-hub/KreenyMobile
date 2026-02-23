import { ConvexError } from "convex/values";

function canUseDevMutations() {
  if (process.env.ENABLE_DEV_ACTIONS === "true") return true;
  const deployment = process.env.CONVEX_DEPLOYMENT ?? "";
  return deployment.startsWith("dev:");
}

export function assertDevMutationEnabled() {
  if (!canUseDevMutations()) {
    throw new ConvexError("DevMutationDisabled");
  }
}

