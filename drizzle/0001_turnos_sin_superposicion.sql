-- Dos turnos activos del mismo profesional nunca se superponen, aunque lleguen dos reservas a la vez.
-- El margen entre turnos se controla en la aplicación porque cada profesional puede cambiarlo.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_no_overlap"
  EXCLUDE USING gist (
    "professional_id" WITH =,
    tstzrange("starts_at", "ends_at", '[)') WITH &&
  ) WHERE ("status" IN ('reservado', 'confirmado', 'realizado'));
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_valid_range" CHECK ("ends_at" > "starts_at");
--> statement-breakpoint
ALTER TABLE "availability_rules" ADD CONSTRAINT "availability_rules_valid" CHECK (
  "weekday" BETWEEN 0 AND 6 AND "start_minute" >= 0 AND "end_minute" <= 1440 AND "end_minute" > "start_minute"
);
--> statement-breakpoint
ALTER TABLE "services" ADD CONSTRAINT "services_valid" CHECK ("duration_minutes" > 0 AND "price_cents" >= 0);
