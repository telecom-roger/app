import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Users, 
  Target, 
  Mail, 
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";

interface DashboardStats {
  totalClientes: number;
  clientesAtivos: number;
  oportunidades: number;
  campanhasAtivas: number;
  taxaConversao: number;
  tendenciaClientes: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Não autorizado",
        description: "Você precisa estar logado. Redirecionando...",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/api/login";
      }, 500);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats/dashboard"],
    enabled: isAuthenticated,
  });

  if (authLoading || !isAuthenticated) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Visão geral da sua operação
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total de Clientes"
          value={stats?.totalClientes}
          icon={<Users className="h-5 w-5" />}
          trend={stats?.tendenciaClientes}
          isLoading={isLoading}
        />
        <StatCard
          title="Clientes Ativos"
          value={stats?.clientesAtivos}
          icon={<TrendingUp className="h-5 w-5" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Oportunidades"
          value={stats?.oportunidades}
          icon={<Target className="h-5 w-5" />}
          isLoading={isLoading}
        />
        <StatCard
          title="Campanhas Ativas"
          value={stats?.campanhasAtivas}
          icon={<Mail className="h-5 w-5" />}
          isLoading={isLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <FunnelStage label="Leads" value={450} total={450} />
                <FunnelStage label="Contato Realizado" value={320} total={450} />
                <FunnelStage label="Proposta Enviada" value={180} total={450} />
                <FunnelStage label="Fechados" value={95} total={450} />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Atividade Recente
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-4 text-sm">
                <ActivityItem
                  action="Nova oportunidade criada"
                  client="Empresa ABC Ltda"
                  time="há 5 minutos"
                />
                <ActivityItem
                  action="Campanha de email enviada"
                  client="120 destinatários"
                  time="há 1 hora"
                />
                <ActivityItem
                  action="Cliente importado"
                  client="500 novos registros"
                  time="há 2 horas"
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ 
  title, 
  value, 
  icon, 
  trend,
  isLoading 
}: { 
  title: string; 
  value?: number; 
  icon: React.ReactNode;
  trend?: number;
  isLoading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div className="text-2xl font-semibold" data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}>
              {value?.toLocaleString('pt-BR') || '0'}
            </div>
            {trend !== undefined && (
              <div className={`flex items-center gap-1 text-xs mt-1 ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend >= 0 ? (
                  <ArrowUpRight className="h-3 w-3" />
                ) : (
                  <ArrowDownRight className="h-3 w-3" />
                )}
                <span>{Math.abs(trend)}% vs mês anterior</span>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function FunnelStage({ label, value, total }: { label: string; value: number; total: number }) {
  const percentage = (value / total) * 100;
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div 
          className="h-full bg-primary rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function ActivityItem({ action, client, time }: { action: string; client: string; time: string }) {
  return (
    <div className="flex justify-between items-start">
      <div>
        <p className="font-medium">{action}</p>
        <p className="text-muted-foreground">{client}</p>
      </div>
      <span className="text-xs text-muted-foreground whitespace-nowrap ml-4">{time}</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="p-6 space-y-8">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
