import type { ReservationCreate } from "../schemas/reservation.schema";
import type { ReservationWithVehicle } from "../schemas/reservationItem.schema";

export interface ReservationRepository {
  createReservation(input: ReservationCreate): Promise<{ reservationId: string }>;
  listMyReservationsWithVehicle(): Promise<ReservationWithVehicle[]>;
}