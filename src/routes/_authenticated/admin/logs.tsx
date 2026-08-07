import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAdminLogs } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin/logs")({
  head: () => ({
    meta: [
      { title: "Logs administrativos — NutriControl" },
      { name: "description", content: "Histórico de ações administrativas no NutriControl." },
      { property: "og:title", content: "Logs administrativos — NutriControl" },
      { property: "og:description", content: "Histórico de ações administrativas." },
    ],
  }),
  component: AdminLogsPage,
});

function AdminLogsPage() {
  const fetchLogs = useServerFn(listAdminLogs);
  const logsQ = useQuery({ queryKey: ["admin-logs"], queryFn: () => fetchLogs() });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-slate-900">Logs administrativos</h1>
      {logsQ.isLoading && <div className="text-sm text-slate-600">Carregando...</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-semibold px-3 py-2.5">Data/hora</th>
              <th className="text-left font-semibold px-3 py-2.5">Administrador</th>
              <th className="text-left font-semibold px-3 py-2.5">Ação</th>
              <th className="text-left font-semibold px-3 py-2.5">Usuário alvo</th>
            </tr>
          </thead>
          <tbody>
            {(logsQ.data ?? []).map((l) => (
              <tr key={l.id} className="border-t border-slate-200 hover:bg-slate-50">
                <td className="px-3 py-2.5 text-slate-600">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2.5 text-slate-900">{l.admin_email ?? l.admin_id}</td>
                <td className="px-3 py-2.5">
                  <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800 ring-1 ring-indigo-300">
                    {l.acao}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-slate-900">{l.target_email ?? l.target_user_id}</td>
              </tr>
            ))}
            {logsQ.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-slate-500">
                  Nenhuma ação administrativa registrada ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
