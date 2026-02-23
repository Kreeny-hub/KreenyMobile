import { useEffect, useState } from "react";
import { container } from "../../shared/config/container";
import type { ReservationWithVehicle } from "../../domain/schemas/reservationItem.schema";

export function useMyReservations() {
  const [items, setItems] = useState<ReservationWithVehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await container.reservationRepository.listMyReservationsWithVehicle();
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return { items, loading, error, refresh };
}