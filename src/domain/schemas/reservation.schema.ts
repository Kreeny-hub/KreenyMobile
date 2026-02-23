import { z } from "zod";

export const ReservationCreateSchema = z.object({
  vehicleId: z.string(),
  startDate: z.string(),
  endDate: z.string(),
});

export type ReservationCreate = z.infer<typeof ReservationCreateSchema>;
