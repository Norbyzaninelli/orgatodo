import Link from "next/link";
import { signOutAction } from "@/app/(cuenta)/actions";
import { PanelNav } from "@/components/panel-nav";
import { requireProfessional } from "@/lib/auth";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const pro = await requireProfessional();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Hola,</p>
          <p className="text-xl font-bold tracking-tight">{pro.displayName}</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {pro.published ? (
            <Link href={`/${pro.slug}`} className="font-medium text-brand hover:underline">
              Ver mi página
            </Link>
          ) : (
            <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-medium text-brand">Sin publicar</span>
          )}
          <form action={signOutAction}>
            <button type="submit" className="text-muted hover:text-foreground">
              Salir
            </button>
          </form>
        </div>
      </div>
      <PanelNav />
      {children}
    </div>
  );
}
