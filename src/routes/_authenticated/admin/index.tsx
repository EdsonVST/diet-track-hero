import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllUsers, setUserAccountStatus } from "@/lib/admin.functions";
import { startViewAs } from "@/lib/view-as";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Eye, Ban, Power, PowerOff, ShieldCheck, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Painel Administrativo — NutriControl" },
      { name: "description", content: "Gestão e consulta de usuários do NutriControl." },
      { property: "og:title", content: "Painel Administrativo — NutriControl" },
      { property: "og:description", content: "Gestão e consulta de usuários do NutriControl." },
    ],
  }),
  component: AdminUsersPage,
});

function statusOf(u: { ativo: boolean; bloqueado_em: string | null; banned: boolean }) {
  if (u.bloqueado_em) return "bloqueado" as const;
  if (!u.ativo || u.banned) return "desativado" as const;
  return "ativo" as const;
}

const statusStyle: Record<string, string> = {
  ativo: "bg-emerald-100 text-emerald-800 ring-emerald-300",
  desativado: "bg-slate-200 text-slate-700 ring-slate-300",
  bloqueado: "bg-red-100 text-red-800 ring-red-300",
};

function AdminUsersPage() {
  const fetchUsers = useServerFn(listAllUsers);
  const setStatus = useServerFn(setUserAccountStatus);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [status, setStatusFilter] = useState("todos");

  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: () => fetchUsers() });

  const mut = useMutation({
    mutationFn: (vars: { userId: string; action: "ativar" | "desativar" | "bloquear" }) =>
      setStatus({ data: vars }),
    onSuccess: () => {
      toast.success("Status atualizado");
      qc.invalidateQueries({ queryKey: ["admin-users"] });
      qc.invalidateQueries({ queryKey: ["admin-logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = useMemo(() => {
    const list = usersQ.data ?? [];
    const term = q.trim().toLowerCase();
    return list.filter((u) => {
      const st = statusOf(u);
      if (status !== "todos" && st !== status) return false;
      if (!term) return true;
      return (
        (u.email ?? "").toLowerCase().includes(term) ||
        (u.nome ?? "").toLowerCase().includes(term)
      );
    });
  }, [usersQ.data, q, status]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por nome ou e-mail"
            className="pl-9 bg-white border-slate-300 text-slate-900 placeholder:text-slate-500"
          />
        </div>
        <Select value={status} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-white border-slate-300 text-slate-900">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="desativado">Desativados</SelectItem>
            <SelectItem value="bloqueado">Bloqueados</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm font-medium text-slate-600">{rows.length} usuário(s)</div>
      </div>

      {usersQ.isLoading && <div className="text-slate-600 text-sm">Carregando usuários...</div>}
      {usersQ.error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-800">
          {(usersQ.error as Error).message}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-300 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="text-left font-semibold px-3 py-2.5">Usuário</th>
              <th className="text-left font-semibold px-3 py-2.5">Status</th>
              <th className="text-left font-semibold px-3 py-2.5">Cadastro</th>
              <th className="text-left font-semibold px-3 py-2.5">Último acesso</th>
              <th className="text-right font-semibold px-3 py-2.5">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const st = statusOf(u);
              const isMaster = u.roles.includes("master");
              return (
                <tr key={u.id} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2 font-semibold text-slate-900">
                      {u.nome ?? "—"}
                      {isMaster && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-bold text-indigo-800 ring-1 ring-indigo-300">
                          <ShieldCheck className="h-3 w-3" /> Master
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ${statusStyle[st]}`}
                    >
                      {st}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button asChild size="sm" variant="outline">
                        <Link to="/admin/usuarios/$userId" params={{ userId: u.id }}>
                          <Eye className="h-3.5 w-3.5" /> Ver dados
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        className="bg-indigo-700 text-white hover:bg-indigo-800"
                        onClick={() =>
                          startViewAs({ id: u.id, nome: u.nome ?? null, email: u.email ?? null })
                        }
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Visitar Usuário
                      </Button>
                      {st === "ativo" ? (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={mut.isPending || isMaster}
                            onClick={() => mut.mutate({ userId: u.id, action: "desativar" })}
                          >
                            <PowerOff className="h-3.5 w-3.5" /> Desativar
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={mut.isPending || isMaster}
                            onClick={() => mut.mutate({ userId: u.id, action: "bloquear" })}
                          >
                            <Ban className="h-3.5 w-3.5" /> Bloquear
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          className="bg-emerald-700 text-white hover:bg-emerald-800"
                          disabled={mut.isPending}
                          onClick={() => mut.mutate({ userId: u.id, action: "ativar" })}
                        >
                          <Power className="h-3.5 w-3.5" /> Reativar
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && !usersQ.isLoading && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                  Nenhum usuário encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
