import { query } from "../_generated/server";

export default query({
  args: {},
  handler: async (ctx) => {
    const reservations = await ctx.db.query("reservations").collect();

    const statuses = new Set<string>();
    const paymentStatuses = new Set<string>();
    const depositStatuses = new Set<string>();

    for (const r of reservations) {
      if (r.status) statuses.add(r.status);
      if (r.paymentStatus) paymentStatuses.add(r.paymentStatus);
      if (r.depositStatus) depositStatuses.add(r.depositStatus);
    }

    return {
      status: Array.from(statuses),
      paymentStatus: Array.from(paymentStatuses),
      depositStatus: Array.from(depositStatuses),
      count: reservations.length,
    };
  },
});