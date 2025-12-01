import {
  LayoutDashboard,
  Users,
  Kanban,
  MessageSquare,
  MessageCircle,
  Mail,
  Clock,
  FileUp,
  BarChart3,
  Settings,
  Zap,
  Briefcase,
  Tag,
  Lightbulb,
  Layout,
} from "lucide-react";
import { Link, useLocation } from "wouter";
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
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";

const operacoesItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Users,
  },
  {
    title: "Kanban",
    url: "/oportunidades",
    icon: Kanban,
  },
];

const comunicacaoItems = [
  {
    title: "WhatsApp",
    url: "/whatsapp",
    icon: MessageSquare,
  },
  {
    title: "Chat",
    url: "/chat",
    icon: MessageCircle,
  },
  {
    title: "Campanhas Email",
    url: "/campanhas",
    icon: Mail,
  },
  {
    title: "Campanhas WhatsApp",
    url: "/campanhas/whatsapp",
    icon: MessageSquare,
  },
];

const agendamentoItems = [
  {
    title: "Campanhas Agendadas",
    url: "/campanhas-agendadas",
    icon: Clock,
  },
  {
    title: "Campanhas em Execução",
    url: "/campanhas-em-execucao",
    icon: Zap,
  },
  {
    title: "Histórico",
    url: "/campanhas-historico",
    icon: BarChart3,
  },
];

const configItems = [
  {
    title: "Etiquetas",
    url: "/etiquetas",
    icon: Tag,
  },
  {
    title: "Mensagens Rápidas",
    url: "/mensagens-rapidas",
    icon: Lightbulb,
  },
  {
    title: "Modelos de Mensagens",
    url: "/modelos-mensagens",
    icon: Mail,
  },
  {
    title: "Importação",
    url: "/importacao",
    icon: FileUp,
  },
  {
    title: "Relatórios",
    url: "/relatorios",
    icon: BarChart3,
  },
];

const adminItems = [
  {
    title: "Usuários",
    url: "/admin/usuarios",
    icon: Users,
  },
  {
    title: "Templates",
    url: "/admin/templates",
    icon: Layout,
  },
  {
    title: "Automação",
    url: "/admin/automacao",
    icon: Zap,
  },
  {
    title: "Automação Avançada",
    url: "/admin/automacao-avancado",
    icon: Zap,
  },
  {
    title: "Importar Parceiros",
    url: "/admin/import-partners",
    icon: FileUp,
  },
  {
    title: "Configurações",
    url: "/admin/configuracoes",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  return (
    <Sidebar>
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
            <Briefcase className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-sidebar-foreground">
              Atendimento
            </span>
            <span className="text-xs text-sidebar-foreground/70">
              Inteligente
            </span>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Operações</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {operacoesItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                    className="hover:bg-muted/50 data-[active=true]:bg-muted/50 text-foreground hover:text-foreground data-[active=true]:text-foreground rounded-md"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Comunicação</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {comunicacaoItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                    className="hover:bg-muted/50 data-[active=true]:bg-muted/50 text-foreground hover:text-foreground data-[active=true]:text-foreground rounded-md"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Agendamento</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {agendamentoItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                    className="hover:bg-muted/50 data-[active=true]:bg-muted/50 text-foreground hover:text-foreground data-[active=true]:text-foreground rounded-md"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Configuração</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase()}`}
                    className="hover:bg-muted/50 data-[active=true]:bg-muted/50 text-foreground hover:text-foreground data-[active=true]:text-foreground rounded-md"
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {isAdmin && (
          <SidebarGroup>
            <SidebarGroupLabel>Administração</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {adminItems.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={location === item.url}
                      data-testid={`link-admin-${item.title.toLowerCase()}`}
                      className="hover:bg-muted/50 data-[active=true]:bg-muted/50 text-foreground hover:text-foreground data-[active=true]:text-foreground rounded-md"
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user?.profileImageUrl || undefined} />
            <AvatarFallback className="text-xs bg-primary text-primary-foreground">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-medium text-sidebar-foreground truncate">
              {user?.firstName} {user?.lastName}
            </span>
            <span className="text-xs text-sidebar-foreground/70 truncate">
              {user?.email}
            </span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
