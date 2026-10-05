import Link from "next/link";
import { signOutAction } from "@/app/(cuenta)/actions";
import { PanelNav } from "@/components/panel-nav";
import { requireProfessional } from "@/lib/auth";
import { getOrganization } from "@/lib/centros";

export default async function PanelLayout({ children }: LayoutProps<"/panel">) {
  const pro = await requireProfessional();
  const org = await getOrganization(pro.organizationId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Hola,</p>
          <p className="text-xl font-bold tracking-tight">{pro.displayName}</p>
          {org.kind === "centro" && (
            <Link href="/panel/centro" className="text-sm text-muted hover:text-foreground">
              {org.name}
            </Link>
          )}
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
      <div className="space-y-6 lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:space-y-0">
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <PanelNav />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
