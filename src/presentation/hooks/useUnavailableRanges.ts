import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

type UnavailableRange = { startDate: string; endDate: string };

// Statuts qui bloquent le calendrier (réservation active ou en voie de l’être)
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

export function useUnavailableRanges(vehicleId?: string) {
  const reservations =
    vehicleId
      ? useQuery(api.reservations.getReservationsForVehicle, {
        vehicleId: vehicleId as any,
      })
      : null;

  const ranges: UnavailableRange[] = useMemo(() => {
    if (!reservations) return [];

    const today = todayISO();

    return reservations
      .filter((r: any) => {
        // ignore les statuts non bloquants
        if (!BLOCKING_STATUSES.has(r.status)) return false;

        // ignore celles déjà finies dans le passé
        if (typeof r.endDate === "string" && r.endDate < today) return false;

        return true;
      })
      .map((r: any) => ({
        startDate: r.startDate,
        endDate: r.endDate,
      }));
  }, [reservations]);

  return {
    ranges,
    loading: reservations === null, // null = pas encore chargé
  };
}