import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser, roleLabels } from "@/lib/auth";
import { db } from "@/lib/db";
import { logout } from "../actions";
import Logo from "@/components/Logo";
import NavLinks from "@/components/NavLinks";
import Icon from "@/components/Icon";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const unread = await db.notification.count({ where: { userId: user.id, readAt: null } });

  return (
    <div className="flex min-h-screen">
      {/* الشريط الجانبي */}
      <aside className="pattern-bg-light sticky top-0 flex h-screen w-64 shrink-0 flex-col bg-navy-900 text-cream-50 max-lg:w-20">
        <div className="border-b border-navy-700/60 p-5 max-lg:flex max-lg:justify-center max-lg:p-3">
          <div className="max-lg:hidden">
            <Logo light />
          </div>
          <svg viewBox="0 0 40 40" className="hidden h-9 w-9 max-lg:block" aria-hidden>
            <path d="M4 4h24l8 10v22H22L4 18V4z" fill="#FBF6EF" />
            <path d="M10 30l10-10 10 10H10z" fill="#C1996B" />
          </svg>
        </div>

        <NavLinks roles={user.roles} />

        <Link
          href="/notifications"
          className="mx-3 mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-cream-50/85 transition hover:bg-navy-700 max-lg:justify-center max-lg:px-2"
        >
          <span className="relative">
            <Icon name="bell" size={18} />
            {unread > 0 && (
              <span className="absolute -left-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sand-500 px-1 text-[10px] font-bold text-navy-900">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </span>
          <span className="max-lg:hidden">الإشعارات</span>
        </Link>

        <div className="mt-auto border-t border-navy-700/60 p-4">
          <div className="mb-3 flex items-center gap-3 max-lg:justify-center">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sand-500 font-heading text-lg font-bold text-navy-900">
              {user.name.slice(0, 1)}
            </div>
            <div className="max-lg:hidden">
              <div className="text-sm font-bold">{user.name}</div>
              <div className="text-xs text-sand-300">{user.jobTitle || roleLabels(user.roles)}</div>
            </div>
          </div>
          <form action={logout}>
            <button className="w-full rounded-lg border border-navy-700 py-2 text-sm text-steel-300 transition hover:bg-navy-700 hover:text-cream-50 max-lg:text-xs">
              تسجيل الخروج
            </button>
          </form>
        </div>
      </aside>

      {/* المحتوى */}
      <main className="min-w-0 flex-1 p-6 max-md:p-3">{children}</main>
    </div>
  );
}
