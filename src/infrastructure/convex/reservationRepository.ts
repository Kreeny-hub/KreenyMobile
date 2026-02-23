import type { ConvexReactClient } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { ReservationRepository } from "../../domain/repositories/ReservationRepository";
import { ReservationCreateSchema } from "../../domain/schemas/reservation.schema";
import { ReservationWithVehicleSchema, type ReservationWithVehicle } from "../../domain/schemas/reservationItem.schema";

export function createReservationRepository(
  convex: ConvexReactClient
): ReservationRepository {
  return {
    async createReservation(input) {
      const parsed = ReservationCreateSchema.parse(input);

      const res = await convex.mutation(api.reservations.createReservation, {
        vehicleId: parsed.vehicleId as any,
        startDate: parsed.startDate,
        endDate: parsed.endDate,
      });

      return { reservationId: String((res as any).reservationId) };
    },

    async listMyReservationsWithVehicle(): Promise<ReservationWithVehicle[]> {
      const rows = await convex.query(api.reservations.listMyReservationsWithVehicle, {});
      return rows.map((r: any) =>
        ReservationWithVehicleSchema.parse({
          reservation: {
            _id: String(r.reservation?._id),
            vehicleId: String(r.reservation?.vehicleId),
            renterUserId: String(r.reservation?.renterUserId),
            startDate: r.reservation?.startDate,
            endDate: r.reservation?.endDate,
            status: r.reservation?.status,
            createdAt: r.reservation?.createdAt,
          },
          vehicle: r.vehicle
            ? {
              _id: String(r.vehicle._id),
              title: r.vehicle.title,
              city: r.vehicle.city,
              pricePerDay: r.vehicle.pricePerDay,
            }
            : null,
        })
      );
    },
  };
}
