import * as SecureStore from "expo-secure-store";

const KEY = "kreeny_recently_viewed";
const MAX_ITEMS = 15;

/**
 * Get list of recently viewed vehicle IDs (most recent first).
 */
export async function getRecentlyViewed(): Promise<string[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/**
 * Track a vehicle view. Moves it to the front if already present.
 */
export async function trackView(vehicleId: string): Promise<void> {
  try {
    const list = await getRecentlyViewed();
    const filtered = list.filter((id) => id !== vehicleId);
    filtered.unshift(vehicleId);
    await SecureStore.setItemAsync(KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
  } catch {
    // Silently fail
  }
}
