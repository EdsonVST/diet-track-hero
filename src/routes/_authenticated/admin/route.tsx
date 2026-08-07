import { createFileRoute, redirect, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Users, ScrollText, ArrowLeft, Lock } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("role", "master")
      .maybeSingle();
    if (!data) throw redirect({ to: "/dashboard" });
  },
  component: AdminLayout,
});

const tabs = [
  { to: "/admin", label: "Usuários", icon: Users, exact: true },
  { to: "/admin/logs", label: "Logs administrativos", icon: ScrollText, exact: false },
];

function AdminLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="-m-4 md:-m-6 min-h-full bg-slate-100 text-slate-900">
      <header className="bg-indigo-900 text-white shadow-lg">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="text-base font-bold leading-tight">Painel Administrativo</div>
            <div className="text-xs text-indigo-200 leading-tight">NutriControl · gestão e auditoria</div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-3 py-1 text-xs font-bold text-amber-950">
            <ShieldCheck className="h-3.5 w-3.5" /> Administrador
          </span>
          <Link
            to="/dashboard"
            className="ml-auto inline-flex items-center gap-2 rounded-md bg-white/10 px-3 py-1.5 text-xs font-medium text-white ring-1 ring-white/25 transition hover:bg-white/20"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Voltar ao app
          </Link>
        </div>
        <nav className="flex gap-1 px-4 md:px-6">
          {tabs.map((t) => {
            const active = t.exact ? pathname === t.to : pathname.startsWith(t.to);
            return (
              <Link
                key={t.to}
                to={t.to}
                className={`inline-flex items-center gap-2 rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-slate-100 text-indigo-900"
                    : "text-indigo-100 hover:bg-white/10 hover:text-white"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="flex items-center gap-2 border-b border-amber-300 bg-amber-100 px-4 py-2 text-xs font-medium text-amber-900 md:px-6">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        Ambiente administrativo: os dados dos usuários são exibidos apenas para consulta e não podem
        ser editados ou excluídos.
      </div>
      <div className="p-4 md:p-6">
        <Outlet />
      </div>
    </div>
  );
}
