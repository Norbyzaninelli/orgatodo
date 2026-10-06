import type { Metadata, Viewport } from "next";
import { Archivo, Figtree } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
// Archivo con su eje de ancho, para poder angostar los títulos.
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"], axes: ["wdth"] });

export const metadata: Metadata = {
  title: { default: "ORGATODO", template: "%s · ORGATODO" },
  description: "Turnos, recordatorios y facturación para profesionales en un solo lugar.",
  appleWebApp: { capable: true, title: "ORGATODO", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0b1633" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${figtree.variable} ${archivo.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-border bg-surface print:hidden">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-display text-xl font-bold">
              <LogoMark />
              Orgatodo
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium text-muted">
              <Link href="/buscar" className="hover:text-foreground">
                Buscar turnos
              </Link>
              <Link href="/panel" className="hover:text-foreground">
                Mi panel
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-border print:hidden">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-sm text-muted sm:px-6">
            <span>Orgatodo, turnos y facturación para profesionales.</span>
            <nav className="flex gap-5">
              <Link href="/buscar" className="hover:text-foreground">
                Buscar turnos
              </Link>
              <Link href="/registro" className="hover:text-foreground">
                Crear cuenta
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}

function LogoMark() {
  return (
    <svg width="24" height="24" viewBox="0 0 34 34" fill="none" stroke="var(--brand)" strokeWidth="2.5" aria-hidden="true">
      <rect x="3" y="6" width="28" height="25" rx="5" />
      <path d="M3 13h28M11 3v6M23 3v6" />
      <circle cx="17" cy="22" r="3" fill="var(--brand)" stroke="none" />
    </svg>
  );
}
