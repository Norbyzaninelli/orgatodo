CREATE TYPE "public"."arca_environment" AS ENUM('simulado', 'homologacion', 'produccion');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('emitiendo', 'emitida', 'rechazada', 'anulada');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('factura_c', 'nota_credito_c');--> statement-breakpoint
CREATE TABLE "arca_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"environment" "arca_environment" NOT NULL,
	"cuit" text NOT NULL,
	"point_of_sale" integer NOT NULL,
	"private_key_encrypted" text NOT NULL,
	"csr_pem" text NOT NULL,
	"certificate_pem" text,
	"certificate_expires_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"last_error" text,
	"legal_name" text,
	"fiscal_address" text,
	"monotributo_category" text,
	"monotributo_category_description" text,
	"category_checked_at" timestamp with time zone,
	"gross_income_number" text,
	"activity_start_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "arca_connections_professional_id_unique" UNIQUE("professional_id")
);
--> statement-breakpoint
CREATE TABLE "arca_tickets" (
	"connection_id" uuid NOT NULL,
	"service" text NOT NULL,
	"token" text NOT NULL,
	"sign" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "arca_tickets_connection_id_service_pk" PRIMARY KEY("connection_id","service")
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"professional_id" uuid NOT NULL,
	"booking_id" uuid,
	"credits_invoice_id" uuid,
	"environment" "arca_environment" NOT NULL,
	"type" "invoice_type" NOT NULL,
	"status" "invoice_status" DEFAULT 'emitiendo' NOT NULL,
	"cuit" text NOT NULL,
	"point_of_sale" integer NOT NULL,
	"number" integer,
	"issue_date" date NOT NULL,
	"service_from" date NOT NULL,
	"service_to" date NOT NULL,
	"payment_due_date" date NOT NULL,
	"description" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"recipient_doc_type" smallint NOT NULL,
	"recipient_doc_number" text NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_email" text,
	"recipient_vat_condition" smallint NOT NULL,
	"cae" text,
	"cae_expires_at" date,
	"arca_messages" text,
	"arca_log" jsonb,
	"public_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_public_token_unique" UNIQUE("public_token")
);
--> statement-breakpoint
ALTER TABLE "arca_connections" ADD CONSTRAINT "arca_connections_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arca_tickets" ADD CONSTRAINT "arca_tickets_connection_id_arca_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."arca_connections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_professional_id_professionals_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."professionals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_professional_date_idx" ON "invoices" USING btree ("professional_id","issue_date");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_number_idx" ON "invoices" USING btree ("environment","cuit","point_of_sale","type","number") WHERE "invoices"."number" is not null and "invoices"."status" <> 'rechazada';--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_booking_live_idx" ON "invoices" USING btree ("booking_id") WHERE "invoices"."type" = 'factura_c' and "invoices"."status" in ('emitiendo', 'emitida');--> statement-breakpoint
ALTER TABLE "professionals" DROP COLUMN "income_cap_cents";