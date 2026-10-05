ALTER TABLE "organizations" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "province" text;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "professionals" ADD COLUMN "province" text;--> statement-breakpoint
-- El buscador compara sin acentos: "kinesiologia" encuentra "Kinesiología".
CREATE EXTENSION IF NOT EXISTS unaccent;
