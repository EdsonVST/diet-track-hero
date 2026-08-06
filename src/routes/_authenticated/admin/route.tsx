import { createFileRoute, redirect, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ShieldCheck, Users, ScrollText, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <div className="-m-4 md:-m-6 min-h-full bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-violet-600 text-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="font-bold leading-tight">Painel Administrativo</div>
            <div className="text-xs text-slate-400 leading-tight">NutriControl · somente leitura</div>
          </div>
          <Badge className="bg-violet-600 hover:bg-violet-600 text-white">Modo Administrador</Badge>
          <Link
            to="/dashboard"
            className="ml-auto inline-flex items-center gap-2 rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
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
                className={`inline-flex items-center gap-2 rounded-t-md px-3 py-2 text-sm ${
                  active
                    ? "bg-slate-950 text-violet-300 border-x border-t border-slate-800"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                <t.icon className="h-4 w-4" /> {t.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs text-amber-300 md:px-6">
        Você está em um ambiente administrativo. Os dados dos usuários são exibidos apenas para
        consulta e não podem ser editados ou excluídos.
      </div>
      <div className="p-4 md:p-6">
        <Outlet />
      </div>
    </div>
  );
}
