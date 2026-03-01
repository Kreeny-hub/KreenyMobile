import * as SecureStore from "expo-secure-store";

const KEY = "kreeny_recent_searches";
const MAX_ITEMS = 8;

export type RecentSearch = {
  city?: string;
  startDate?: string;
  endDate?: string;
  timestamp: number;
};

export async function getRecentSearches(): Promise<RecentSearch[]> {
  try {
    const raw = await SecureStore.getItemAsync(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentSearch[];
  } catch {
    return [];
  }
}

export async function saveRecentSearch(search: Omit<RecentSearch, "timestamp">): Promise<void> {
  try {
    // Don't save empty searches
    if (!search.city && !search.startDate) return;

    const list = await getRecentSearches();
    // Remove duplicates (same city + dates)
    const filtered = list.filter(
      (s) => !(s.city === search.city && s.startDate === search.startDate && s.endDate === search.endDate)
    );
    filtered.unshift({ ...search, timestamp: Date.now() });
    await SecureStore.setItemAsync(KEY, JSON.stringify(filtered.slice(0, MAX_ITEMS)));
  } catch {
    // Silently fail
  }
}

export async function clearRecentSearches(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(KEY);
  } catch {}
}
