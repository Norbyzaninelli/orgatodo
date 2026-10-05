import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db, schema } from "@/db";
import { textToHtml } from "@/lib/notifications/messages";
import { appUrl } from "@/lib/notifications/process";
import { sendEmail } from "@/lib/notifications/providers";

function createAuth() {
  return betterAuth({
    appName: "ORGATODO",
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
      resetPasswordTokenExpiresIn: 60 * 60,
      // Al cambiar la contraseña se cierran las sesiones abiertas en otros dispositivos.
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, token }) => {
        // El link va a nuestra página, que pide la contraseña nueva; el de Better Auth no se usa.
        const url = `${appUrl()}/restablecer?token=${encodeURIComponent(token)}`;
        const text = [
          `Hola ${user.name}, pediste cambiar tu contraseña de ORGATODO.`,
          `Elegí una nueva desde este link, que vence en 1 hora: ${url}`,
          "Si no lo pediste, ignorá este mensaje: tu contraseña sigue igual.",
        ].join("\n\n");
        await sendEmail({ to: user.email, subject: "Cambiar tu contraseña de ORGATODO", text, html: textToHtml(text) });
      },
    },
    session: { expiresIn: 60 * 60 * 24 * 30 },
    // nextCookies guarda la cookie de sesión cuando se llama a la API desde acciones del servidor.
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;
const globalForAuth = globalThis as unknown as { orgatodoAuth?: Auth };

/** Se crea en el primer uso, así el build no necesita el secreto ni la base de datos. */
export function getAuth(): Auth {
  globalForAuth.orgatodoAuth ??= createAuth();
  return globalForAuth.orgatodoAuth;
}

export const getSession = cache(async () => getAuth().api.getSession({ headers: await headers() }));

/** Profesional del usuario que inició sesión. Si no hay sesión, manda a ingresar. */
export const requireProfessional = cache(async () => {
  const session = await getSession();
  if (!session) redirect("/ingresar");
  const professional = await db.query.professionals.findFirst({
    where: eq(schema.professionals.userId, session.user.id),
  });
  if (!professional) redirect("/registro");
  return professional;
});
