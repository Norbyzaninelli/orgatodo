"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/panel", label: "Turnos" },
  { href: "/panel/facturacion", label: "Facturación" },
  { href: "/panel/resumen", label: "Resumen" },
  { href: "/panel/servicios", label: "Servicios" },
  { href: "/panel/horarios", label: "Horarios" },
  { href: "/panel/perfil", label: "Perfil" },
];

export function PanelNav() {
  const pathname = usePathname();
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4">
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            className={[
              "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition",
              active ? "bg-brand-soft text-brand" : "text-muted hover:text-foreground",
            ].join(" ")}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
