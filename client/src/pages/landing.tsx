import { Button } from "@/components/ui/button";
import { Target, Users, BarChart3, MessageSquare, Mail, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary">
              <Target className="h-6 w-6 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold">Atendimento Inteligente</span>
              <span className="text-xs text-muted-foreground">Plataforma CRM Completa</span>
            </div>
          </div>
          <Button asChild data-testid="button-login">
            <a href="/login">Entrar</a>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-6 py-24">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
            <Zap className="h-4 w-4" />
            Gerencie 500k+ clientes com eficiência
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold tracking-tight">
            Plataforma completa de
            <span className="text-primary"> atendimento inteligente</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            CRM poderoso, comunicação em massa via WhatsApp e Email, Kanban de vendas 
            e automação com IA para operadoras de telecom.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Button size="lg" asChild data-testid="button-get-started">
              <a href="/register">Começar agora</a>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#recursos">Ver recursos</a>
            </Button>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="recursos" className="container mx-auto px-6 py-24">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">
            Tudo que você precisa em uma plataforma
          </h2>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
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
        <div className="max-w-4xl mx-auto bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl p-12 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Pronto para transformar seu atendimento?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Comece agora e gerencie milhares de clientes com eficiência.
          </p>
          <Button size="lg" asChild data-testid="button-cta">
            <a href="/register">Acessar plataforma</a>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t mt-24">
        <div className="container mx-auto px-6 py-8">
          <p className="text-center text-sm text-muted-foreground">
            © 2024 Plataforma de Atendimento Inteligente. Todos os direitos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-lg border bg-card p-6 hover-elevate">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary/10 text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
