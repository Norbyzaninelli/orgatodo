CREATE TYPE "public"."notification_channel" AS ENUM('email', 'whatsapp');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('reserva_recibida', 'turno_confirmado', 'nuevo_turno', 'recordatorio', 'cancelado_por_cliente', 'cancelado_por_profesional');--> statement-breakpoint
CREATE TYPE "public"."notification_recipient" AS ENUM('cliente', 'profesional');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pendiente', 'enviado', 'fallido', 'omitido');--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"recipient" "notification_recipient" NOT NULL,
	"address" text NOT NULL,
	"scheduled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "notification_status" DEFAULT 'pendiente' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "notify_by_whatsapp" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "notify_by_email" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "reminder_hours_before" integer DEFAULT 24 NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_bookings_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."bookings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_once_idx" ON "notifications" USING btree ("booking_id","kind","channel","recipient");--> statement-breakpoint
CREATE INDEX "notifications_due_idx" ON "notifications" USING btree ("status","scheduled_at");