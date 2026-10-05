# Cómo publicar ORGATODO

El sitio queda en **Vercel** (la web) con la base de datos en **Neon** (PostgreSQL), los dos en
São Paulo para que ande rápido desde Argentina. Los recordatorios los dispara un proceso
automático de GitHub cada 15 minutos. Todo se hace desde el navegador; no hace falta instalar nada.

Las cuentas se crean a nombre de quien sea dueño del proyecto. Ninguna clave de esta guía se
comparte por chat: se cargan directo en Vercel o en GitHub.

## 1. Vercel (la web)

1. Entrá a <https://vercel.com/signup> y elegí **Continue with GitHub** con la cuenta dueña del
   repositorio `orgatodo`.
2. **Add New → Project**, elegí `orgatodo` e importalo. Vercel reconoce Next.js solo.
   Todavía no toques **Deploy**: primero va la base de datos.

## 2. Neon (la base de datos)

1. En el proyecto de Vercel, pestaña **Storage → Create Database → Neon**.
2. Región **São Paulo (sa-east-1)**, plan gratuito para empezar.
3. Conectala al proyecto `orgatodo` en los tres entornos. Vercel agrega solo `DATABASE_URL` y
   `DATABASE_URL_UNPOOLED`.

Las tablas se crean solas en cada publicación (`pnpm db:migrate` corre antes de compilar).

## 3. Variables de entorno

En Vercel, **Settings → Environment Variables**, cargá estas para Production (y Preview si
querés probar ramas):

| Variable | Valor |
| --- | --- |
| `BETTER_AUTH_SECRET` | 64 caracteres al azar (ver abajo) |
| `BETTER_AUTH_URL` | la dirección del sitio, por ejemplo `https://orgatodo.vercel.app` |
| `APP_URL` | la misma dirección |
| `CRON_SECRET` | otros 64 caracteres al azar |
| `ARCA_MODO` | `simulado` hasta que probemos con ARCA |
| `ARCA_CLAVE_CIFRADO` | otros 64 caracteres al azar. **No cambiarla nunca** después: cifra las claves de los certificados |

Para generar cada valor al azar podés abrir <https://generate-secret.vercel.app/32> (cada vez que
recargás da uno nuevo) o, en una terminal, `openssl rand -hex 32`. Usá uno distinto para cada
variable.

Después: **Deployments → Redeploy** (o el botón **Deploy** si todavía no se publicó).

## 4. Primer ingreso

1. Abrí la dirección del sitio y creá tu cuenta en **Crear mi cuenta**.
2. Probá reservar un turno desde tu página pública en el celular y en la computadora.
3. En el celular podés instalarla como app: en Chrome, menú ⋮ → **Instalar app**; en iPhone,
   Safari → Compartir → **Agregar a inicio**.

## 5. Recordatorios automáticos

En GitHub, repositorio `orgatodo` → **Settings → Secrets and variables → Actions → New repository
secret**, cargá:

- `APP_URL`: la dirección del sitio.
- `CRON_SECRET`: el mismo valor que pusiste en Vercel.

Desde ese momento el workflow "Avisos programados" manda los recordatorios cada 15 minutos.

## 6. Email (Resend)

Sin esto el sitio funciona igual, pero los emails solo quedan en el log.

1. Cuenta en <https://resend.com> (gratis hasta 3.000 emails por mes).
2. Hace falta un dominio propio (por ejemplo `orgatodo.com.ar`) para verificarlo en **Domains**:
   Resend te da unos registros DNS para cargar donde compraste el dominio.
3. Creá una API key y cargá en Vercel `RESEND_API_KEY` y `EMAIL_FROM`
   (por ejemplo `ORGATODO <avisos@orgatodo.com.ar>`). Redeploy.

## 7. WhatsApp (más adelante)

Necesita una cuenta de Meta Business verificada, un número de teléfono dedicado y aprobar las
plantillas de `docs/plantillas-whatsapp.md`. Meta cobra por conversación. Cuando esté, se cargan
`WHATSAPP_TOKEN` y `WHATSAPP_PHONE_NUMBER_ID`.

## 8. Dominio propio

Vercel → **Settings → Domains → Add**, con el dominio comprado (en NIC Argentina para `.com.ar`).
Al cambiar de dirección, actualizá `BETTER_AUTH_URL`, `APP_URL` y el secreto `APP_URL` de GitHub.

## Costos para arrancar

- Vercel: el plan gratuito sirve para probar, pero sus condiciones no permiten uso comercial;
  al cobrar planes corresponde Vercel Pro (USD 20 por mes).
- Neon y Resend: gratis en los volúmenes iniciales.
- Dominio `.com.ar`: el arancel anual de NIC Argentina.
