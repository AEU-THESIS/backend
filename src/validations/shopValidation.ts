import { z } from "zod";

export const createShopSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z
    .string()
    .min(1, "Slug is required")
    .regex(
      /^[a-z0-9-]+$/,
      "Slug must be lowercase alphanumeric and dashes only",
    ),
  ownerName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  currencySymbol: z.string().default("$"),
});

export type CreateShopInput = z.infer<typeof createShopSchema>;
