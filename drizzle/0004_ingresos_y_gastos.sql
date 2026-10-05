CREATE TYPE "public"."expense_category" AS ENUM('alquiler', 'insumos', 'monotributo', 'otros');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('efectivo', 'transferencia', 'mercado_pago', 'tarjeta', 'otro');--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"date" date NOT NULL,
	"category" "expense_category" NOT NULL,
	"description" text,
	"amount_cents" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "payment_method" "payment_method";--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "income_cap_cents" bigint;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_professional_date_idx" ON "expenses" USING btree ("professional_id","date");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_amount_positive" CHECK ("amount_cents" > 0);
