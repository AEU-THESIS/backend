import { z } from "zod";

export const createUserSchema = z.object({
  shopId: z.number().int().positive("Shop ID is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email format"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
