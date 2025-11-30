import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Target,
  Users,
  BarChart3,
  MessageSquare,
  Mail,
  Zap,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  Gauge,
  Shield,
} from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/80 dark:from-primary dark:to-primary/60">
              <Target className="h-6 w-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-bold text-primary dark:text-white">
                Atendimento Inteligente
              </span>
              <span className="text-xs text-slate-600 dark:text-slate-400">
                CRM para Telecom
              </span>
            </div>
          </div>
          <Button
            asChild
            className="bg-primary hover:bg-primary/90 text-white font-semibold"
            data-testid="button-login"
          >
            <a href="/login">Entrar</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 dark:from-primary/10 dark:to-accent/10 pointer-events-none" />

        <div className="container mx-auto px-6 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/20 dark:border-primary/30 bg-primary/5 dark:bg-primary/10 text-primary dark:text-accent text-sm font-semibold">
              <Zap className="h-4 w-4" />
              Plataforma para 500k+ clientes
            </div>

            {/* Main Headline */}
            <div className="space-y-4">
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight">
                Gerencie seu atendimento com
                <span className="block bg-gradient-to-r from-primary via-accent to-primary dark:from-primary dark:via-accent dark:to-primary bg-clip-text text-transparent">
                  inteligência artificial
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                CRM completo, WhatsApp integrado, Kanban inteligente e automação com IA para operadoras de telecom. Multiplique suas vendas em dias.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-6">
              <Button
                size="lg"
                asChild
                className="bg-primary hover:bg-primary/90 text-white font-semibold h-12 text-base hover-elevate"
                data-testid="button-get-started"
              >
                <a href="/register" className="flex items-center gap-2">
                  Começar agora
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white font-semibold h-12 text-base hover-elevate"
              >
                <a href="#recursos" className="flex items-center gap-2">
                  Ver recursos
                  <ArrowRight className="h-5 w-5" />
                </a>
              </Button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-12 md:pt-16">
              <div className="space-y-1">
                <p className="text-3xl font-bold text-primary dark:text-accent">
                  500k+
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Clientes gerenciáveis
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-primary dark:text-accent">
                  11
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Etapas de vendas
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold text-primary dark:text-accent">
                  2.8k+
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Clientes importados
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="recursos" className="py-20 md:py-32 bg-slate-50 dark:bg-slate-900/50">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto space-y-16">
            {/* Section Header */}
            <div className="text-center space-y-4">
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
                Tudo que você precisa em uma plataforma
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
                Recursos poderosos especialmente desenvolvidos para operadoras de telecom
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={<Users className="h-8 w-8" />}
                title="CRM Completo"
                description="Gerencie 500k+ clientes com campos personalizados, histórico completo de interações e timeline detalhada."
              />
              <FeatureCard
                icon={<MessageSquare className="h-8 w-8" />}
                title="WhatsApp Integrado"
                description="Envie mensagens em massa, gerencie múltiplas sessões e acompanhe conversas em tempo real."
              />
              <FeatureCard
                icon={<Mail className="h-8 w-8" />}
                title="Campanhas de Email"
                description="Templates personalizados, variáveis dinâmicas e controle total de envios agendados."
              />
              <FeatureCard
                icon={<Target className="h-8 w-8" />}
                title="Kanban de Vendas"
                description="11 etapas configuráveis com drag-and-drop fluido, filtros avançados e automação por IA."
              />
              <FeatureCard
                icon={<Zap className="h-8 w-8" />}
                title="Automação com IA"
                description="Análise de sentimento, sugestões inteligentes e movimento automático de oportunidades com OpenAI."
              />
              <FeatureCard
                icon={<BarChart3 className="h-8 w-8" />}
                title="Analytics Avançado"
                description="Dashboards com KPIs, métricas de conversão, performance por atendente e muito mais."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Features */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto space-y-16">
            {/* Feature 1 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-primary/10 dark:bg-primary/20 w-fit">
                  <Shield className="h-5 w-5 text-primary dark:text-accent" />
                  <span className="text-sm font-semibold text-primary dark:text-accent">
                    Segurança & Controle
                  </span>
                </div>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                  Isolamento multi-vendedor
                </h3>
                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                  Cada vendedor gerencia suas próprias oportunidades. Clientes podem ter múltiplas oportunidades paralelas com diferentes sellers. Controle total de quem vê o quê.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary dark:text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 dark:text-slate-300">
                      Cada vendedor vê apenas suas oportunidades
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary dark:text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 dark:text-slate-300">
                      IA reconhece o vendedor automaticamente
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-primary dark:text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 dark:text-slate-300">
                      Ciclos de venda independentes por vendedor
                    </span>
                  </li>
                </ul>
              </div>
              <div className="hidden md:flex items-center justify-center">
                <div className="w-full h-80 rounded-2xl bg-gradient-to-br from-primary/20 via-accent/10 to-primary/5 dark:from-primary/30 dark:via-accent/20 dark:to-primary/10 flex items-center justify-center">
                  <Gauge className="h-32 w-32 text-primary/30 dark:text-primary/50" />
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="hidden md:flex items-center justify-center order-2">
                <div className="w-full h-80 rounded-2xl bg-gradient-to-br from-accent/20 via-primary/10 to-accent/5 dark:from-accent/30 dark:via-primary/20 dark:to-accent/10 flex items-center justify-center">
                  <Smartphone className="h-32 w-32 text-accent/30 dark:text-accent/50" />
                </div>
              </div>
              <div className="space-y-6 order-1 md:order-2">
                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-accent/10 dark:bg-accent/20 w-fit">
                  <Smartphone className="h-5 w-5 text-accent dark:text-accent" />
                  <span className="text-sm font-semibold text-accent dark:text-accent">
                    Remarketing Inteligente
                  </span>
                </div>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white">
                  Reconverta clientes rejeitados
                </h3>
                <p className="text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                  Sistema detecta automaticamente quando clientes voltam com interesse após rejeição. Novo ciclo de vendas, mesma oportunidade histórica.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 dark:text-slate-300">
                      Status "Remarketing" automático
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 dark:text-slate-300">
                      Histórico completo de ciclos anteriores
                    </span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="h-6 w-6 text-accent flex-shrink-0 mt-0.5" />
                    <span className="text-slate-700 dark:text-slate-300">
                      Lembretes inteligentes de acompanhamento
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 md:py-32 bg-primary text-white dark:bg-primary">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div className="space-y-2">
                <p className="text-4xl md:text-5xl font-bold">2.8k</p>
                <p className="text-sm md:text-base text-white/80">Clientes importados</p>
              </div>
              <div className="space-y-2">
                <p className="text-4xl md:text-5xl font-bold">11</p>
                <p className="text-sm md:text-base text-white/80">Etapas de vendas</p>
              </div>
              <div className="space-y-2">
                <p className="text-4xl md:text-5xl font-bold">7</p>
                <p className="text-sm md:text-base text-white/80">Status automáticos</p>
              </div>
              <div className="space-y-2">
                <p className="text-4xl md:text-5xl font-bold">100%</p>
                <p className="text-sm md:text-base text-white/80">Pronto para produção</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 md:py-32">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mx-auto">
            <Card className="p-8 md:p-12 text-center space-y-6 border-primary/20 dark:border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 dark:from-primary/10 dark:to-accent/10 shadow-lg hover-elevate">
              <h2 className="text-4xl md:text-5xl font-bold text-slate-900 dark:text-white">
                Transforme seu atendimento hoje
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-400">
                Gerencie milhares de clientes com eficiência e automação. Comece seu teste gratuito agora.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                <Button
                  size="lg"
                  asChild
                  className="bg-primary hover:bg-primary/90 text-white font-semibold h-12 text-base hover-elevate"
                  data-testid="button-cta"
                >
                  <a href="/register">Acessar plataforma</a>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  asChild
                  className="border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white font-semibold h-12 text-base hover-elevate"
                >
                  <a href="/login">Já tenho conta</a>
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
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
    <Card className="border-slate-200 dark:border-slate-800 p-8 space-y-4 hover-elevate transition-all duration-300 bg-white dark:bg-slate-900">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 dark:bg-primary/20 text-primary dark:text-accent">
        {icon}
      </div>
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
          {title}
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          {description}
        </p>
      </div>
    </Card>
  );
}
