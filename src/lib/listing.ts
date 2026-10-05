import { z } from "zod";
import { isProvincia, isRubro } from "./rubros";

/** Campos de rubro y zona de los formularios; vacío = sin dato. */
export const listingSchema = z.object({
  category: z
    .string()
    .optional()
    .transform((v) => (isRubro(v) ? v : null)),
  city: z
    .string()
    .trim()
    .max(80)
    .optional()
    .transform((v) => v || null),
  province: z
    .string()
    .optional()
    .transform((v) => (isProvincia(v) ? v : null)),
});
