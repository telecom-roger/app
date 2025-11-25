import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
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

interface FunnelData {
  lead: number;
  contato: number;
  proposta: number;
  fechado: number;
}

interface StatusDistribution {
  name: string;
  value: number;
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

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/stats/dashboard"],
    enabled: isAuthenticated,
  });

  const { data: funnelData, isLoading: funnelLoading } = useQuery<FunnelData>({
    queryKey: ["/api/stats/funnel"],
    enabled: isAuthenticated,
  });

  const { data: statusDist, isLoading: statusLoading } = useQuery<
    StatusDistribution[]
  >({
    queryKey: ["/api/stats/status-distribution"],
    enabled: isAuthenticated,
  });

  if (authLoading || !isAuthenticated) {
    return <DashboardSkeleton />;
  }

  // Transformar dados para gráfico de funil
  const funnelChartData = funnelData
    ? [
        { name: "Leads", value: funnelData.lead },
        { name: "Contato", value: funnelData.contato },
        { name: "Proposta", value: funnelData.proposta },
        { name: "Fechado", value: funnelData.fechado },
      ]
    : [];

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444"];
  const STATUS_COLORS: Record<string, string> = {
    lead: "#3B82F6",
    ativo: "#10B981",
    proposta: "#F59E0B",
    fechado: "#EF4444",
    perdido: "#EC4899",
    inativo: "#6B7280",
  };

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
          isLoading={statsLoading}
        />
        <StatCard
          title="Clientes Ativos"
          value={stats?.clientesAtivos}
          icon={<TrendingUp className="h-5 w-5" />}
          isLoading={statsLoading}
        />
        <StatCard
          title="Oportunidades"
          value={stats?.oportunidades}
          icon={<Target className="h-5 w-5" />}
          isLoading={statsLoading}
        />
        <StatCard
          title="Campanhas Ativas"
          value={stats?.campanhasAtivas}
          icon={<Mail className="h-5 w-5" />}
          isLoading={statsLoading}
        />
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Funil de Conversão */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Funil de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : funnelChartData.length > 0 ? (
              <div className="space-y-4">
                {funnelChartData.map((stage, idx) => (
                  <FunnelStage
                    key={idx}
                    label={stage.name}
                    value={stage.value}
                    total={funnelChartData[0].value}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>

        {/* Distribuição por Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Distribuição de Clientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : statusDist && statusDist.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={statusDist}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {statusDist.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={
                          STATUS_COLORS[entry.name.toLowerCase()] ||
                          COLORS[index % COLORS.length]
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                Sem dados disponíveis
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Score e Conversão */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Taxa de Conversão
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-16 w-full" />
            ) : (
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-3xl font-bold text-primary">
                      {stats?.taxaConversao}%
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      De leads para fechado
                    </p>
                  </div>
                  <div className="text-green-600 flex items-center gap-1">
                    <ArrowUpRight className="h-4 w-4" />
                    <span className="text-sm font-medium">+2.5%</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${stats?.taxaConversao || 0}%` }}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg font-medium">
              Crescimento Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={monthlyGrowthData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="clientes"
                    stroke="#7069FF"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
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
  isLoading,
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
            <div
              className="text-2xl font-semibold"
              data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {value?.toLocaleString("pt-BR") || "0"}
            </div>
            {trend !== undefined && (
              <div
                className={`flex items-center gap-1 text-xs mt-1 ${
                  trend >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
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

function FunnelStage({
  label,
  value,
  total,
}: {
  label: string;
  value: number;
  total: number;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

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
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// Mock data para crescimento mensal
const monthlyGrowthData = [
  { mes: "Jan", clientes: 120 },
  { mes: "Fev", clientes: 132 },
  { mes: "Mar", clientes: 101 },
  { mes: "Abr", clientes: 164 },
  { mes: "Mai", clientes: 170 },
  { mes: "Jun", clientes: 201 },
];
