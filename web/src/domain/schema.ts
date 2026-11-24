import { z } from 'zod';

export const recordSchema = z.object({
  id: z.number().int().positive(),
  content: z.string().max(20_000),
  digest: z
    .string()
    .regex(/^[0-9a-f]{16}$/, 'A stored digest must be 16 lowercase hexadecimal characters.'),
});

export const pendingRequestSchema = z.object({
  id: z.number().int().positive(),
  content: z.string().max(20_000),
});

export const dashboardStateSchema = z.object({
  records: z.array(recordSchema),
  pending: z.array(pendingRequestSchema),
  nextId: z.number().int().positive(),
  updatedAt: z.number().optional(),
  seeded: z.boolean().optional(),
});

export type DashboardStateInput = z.infer<typeof dashboardStateSchema>;
