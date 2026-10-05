import { processDueNotifications } from "@/lib/notifications/process";

/**
 * Manda los avisos vencidos, incluidos los recordatorios programados.
 * Hay que llamarlo cada pocos minutos desde un cron con el header Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }
  return Response.json(await processDueNotifications(200));
}
