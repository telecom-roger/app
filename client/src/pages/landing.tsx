import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Target, Users, BarChart3, MessageSquare, Mail, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-100">
              <Target className="h-6 w-6 text-white dark:text-slate-900" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-slate-900 dark:text-white">Atendimento Inteligente</span>
              <span className="text-xs text-slate-600 dark:text-slate-400">Plataforma CRM Completa</span>
            </div>
          </div>
          <Button
            asChild
            className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100"
            data-testid="button-login"
          >
            <a href="/login">Entrar</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 text-sm font-semibold">
            <Zap className="h-4 w-4" />
            Gerencie 500k+ clientes com eficiência
          </div>

          <h1 className="text-6xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white">
            Plataforma completa de
            <span className="block bg-gradient-to-r from-slate-900 via-blue-600 to-slate-900 dark:from-white dark:via-blue-300 dark:to-white bg-clip-text text-transparent mt-2">
              atendimento inteligente
            </span>
          </h1>

          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            CRM poderoso, comunicação em massa via WhatsApp e Email, Kanban de vendas
            e automação com IA para operadoras de telecom.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button
              size="lg"
              asChild
              className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 h-11 font-semibold"
              data-testid="button-get-started"
            >
              <a href="/register">Começar agora</a>
            </Button>
            <Button
              size="lg"
              variant="outline"
              asChild
              className="border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-800 h-11 font-semibold"
            >
              <a href="#recursos">Ver recursos</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="recursos" className="container mx-auto px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-4xl font-bold text-center mb-12 text-slate-900 dark:text-white">
            Tudo que você precisa em uma plataforma
          </h2>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            <FeatureCard
              icon={<Users className="h-8 w-8" />}
              title="CRM Completo"
              description="Gerencie clientes, contatos, campos personalizados e histórico completo de interações em um só lugar."
            />
            <FeatureCard
              icon={<MessageSquare className="h-8 w-8" />}
              title="WhatsApp Integrado"
              description="Envie mensagens em massa, gerencie múltiplas sessões e acompanhe conversas com seus clientes."
            />
            <FeatureCard
              icon={<Mail className="h-8 w-8" />}
              title="Campanhas de Email"
              description="Crie campanhas com templates personalizados, variáveis dinâmicas e controle total de envio."
            />
            <FeatureCard
              icon={<Target className="h-8 w-8" />}
              title="Kanban de Vendas"
              description="Visualize e gerencie seu funil de vendas com drag-and-drop fluido e filtros avançados."
            />
            <FeatureCard
              icon={<BarChart3 className="h-8 w-8" />}
              title="Analytics Avançado"
              description="Dashboards com KPIs, métricas de conversão, performance por atendente e muito mais."
            />
            <FeatureCard
              icon={<Zap className="h-8 w-8" />}
              title="Automação com IA"
              description="Score automático de leads, sugestões inteligentes e respostas automáticas com OpenAI."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 dark:from-white dark:to-slate-100 rounded-2xl p-12 text-center shadow-sm hover-elevate">
          <h2 className="text-4xl font-bold mb-4 text-white dark:text-slate-900">
            Pronto para transformar seu atendimento?
          </h2>
          <p className="text-lg text-slate-200 dark:text-slate-700 mb-8">
            Comece agora e gerencie milhares de clientes com eficiência.
          </p>
          <Button
            size="lg"
            asChild
            className="bg-blue-600 dark:bg-blue-500 text-white hover:bg-blue-700 dark:hover:bg-blue-600 h-11 font-semibold"
            data-testid="button-cta"
          >
            <a href="/register">Acessar plataforma</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 mt-24">
        <div className="container mx-auto px-6 py-8">
          <p className="text-center text-sm text-slate-600 dark:text-slate-400">
            © 2024 Plataforma de Atendimento Inteligente. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 p-6 hover-elevate overflow-hidden">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2 text-slate-900 dark:text-white">
        {title}
      </h3>
      <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
        {description}
      </p>
    </Card>
  );
}
