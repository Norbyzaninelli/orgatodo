import { getSession } from "@/lib/auth";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";
import { getConnection } from "@/lib/arca/connection";

/** Descarga el pedido de certificado (CSR) para subir a ARCA. */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("No autorizado", { status: 401 });
  const [pro] = await db
    .select({ id: schema.professionals.id })
    .from(schema.professionals)
    .where(eq(schema.professionals.userId, session.user.id));
  const connection = pro ? await getConnection(pro.id) : null;
  if (!connection) return new Response("Primero cargá tu CUIT y punto de venta", { status: 404 });
  return new Response(connection.csrPem, {
    headers: {
      "Content-Type": "application/pkcs10",
      "Content-Disposition": `attachment; filename="orgatodo-${connection.cuit}.csr"`,
      "Cache-Control": "no-store",
    },
  });
}
