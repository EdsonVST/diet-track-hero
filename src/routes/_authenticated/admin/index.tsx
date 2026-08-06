import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAllUsers, setUserAccountStatus } from "@/lib/admin.functions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Search, Eye, Ban, Power, PowerOff, ShieldCheck } from "lucide-react";

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
            className="pl-9 bg-slate-900 border-slate-700 text-slate-100 placeholder:text-slate-500"
          />
        </div>
        <Select value={status} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] bg-slate-900 border-slate-700 text-slate-100">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os status</SelectItem>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="desativado">Desativados</SelectItem>
            <SelectItem value="bloqueado">Bloqueados</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-sm text-slate-400">{rows.length} usuário(s)</div>
      </div>

      {usersQ.isLoading && <div className="text-slate-400 text-sm">Carregando usuários...</div>}
      {usersQ.error && (
        <div className="text-sm text-red-400">{(usersQ.error as Error).message}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/70 text-slate-400">
            <tr>
              <th className="text-left font-medium px-3 py-2">Usuário</th>
              <th className="text-left font-medium px-3 py-2">Status</th>
              <th className="text-left font-medium px-3 py-2">Cadastro</th>
              <th className="text-left font-medium px-3 py-2">Último acesso</th>
              <th className="text-right font-medium px-3 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const st = statusOf(u);
              const isMaster = u.roles.includes("master");
              return (
                <tr key={u.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2 font-medium">
                      {u.nome ?? "—"}
                      {isMaster && (
                        <Badge className="bg-violet-600 hover:bg-violet-600 text-white gap-1">
                          <ShieldCheck className="h-3 w-3" /> Master
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-slate-400">{u.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      className={
                        st === "ativo"
                          ? "bg-emerald-600 hover:bg-emerald-600 text-white"
                          : st === "desativado"
                            ? "bg-slate-600 hover:bg-slate-600 text-white"
                            : "bg-red-600 hover:bg-red-600 text-white"
                      }
                    >
                      {st}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {new Date(u.created_at).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-3 py-2 text-slate-400">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleString("pt-BR")
                      : "—"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      <Button asChild size="sm" variant="secondary">
                        <Link to="/admin/usuarios/$userId" params={{ userId: u.id }}>
                          <Eye className="h-3.5 w-3.5" /> Ver dados
                        </Link>
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
          </tbody>
        </table>
      </div>
    </div>
  );
}
