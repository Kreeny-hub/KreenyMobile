import { z } from "zod";

export const ReservationSchema = z.object({
  _id: z.string(),
  vehicleId: z.string(),
  renterUserId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  status: z.string(),
  createdAt: z.number(),
});

export const VehicleLiteSchema = z
  .object({
    _id: z.string(),
    title: z.string(),
    city: z.string(),
    pricePerDay: z.number(),
  })
  .nullable();

export const ReservationWithVehicleSchema = z.object({
  reservation: ReservationSchema,
  vehicle: VehicleLiteSchema,
});

export type ReservationWithVehicle = z.infer<typeof ReservationWithVehicleSchema>;