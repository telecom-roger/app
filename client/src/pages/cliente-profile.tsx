import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  Edit,
  MessageSquare,
  Target,
  FileText,
  MapPin,
} from "lucide-react";
import type { Client, Interaction } from "@shared/schema";

export default function ClienteProfile() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
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

  const { data: cliente, isLoading: clienteLoading } = useQuery<Client>({
    queryKey: ["/api/clients", id],
    enabled: isAuthenticated && !!id,
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery<Interaction[]>({
    queryKey: ["/api/timeline", id],
    enabled: isAuthenticated && !!id,
  });

  if (authLoading || !isAuthenticated) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" asChild data-testid="button-back">
          <Link href="/clientes">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Clientes
          </Link>
        </Button>
      </div>

      {/* Hero Section */}
      <Card className="border-0 bg-gradient-to-r from-primary/10 to-primary/5 dark:from-primary/20 dark:to-primary/10">
        <CardContent className="pt-8">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-4 flex-1">
              {clienteLoading ? (
                <>
                  <Skeleton className="h-24 w-24 rounded-lg" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                </>
              ) : (
                <>
                  <Avatar className="h-24 w-24">
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                      {cliente?.nome?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <h1 className="text-3xl font-bold mb-2" data-testid="text-cliente-nome">
                      {cliente?.nome}
                    </h1>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-sm" data-testid="badge-status">
                        {cliente?.status}
                      </Badge>
                      {cliente?.tags && cliente.tags.length > 0 && (
                        <div className="flex gap-1 flex-wrap">
                          {cliente.tags.slice(0, 3).map((tag, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                          {cliente.tags.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{cliente.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                    {cliente?.razaoSocial && (
                      <p className="text-sm text-muted-foreground mt-2 flex items-center gap-1">
                        <Building2 className="h-4 w-4" />
                        {cliente.razaoSocial}
                      </p>
                    )}
                  </div>
                </>
              )}
            </div>
            <Button 
              size="icon" 
              variant="outline" 
              data-testid="button-edit-cliente"
              onClick={() => navigate(`/clientes/editar/${id}`)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </div>

          {/* Quick Stats */}
          {!clienteLoading && cliente && (
            <div className="grid grid-cols-3 gap-4 mt-8 pt-6 border-t">
              <div>
                <p className="text-sm text-muted-foreground">Score</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-2xl font-bold">{cliente?.score || 0}</span>
                  <div className="h-2 w-16 rounded-full bg-muted overflow-hidden">
                    <div 
                      className="h-full bg-primary"
                      style={{ width: `${cliente?.score || 0}%` }}
                    />
                  </div>
                </div>
              </div>
              {cliente?.carteira && (
                <div>
                  <p className="text-sm text-muted-foreground">Carteira</p>
                  <p className="text-lg font-semibold mt-1">{cliente.carteira}</p>
                </div>
              )}
              {cliente?.planoAtual && (
                <div>
                  <p className="text-sm text-muted-foreground">Plano</p>
                  <p className="text-lg font-semibold mt-1">{cliente.planoAtual}</p>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-1 space-y-6">
          {/* Contact Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Contato & Endereço</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {clienteLoading ? (
                <>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </>
              ) : (
                <>
                  {cliente?.email && (
                    <div className="flex items-start gap-3">
                      <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="font-medium text-sm break-all">{cliente.email}</p>
                      </div>
                    </div>
                  )}
                  {cliente?.telefone && (
                    <div className="flex items-start gap-3">
                      <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-muted-foreground">Telefone</p>
                        <p className="font-medium text-sm">{cliente.telefone}</p>
                      </div>
                    </div>
                  )}
                  {cliente?.endereco && (
                    <div className="flex items-start gap-3">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs text-muted-foreground">Endereço</p>
                        <p className="font-medium text-sm">
                          {cliente.endereco} {cliente.numero && `nº ${cliente.numero}`}
                          {cliente.complemento && ` - ${cliente.complemento}`}
                        </p>
                        {cliente.cidade && (
                          <p className="text-sm text-muted-foreground">
                            {cliente.cidade} {cliente.uf && `- ${cliente.uf}`}
                            {cliente.cep && ` - ${cliente.cep}`}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                  {cliente?.contato && (
                    <div>
                      <p className="text-xs text-muted-foreground">Pessoa de Contato</p>
                      <p className="font-medium text-sm">{cliente.contato}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Additional Info */}
          {!clienteLoading && cliente && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Informações Adicionais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {cliente?.cpfCnpj && (
                  <div>
                    <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                    <p className="font-medium text-sm font-mono">{cliente.cpfCnpj}</p>
                  </div>
                )}
                {cliente?.CELULAR_PRINCIPAL && (
                  <div>
                    <p className="text-xs text-muted-foreground">Celular Principal</p>
                    <p className="font-medium text-sm">{cliente.CELULAR_PRINCIPAL}</p>
                  </div>
                )}
                {cliente?.EMAIL_PRINCIPAL && (
                  <div>
                    <p className="text-xs text-muted-foreground">Email Principal</p>
                    <p className="font-medium text-sm break-all">{cliente.EMAIL_PRINCIPAL}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="default" className="w-full justify-start" data-testid="button-enviar-whatsapp">
                <MessageSquare className="h-4 w-4 mr-2" />
                Enviar WhatsApp
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-enviar-email">
                <Mail className="h-4 w-4 mr-2" />
                Enviar Email
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-criar-oportunidade">
                <Target className="h-4 w-4 mr-2" />
                Criar Oportunidade
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Timeline */}
        <div className="lg:col-span-2 space-y-6">
          {/* Timeline */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Timeline de Interações</CardTitle>
                <Button size="sm" variant="outline" data-testid="button-add-nota">
                  <FileText className="h-4 w-4 mr-2" />
                  Adicionar Nota
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {timelineLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : timeline && timeline.length > 0 ? (
                <div className="space-y-6 relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-border" />
                  
                  {timeline.map((item, index) => (
                    <TimelineItem key={item.id} item={item} isLast={index === timeline.length - 1} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma interação registrada</p>
                  <p className="text-sm mt-1">
                    As interações com este cliente aparecerão aqui
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Dados Telecom */}
          {!clienteLoading && cliente && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Dados Telecom</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  {cliente?.APARELHO_LIBERADO && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Aparelho Liberado</p>
                      <p className="font-medium text-sm">{cliente.APARELHO_LIBERADO}</p>
                    </div>
                  )}
                  {cliente?.PEDIDO_MOVEL && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Pedido Móvel</p>
                      <p className="font-medium text-sm">{cliente.PEDIDO_MOVEL}</p>
                    </div>
                  )}
                  {cliente?.M_FIXA && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">M Fixa</p>
                      <p className="font-medium text-sm">{cliente.M_FIXA}</p>
                    </div>
                  )}
                  {cliente?.PEDIDO_FIXA && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Pedido Fixa</p>
                      <p className="font-medium text-sm">{cliente.PEDIDO_FIXA}</p>
                    </div>
                  )}
                  {cliente?.TIPO_GESTOR && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Tipo Gestor</p>
                      <p className="font-medium text-sm">{cliente.TIPO_GESTOR}</p>
                    </div>
                  )}
                  {cliente?.SERASA && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Serasa</p>
                      <p className="font-medium text-sm">{cliente.SERASA}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ item, isLast }: { item: Interaction; isLast: boolean }) {
  const iconMap: Record<string, React.ReactNode> = {
    nota: <FileText className="h-5 w-5" />,
    email_enviado: <Mail className="h-5 w-5" />,
    whatsapp_enviado: <MessageSquare className="h-5 w-5" />,
    status_mudou: <Target className="h-5 w-5" />,
    campanha: <Mail className="h-5 w-5" />,
  };

  return (
    <div className="flex gap-4 relative">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground z-10 flex-shrink-0">
        {iconMap[item.tipo] || <FileText className="h-5 w-5" />}
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-medium">{item.titulo || item.tipo}</h4>
            <p className="text-xs text-muted-foreground">
              {new Date(item.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
        {item.texto && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {item.texto}
          </p>
        )}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-32" />
      <Card>
        <CardContent className="pt-8">
          <div className="flex gap-4">
            <Skeleton className="h-24 w-24 rounded-lg" />
            <div className="space-y-2 flex-1">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
