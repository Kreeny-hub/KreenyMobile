export const CHAT_ACTIONS = [
  "PAY_NOW",
  "ACCEPT",
  "REJECT",
  "TRIGGER_RETURN",
  "OWNER_CANCEL",
  "DEV_MARK_PAID",
  "DEV_DROPOFF_PENDING",
] as const;

export type ChatAction = (typeof CHAT_ACTIONS)[number];

export const DEV_CHAT_ACTIONS = new Set<ChatAction>([
  "DEV_MARK_PAID",
  "DEV_DROPOFF_PENDING",
]);
