import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationBell } from "@/components/notification-bell";
import { ChatNotificationBell } from "@/components/chat-notification-bell";
import { LogoutButton } from "@/components/logout-button";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/hooks/useAuth";

// Pages
import Landing from "@/pages/landing";
import Login from "@/pages/login";
import Register from "@/pages/register";
import Dashboard from "@/pages/dashboard";
import Clientes from "@/pages/clientes";
import ClienteForm from "@/pages/cliente-form";
import ClienteProfile from "@/pages/cliente-profile";
import Kanban from "@/pages/kanban";
import KanbanSettings from "@/pages/kanban-settings";
import Campanhas from "@/pages/campanhas";
import CampanhaNova from "@/pages/campanhas-nova";
import CampanhasWhatsApp from "@/pages/campanhas-whatsapp";
import Importacao from "@/pages/importacao";
import AdminUsuarios from "@/pages/admin-usuarios";
import AdminTemplates from "@/pages/admin-templates";
import AdminAutomacao from "@/pages/admin/automation-config";
import AdminAutomacaoAdvanced from "@/pages/admin/automation-config-advanced";
import ImportPartners from "@/pages/admin/import-partners";
import WhatsApp from "@/pages/whatsapp";
import WhatsAppBroadcast from "@/pages/whatsapp-broadcast";
import Chat from "@/pages/chat";
import ModelosMensagens from "@/pages/modelos-mensagens";
import CampanhasAgendadas from "@/pages/campanhas-agendadas";
import CampanhasEmExecucao from "@/pages/campanhas-em-execucao";
import CampanhasHistorico from "@/pages/campanhas-historico";
import CampanhaDetalhes from "@/pages/campanha-detalhes";
import QuickRepliesConfig from "@/pages/quick-replies-config";
import TagsConfig from "@/pages/tags-config";
import TestAutomation from "@/pages/test-automation";
import TestChat from "@/pages/test-chat";
import NotFound from "@/pages/not-found";

function Router({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <Switch>
      <Route path="/" component={isAuthenticated ? Dashboard : Landing} />
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/clientes/novo" component={ClienteForm} />
      <Route path="/clientes/:id/editar" component={ClienteForm} />
      <Route path="/clientes/:id" component={ClienteProfile} />
      <Route path="/clientes" component={Clientes} />
      <Route path="/clientes/editar/:id" component={ClienteForm} />
      <Route path="/oportunidades" component={Kanban} />
      <Route path="/kanban-settings" component={KanbanSettings} />
      <Route path="/campanhas" component={Campanhas} />
      <Route path="/campanhas/nova" component={CampanhaNova} />
      <Route path="/campanhas/whatsapp" component={CampanhasWhatsApp} />
      <Route path="/whatsapp" component={WhatsApp} />
      <Route path="/whatsapp/broadcast" component={WhatsAppBroadcast} />
      <Route path="/chat" component={Chat} />
      <Route path="/etiquetas" component={TagsConfig} />
      <Route path="/modelos-mensagens" component={ModelosMensagens} />
      <Route path="/campanhas-agendadas" component={CampanhasAgendadas} />
      <Route path="/campanhas-em-execucao" component={CampanhasEmExecucao} />
      <Route path="/campanhas-historico" component={CampanhasHistorico} />
      <Route path="/campanhas/:id/detalhes" component={CampanhaDetalhes} />
      <Route path="/mensagens-rapidas" component={QuickRepliesConfig} />
      <Route path="/importacao" component={Importacao} />
      <Route path="/admin/usuarios" component={AdminUsuarios} />
      <Route path="/admin/templates" component={AdminTemplates} />
      <Route path="/admin/automacao" component={AdminAutomacao} />
      <Route path="/admin/automacao-avancado" component={AdminAutomacaoAdvanced} />
      <Route path="/admin/import-partners" component={ImportPartners} />
      <Route path="/test/automation" component={TestAutomation} />
      <Route path="/test/chat" component={TestChat} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Sidebar width configuration - responsive
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  } as React.CSSProperties;

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <Router isAuthenticated={isAuthenticated} />
      </>
    );
  }

  return (
    <SidebarProvider style={style}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between px-3 md:px-6 py-2 md:py-3 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 gap-2">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-1 md:gap-2">
              <ChatNotificationBell />
              <NotificationBell />
              <ThemeToggle />
              <LogoutButton />
            </div>
          </header>
          <main className="flex-1 overflow-auto">
            <Router isAuthenticated={isAuthenticated} />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <AppContent />
          <Toaster />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
