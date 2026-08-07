import { createFileRoute, redirect, Outlet } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { useWaterReminderScheduler } from "@/lib/water-reminders";
import { useViewAs, stopViewAs } from "@/lib/view-as";
import { Button } from "@/components/ui/button";
import { Eye, LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  useWaterReminderScheduler();
  const { viewAs, readOnly } = useViewAs();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center gap-2 border-b border-border bg-card/50 backdrop-blur px-3 sticky top-0 z-30">
            <SidebarTrigger />
            <div className="font-semibold">NutriControl</div>
          </header>
          {viewAs && (
            <div className="sticky top-14 z-20 flex flex-wrap items-center gap-2 border-b border-amber-500/40 bg-amber-500/15 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              <Eye className="h-4 w-4 shrink-0" />
              <span className="font-semibold">Modo somente leitura</span>
              <span className="opacity-80">
                Visitando a conta de {viewAs.nome ?? viewAs.email ?? viewAs.id}. Nenhuma alteração
                pode ser feita.
              </span>
              <Button size="sm" variant="outline" className="ml-auto h-7" onClick={stopViewAs}>
                <LogOut className="h-3.5 w-3.5 mr-1" /> Sair da visita
              </Button>
            </div>
          )}
          <main className="flex-1 p-4 md:p-6">
            {/* fieldset disabled desativa nativamente todos os controles em modo leitura */}
            <fieldset disabled={readOnly} className="min-w-0 border-0 p-0 m-0">
              <Outlet />
            </fieldset>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

