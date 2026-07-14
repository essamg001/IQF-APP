import { auth } from "@/lib/auth";
import { Nav } from "@/components/nav";
import { ROLE_LABELS } from "@/lib/roles";
import { logoutAction } from "./actions";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-7xl">
        <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-slate-200 bg-white p-4">
          <div className="mb-6 px-1">
            <p className="text-sm font-semibold text-slate-900">IQF Factory Manager</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            <Nav role={session.user.role} isHeadOfSales={session.user.isHeadOfSales} />
          </div>
          <div className="border-t border-slate-200 pt-3">
            <p className="truncate px-1 text-sm font-medium text-slate-900">{session.user.name}</p>
            <p className="px-1 text-xs text-slate-500">{ROLE_LABELS[session.user.role]}</p>
            <form action={logoutAction}>
              <button className="mt-2 w-full rounded-md px-1 py-1.5 text-left text-sm text-slate-500 hover:bg-slate-100">
                Sign out
              </button>
            </form>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
