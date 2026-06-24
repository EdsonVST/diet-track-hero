import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { LayoutDashboard, UtensilsCrossed, Apple, User, LogOut, BarChart3, Dumbbell, ClipboardList, History, Calendar, CalendarDays, Droplet, Camera, Layers } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const nutricaoItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Minha Alimentação", url: "/alimentacao", icon: UtensilsCrossed },
  { title: "Alimentos", url: "/alimentos", icon: Apple },
  { title: "Hidratação", url: "/hidratacao", icon: Droplet },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

const treinoItems = [
  { title: "Treino de Hoje", url: "/treino-hoje", icon: Calendar },
  { title: "Modelos de Treino", url: "/modelos-treino", icon: Layers },
  { title: "Planejamento Semanal", url: "/planejamento-semanal", icon: CalendarDays },
  { title: "Exercícios", url: "/treinos", icon: Dumbbell },
  { title: "Meu Treino", url: "/meu-treino", icon: ClipboardList },
  { title: "Histórico", url: "/historico-treinos", icon: History },
];

const corpoItems = [
  { title: "Evolução Física", url: "/evolucao-fisica", icon: Camera },
];

const contaItems = [
  { title: "Perfil", url: "/perfil", icon: User },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success("Você saiu da conta");
    navigate({ to: "/auth", replace: true });
  };

  const renderGroup = (label: string, items: typeof nutricaoItems) => (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = pathname === item.url || pathname.startsWith(item.url + "/");
            return (
              <SidebarMenuItem key={item.url}>
                <SidebarMenuButton asChild isActive={active}>
                  <Link to={item.url} className="flex items-center gap-3">
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span>{item.title}</span>}
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center gap-2 px-2 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground font-black">
            N
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-bold leading-tight truncate">NutriControl</div>
              <div className="text-xs text-muted-foreground leading-tight">Controle alimentar</div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {renderGroup("Nutrição", nutricaoItems)}
        {renderGroup("Treinos", treinoItems)}
        {renderGroup("Corpo", corpoItems)}
        {renderGroup("Conta", contaItems)}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleSignOut}>
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>Sair</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
