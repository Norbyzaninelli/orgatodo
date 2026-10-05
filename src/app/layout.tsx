import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "ORGATODO", template: "%s · ORGATODO" },
  description: "Turnos, recordatorios y facturación para profesionales en un solo lugar.",
  appleWebApp: { capable: true, title: "ORGATODO", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#0f766e" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-AR" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <header className="border-b border-border bg-surface print:hidden">
          <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
            <Link href="/" className="text-lg font-bold tracking-tight text-brand">
              ORGATODO
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
        <footer className="py-6 text-center text-xs text-muted print:hidden">ORGATODO</footer>
      </body>
    </html>
  );
}
