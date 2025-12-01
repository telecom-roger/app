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
  Zap,
  Activity,
  DollarSign,
  AlertCircle,
} from "lucide-react";

interface DashboardStats {
  totalClientes: number;
  clientesAtivos: number;
  clientesImportados: number;
  clientesAntigos: number;
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

  const { data: oportunidades, isLoading: oppLoading } = useQuery<any[]>({
    queryKey: ["/api/opportunities"],
    enabled: isAuthenticated,
  });

  const { data: tags, isLoading: tagsLoading } = useQuery<any[]>({
    queryKey: ["/api/tags"],
    enabled: isAuthenticated,
  });

  const { data: campaignStats, isLoading: campaignStatsLoading } = useQuery<any>({
    queryKey: ["/api/stats/campaigns"],
    enabled: isAuthenticated,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (authLoading || !isAuthenticated) {
    return <DashboardSkeleton />;
  }

  // Função para extrair número de valores em qualquer formato
  const parseValue = (value: string | undefined): number => {
    if (!value || typeof value !== 'string') return 0;
    const cleanValue = value.replace(/[^\d.,]/g, '');
    if (!cleanValue) return 0;
    if (cleanValue.includes(',') && cleanValue.includes('.')) {
      const lastCommaIndex = cleanValue.lastIndexOf(',');
      const lastDotIndex = cleanValue.lastIndexOf('.');
      if (lastCommaIndex > lastDotIndex) {
        return parseFloat(cleanValue.replace(/\./g, '').replace(',', '.'));
      } else {
        return parseFloat(cleanValue.replace(/,/g, ''));
      }
    } else if (cleanValue.includes(',')) {
      return parseFloat(cleanValue.replace('.', '').replace(',', '.'));
    } else if (cleanValue.includes('.')) {
      const parts = cleanValue.split('.');
      if (parts[parts.length - 1].length >= 2) {
        return parseFloat(cleanValue);
      } else {
        return parseInt(cleanValue.replace(/\./g, ''), 10);
      }
    }
    return parseInt(cleanValue, 10);
  };

  // Calcular soma de valores em negociação
  const totalValueNegotiation = oportunidades
    ?.filter(opp => opp.etapa && opp.etapa !== 'fechado' && opp.etapa !== 'perdido')
    .reduce((sum, opp) => sum + parseValue(opp.valorEstimado), 0) || 0;

  // Agrupar valores por etiqueta (etapa)
  const valuesByStage = (tags || []).map(tag => {
    const total = (oportunidades || [])
      .filter(opp => opp.etapa === tag.nome)
      .reduce((sum, opp) => sum + parseValue(opp.valorEstimado), 0);
    return {
      nome: tag.nome,
      cor: tag.cor,
      total: total,
      count: (oportunidades || []).filter(opp => opp.etapa === tag.nome).length,
    };
  }).filter(item => item.count > 0);

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-purple-500/10 rounded-xl">
                  <Activity className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                  Dashboard
                </h1>
              </div>
              <p className="text-slate-600 dark:text-slate-400 mt-2">
                Visão estratégica de toda sua operação de vendas
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-3 md:px-6 pb-8 md:pb-12">
        <div className="max-w-7xl mx-auto space-y-4 md:space-y-6">
          {/* KPI Cards - Clientes */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
            <StatCard
              title="Total de Clientes"
              value={stats?.totalClientes}
              icon={<Users className="h-6 w-6" />}
              trend={stats?.tendenciaClientes}
              isLoading={statsLoading}
              bgColor="bg-blue-500/10"
              iconColor="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              title="Clientes Ativos"
              value={stats?.clientesAtivos}
              icon={<TrendingUp className="h-6 w-6" />}
              isLoading={statsLoading}
              bgColor="bg-emerald-500/10"
              iconColor="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              title="Oportunidades"
              value={stats?.oportunidades}
              icon={<Target className="h-6 w-6" />}
              isLoading={statsLoading}
              bgColor="bg-amber-500/10"
              iconColor="text-amber-600 dark:text-amber-400"
            />
            <StatCard
              title="Campanhas Ativas"
              value={stats?.campanhasAtivas}
              icon={<Mail className="h-6 w-6" />}
              isLoading={statsLoading}
              bgColor="bg-purple-500/10"
              iconColor="text-purple-600 dark:text-purple-400"
            />
          </div>

          {/* KPI Cards - Campanhas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2 md:gap-4">
            <StatCard
              title="Msgs Hoje"
              value={campaignStats?.mensagensEnviadasHoje}
              icon={<Mail className="h-6 w-6" />}
              isLoading={campaignStatsLoading}
              bgColor="bg-blue-500/10"
              iconColor="text-blue-600 dark:text-blue-400"
            />
            <StatCard
              title="Msgs Mês"
              value={campaignStats?.mensagensEnviadasMes}
              icon={<TrendingUp className="h-6 w-6" />}
              isLoading={campaignStatsLoading}
              bgColor="bg-emerald-500/10"
              iconColor="text-emerald-600 dark:text-emerald-400"
            />
            <StatCard
              title="Enviado"
              value={campaignStats?.totalEnviados}
              icon={<ArrowUpRight className="h-6 w-6" />}
              isLoading={campaignStatsLoading}
              bgColor="bg-green-500/10"
              iconColor="text-green-600 dark:text-green-400"
            />
            <StatCard
              title="Falhas"
              value={campaignStats?.totalErros}
              icon={<AlertCircle className="h-6 w-6" />}
              isLoading={campaignStatsLoading}
              bgColor="bg-red-500/10"
              iconColor="text-red-600 dark:text-red-400"
            />
            <StatCard
              title="Campanhas Hoje"
              value={campaignStats?.campanhasCompletadasHoje}
              icon={<Zap className="h-6 w-6" />}
              isLoading={campaignStatsLoading}
              bgColor="bg-purple-500/10"
              iconColor="text-purple-600 dark:text-purple-400"
            />
            <StatCard
              title="Taxa de Falha"
              value={`${campaignStats?.taxaFalha}%`}
              icon={<AlertCircle className="h-6 w-6" />}
              isLoading={campaignStatsLoading}
              bgColor="bg-amber-500/10"
              iconColor="text-amber-600 dark:text-amber-400"
            />
          </div>

          {/* Value in Negotiation Card */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Total em Negociação
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {oppLoading ? (
                <Skeleton className="h-12 w-40" />
              ) : (
                <div className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">
                  R$ {totalValueNegotiation.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Negotiation by Stage Card */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 lg:col-span-2">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Target className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Negociação por Etiqueta
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {oppLoading || tagsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : valuesByStage.length > 0 ? (
                <div className="space-y-3">
                  {valuesByStage.map((stage) => (
                    <div key={stage.nome} className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900/30">
                      <div className="flex items-center gap-3">
                        <div className={`h-3 w-3 rounded-full ${stage.cor}`} />
                        <div>
                          <p className="text-sm font-medium text-slate-900 dark:text-white">{stage.nome}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{stage.count} oportunidade{stage.count !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      <p className="text-lg font-bold text-slate-900 dark:text-white">
                        R$ {stage.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-slate-500 dark:text-slate-400 py-8">
                  <Target className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  Nenhuma negociação em andamento
                </div>
              )}
            </CardContent>
          </Card>

          {/* Breakdown Card */}
          <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
            <CardHeader className="border-b border-slate-200 dark:border-slate-700">
              <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white">
                Total: {stats?.totalClientes?.toLocaleString('pt-BR')} ({stats?.clientesImportados?.toLocaleString('pt-BR')} importados + {stats?.clientesAntigos?.toLocaleString('pt-BR')} antigos)
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              {statsLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 border border-blue-200 dark:border-blue-800/50">
                    <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">Clientes Importados</p>
                    <p className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                      {stats?.clientesImportados?.toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="bg-slate-100 dark:bg-slate-700/30 rounded-lg p-4 border border-slate-300 dark:border-slate-600/50">
                    <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">Clientes Antigos</p>
                    <p className="text-2xl font-bold text-slate-700 dark:text-slate-300 mt-1">
                      {stats?.clientesAntigos?.toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Funil de Conversão */}
            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <CardHeader className="border-b border-slate-200 dark:border-slate-700">
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Zap className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  Funil de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
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
                        color={COLORS[idx]}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-slate-500 dark:text-slate-400 py-12">
                    <TrendingUp className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Sem dados disponíveis
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribuição por Status */}
            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <CardHeader className="border-b border-slate-200 dark:border-slate-700">
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  Distribuição de Clientes
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
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
                  <div className="text-center text-slate-500 dark:text-slate-400 py-12">
                    <Mail className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    Sem dados disponíveis
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Score e Conversão */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <CardHeader className="border-b border-slate-200 dark:border-slate-700">
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <Target className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  Taxa de Conversão
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {statsLoading ? (
                  <Skeleton className="h-16 w-full" />
                ) : (
                  <div className="space-y-6">
                    <div className="flex items-end justify-between">
                      <div>
                        <div className="text-4xl font-bold bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-400 dark:to-teal-400 bg-clip-text text-transparent">
                          {stats?.taxaConversao}%
                        </div>
                        <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                          De leads para fechado
                        </p>
                      </div>
                      <div className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-1 rounded-lg">
                        <ArrowUpRight className="h-4 w-4" />
                        <span className="text-sm font-semibold">+2.5%</span>
                      </div>
                    </div>
                    <div className="h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-500 to-teal-500 rounded-full transition-all duration-1000"
                        style={{ width: `${stats?.taxaConversao || 0}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50">
              <CardHeader className="border-b border-slate-200 dark:border-slate-700">
                <CardTitle className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Crescimento Mensal
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                {statsLoading ? (
                  <Skeleton className="h-64 w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={monthlyGrowthData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
                      <XAxis dataKey="mes" className="text-xs text-slate-600 dark:text-slate-400" />
                      <YAxis className="text-xs text-slate-600 dark:text-slate-400" />
                      <Tooltip 
                        contentStyle={{
                          backgroundColor: "var(--background)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="clientes"
                        stroke="#7069FF"
                        strokeWidth={3}
                        dot={{ r: 5, fill: "#7069FF" }}
                        activeDot={{ r: 7 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
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
  bgColor,
  iconColor,
}: {
  title: string;
  value?: number;
  icon: React.ReactNode;
  trend?: number;
  isLoading: boolean;
  bgColor: string;
  iconColor: string;
}) {
  return (
    <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 hover:shadow-md transition-shadow duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
            {title}
          </CardTitle>
          <div className={`p-2.5 rounded-lg ${bgColor}`}>
            <div className={iconColor}>{icon}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <div
              className="text-3xl font-bold text-slate-900 dark:text-white"
              data-testid={`stat-${title.toLowerCase().replace(/\s+/g, "-")}`}
            >
              {value?.toLocaleString("pt-BR") || "0"}
            </div>
            {trend !== undefined && (
              <div
                className={`flex items-center gap-1 text-xs font-medium mt-2 ${
                  trend >= 0 
                    ? "text-emerald-600 dark:text-emerald-400" 
                    : "text-red-600 dark:text-red-400"
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
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (value / total) * 100 : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</span>
        <span className="text-sm font-semibold text-slate-900 dark:text-white">{value}</span>
      </div>
      <div className="h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-xs text-slate-500 dark:text-slate-400">{percentage.toFixed(1)}%</span>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-10 w-48 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
      </div>
      <div className="px-6 pb-12">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <Skeleton className="h-5 w-24 mb-2" />
                  <Skeleton className="h-8 w-32" />
                </CardHeader>
              </Card>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {[1, 2].map((i) => (
              <Card key={i} className="border-0 shadow-sm">
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-64 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
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
