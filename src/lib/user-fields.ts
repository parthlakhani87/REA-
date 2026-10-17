import { z } from "zod";
import { DEPARTMENTS, ROLES } from "@/db/schema";

export const userFields = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(30).optional().nullable(),
  role: z.enum(ROLES),
  cityId: z.number().int().nullable().optional(),
  department: z.enum(DEPARTMENTS).nullable().optional(),
  canApprove: z.boolean().optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
  channelIds: z.array(z.number().int()).optional(),
});
