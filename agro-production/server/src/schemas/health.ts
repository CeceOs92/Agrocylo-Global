import { z } from "zod";

export const HealthResponseSchema = z.object({
  status: z.literal("UP"),
  service: z.string(),
  env: z.string(),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
