import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Chequeo rápido: sin cookie de sesión no se entra al panel. La validación real de la sesión
// se hace en el servidor con requireProfessional().
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/ingresar", request.url);
    url.searchParams.set("volver", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/panel/:path*"] };
