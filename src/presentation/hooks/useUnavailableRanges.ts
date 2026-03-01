import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

type UnavailableRange = { startDate: string; endDate: string };

// Statuts qui bloquent le calendrier (réservation active ou en voie de l'être)
const BLOCKING_STATUSES = new Set([
  "requested",
  "accepted_pending_payment",
  "pickup_pending",
  "in_progress",
  "dropoff_pending",
  "confirmed",
]);

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Group consecutive dates into ranges for the calendar */
function groupDatesToRanges(dates: string[]): UnavailableRange[] {
  if (!dates.length) return [];
  const sorted = [...dates].sort();
  const ranges: UnavailableRange[] = [];
  let start = sorted[0];
  let prev = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const prevDate = new Date(prev + "T00:00:00Z");
    const currDate = new Date(sorted[i] + "T00:00:00Z");
    const diffDays = (currDate.getTime() - prevDate.getTime()) / 86400000;

    if (diffDays === 1) {
      prev = sorted[i]; // consecutive
    } else {
      ranges.push({ startDate: start, endDate: prev });
      start = sorted[i];
      prev = sorted[i];
    }
  }
  ranges.push({ startDate: start, endDate: prev });
  return ranges;
}

export function useUnavailableRanges(vehicleId?: string) {
  const reservations =
    vehicleId
      ? useQuery(api.reservations.getReservationsForVehicle, {
        vehicleId: vehicleId as any,
      })
      : null;

  const blockedDates = vehicleId
    ? useQuery(api.vehicles.getBlockedDates, { vehicleId: vehicleId as any })
    : null;

  const ranges: UnavailableRange[] = useMemo(() => {
    const result: UnavailableRange[] = [];
    const today = todayISO();

    // Reservation-based ranges
    if (reservations) {
      for (const r of reservations) {
        if (!BLOCKING_STATUSES.has((r as any).status)) continue;
        if (typeof (r as any).endDate === "string" && (r as any).endDate < today) continue;
        result.push({ startDate: (r as any).startDate, endDate: (r as any).endDate });
      }
    }

    // Owner-blocked dates (convert to ranges)
    if (blockedDates && Array.isArray(blockedDates)) {
      const futureBlocked = (blockedDates as string[]).filter((d) => d >= today);
      result.push(...groupDatesToRanges(futureBlocked));
    }

    return result;
  }, [reservations, blockedDates]);

  return {
    ranges,
    loading: reservations === null,
  };
}
