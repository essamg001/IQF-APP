import { auth } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { logoutAction, setLocaleAction } from "./actions";
import { resolveLocale } from "@/lib/i18n/resolveLocale";
import { getDictionary } from "@/lib/i18n/getDictionary";
import { LocaleProvider } from "@/lib/i18n/locale-context";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null;

  const locale = await resolveLocale();
  const dict = getDictionary(locale);
  const ROLE_LABELS = {
    OWNER: dict.common.roleOwner,
    SALES: dict.common.roleSales,
    QUALITY: dict.common.roleQuality,
    PRODUCTION: dict.common.roleProduction,
    LOGISTICS: dict.common.roleLogistics,
    MAINTENANCE: dict.common.roleMaintenance,
  } as const;

  return (
    <LocaleProvider locale={locale} dict={dict}>
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto flex max-w-7xl">
          <aside className="app-sidebar sticky top-0 flex h-screen w-60 shrink-0 flex-col border-e border-slate-200 bg-white p-4">
            <div className="mb-6 px-1">
              <p className="text-sm font-semibold text-slate-900">{dict.app.name}</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Nav
                role={session.user.role}
                isHeadOfSales={session.user.isHeadOfSales}
                isHeadOfProduction={session.user.isHeadOfProduction}
                financialsRestricted={session.user.financialsRestricted}
                station={session.user.station}
              />
            </div>
            <div className="border-t border-slate-200 pt-3">
              <p className="truncate px-1 text-sm font-medium text-slate-900">{session.user.name}</p>
              <p className="px-1 text-xs text-slate-500">{ROLE_LABELS[session.user.role]}</p>

              <div className="mt-2 flex items-center gap-1 px-1 text-xs">
                <form action={setLocaleAction.bind(null, "EN")}>
                  <button
                    type="submit"
                    className={locale === "EN" ? "font-semibold text-emerald-700" : "text-slate-400 hover:text-slate-600"}
                  >
                    {dict.common.english}
                  </button>
                </form>
                <span className="text-slate-300">·</span>
                <form action={setLocaleAction.bind(null, "AR")}>
                  <button
                    type="submit"
                    className={locale === "AR" ? "font-semibold text-emerald-700" : "text-slate-400 hover:text-slate-600"}
                  >
                    {dict.common.arabic}
                  </button>
                </form>
              </div>

              <form action={logoutAction}>
                <button className="mt-2 w-full rounded-md px-1 py-1.5 text-start text-sm text-slate-500 hover:bg-slate-100">
                  {dict.common.signOut}
                </button>
              </form>
            </div>
          </aside>
          <main className="min-w-0 flex-1 p-8">{children}</main>
        </div>
      </div>
    </LocaleProvider>
  );
}
