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
      <h1 className="text-lg font-bold">Logs administrativos</h1>
      {logsQ.isLoading && <div className="text-sm text-slate-400">Carregando...</div>}
      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/70 text-slate-400">
            <tr>
              <th className="text-left font-medium px-3 py-2">Data/hora</th>
              <th className="text-left font-medium px-3 py-2">Administrador</th>
              <th className="text-left font-medium px-3 py-2">Ação</th>
              <th className="text-left font-medium px-3 py-2">Usuário alvo</th>
            </tr>
          </thead>
          <tbody>
            {(logsQ.data ?? []).map((l) => (
              <tr key={l.id} className="border-t border-slate-800">
                <td className="px-3 py-2 text-slate-400">
                  {new Date(l.created_at).toLocaleString("pt-BR")}
                </td>
                <td className="px-3 py-2">{l.admin_email ?? l.admin_id}</td>
                <td className="px-3 py-2 font-medium text-violet-300">{l.acao}</td>
                <td className="px-3 py-2">{l.target_email ?? l.target_user_id}</td>
              </tr>
            ))}
            {logsQ.data?.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-slate-500">
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
