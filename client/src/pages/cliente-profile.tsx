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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Send,
  Settings,
  Share2,
  MoreVertical,
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
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild data-testid="button-back">
            <Link href="/clientes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="font-semibold text-lg">{cliente?.nome || "Cliente"}</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" data-testid="button-options">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Layout - 3 Columns */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT SIDEBAR - Menu & Actions */}
        <div className="w-64 border-r bg-card overflow-y-auto">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* Client Header Card */}
              {clienteLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              ) : (
                <div className="space-y-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      {cliente?.nome?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-sm" data-testid="text-cliente-nome">
                      {cliente?.nome}
                    </h3>
                    {cliente?.status && (
                      <Badge variant="outline" className="text-xs mt-1" data-testid="badge-status">
                        {cliente.status}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Quick Actions */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground px-2">AÇÕES RÁPIDAS</p>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm" 
                  data-testid="button-enviar-whatsapp"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Enviar WhatsApp
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm"
                  data-testid="button-enviar-email"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Email
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm"
                  data-testid="button-criar-oportunidade"
                >
                  <Target className="h-4 w-4 mr-2" />
                  Criar Oportunidade
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm"
                  data-testid="button-add-nota"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Adicionar Nota
                </Button>
              </div>

              <Separator />

              {/* Management Options */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground px-2">GERENCIAR</p>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm"
                  onClick={() => navigate(`/clientes/editar/${id}`)}
                  data-testid="button-edit-cliente"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Cliente
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm"
                  data-testid="button-compartilhar"
                >
                  <Share2 className="h-4 w-4 mr-2" />
                  Compartilhar
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm"
                  data-testid="button-configuracoes"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Configurações
                </Button>
              </div>

              {/* Tags Section */}
              {cliente?.tags && cliente.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground px-2">TAGS</p>
                    <div className="flex flex-wrap gap-2">
                      {cliente.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="text-xs cursor-pointer hover-elevate">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* CENTER - Timeline/Chat Feed */}
        <div className="flex-1 border-r flex flex-col bg-background">
          {/* Timeline Header */}
          <div className="border-b px-6 py-4 bg-card">
            <h3 className="font-semibold text-sm">Histórico de Interações</h3>
          </div>

          {/* Timeline Feed */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {timelineLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : timeline && timeline.length > 0 ? (
                <div className="space-y-4">
                  {timeline.map((item) => (
                    <TimelineItem key={item.id} item={item} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhuma interação registrada</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    As interações com este cliente aparecerão aqui
                  </p>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* RIGHT SIDEBAR - Client Information */}
        <div className="w-80 bg-card border-l overflow-y-auto">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-6">
              {/* Status Badge */}
              {!clienteLoading && cliente && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">STATUS</p>
                  <Badge className="w-full justify-center" variant="outline">
                    {cliente?.status}
                  </Badge>
                </div>
              )}

              <Separator />

              {/* Contact Information */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground">CONTATO</p>
                {clienteLoading ? (
                  <>
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                  </>
                ) : (
                  <div className="space-y-3">
                    {cliente?.email && (
                      <div className="flex items-start gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">Email</p>
                          <p className="text-sm font-medium break-all">{cliente.email}</p>
                        </div>
                      </div>
                    )}
                    {cliente?.telefone && (
                      <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground">Telefone</p>
                          <p className="text-sm font-medium">{cliente.telefone}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <Separator />

              {/* Business Information */}
              {!clienteLoading && cliente && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">NEGÓCIO</p>
                  <div className="space-y-2 text-sm">
                    {cliente?.razaoSocial && (
                      <div>
                        <p className="text-xs text-muted-foreground">Razão Social</p>
                        <p className="font-medium">{cliente.razaoSocial}</p>
                      </div>
                    )}
                    {cliente?.carteira && (
                      <div>
                        <p className="text-xs text-muted-foreground">Carteira</p>
                        <p className="font-medium">{cliente.carteira}</p>
                      </div>
                    )}
                    {cliente?.planoAtual && (
                      <div>
                        <p className="text-xs text-muted-foreground">Plano</p>
                        <p className="font-medium">{cliente.planoAtual}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Address Information */}
              {!clienteLoading && cliente?.endereco && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">ENDEREÇO</p>
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">
                        {cliente.endereco} {cliente.numero && `nº ${cliente.numero}`}
                      </p>
                      {cliente.complemento && (
                        <p className="text-xs text-muted-foreground">{cliente.complemento}</p>
                      )}
                      {cliente.cidade && (
                        <p className="text-xs text-muted-foreground">
                          {cliente.cidade} {cliente.uf && `- ${cliente.uf}`}
                          {cliente.cep && ` - ${cliente.cep}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Additional Data */}
              {!clienteLoading && cliente && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">DADOS ADICIONAIS</p>
                  <div className="space-y-2 text-sm">
                    {cliente?.cpfCnpj && (
                      <div>
                        <p className="text-xs text-muted-foreground">CPF/CNPJ</p>
                        <p className="font-mono font-medium text-xs">{cliente.cpfCnpj}</p>
                      </div>
                    )}
                    {cliente?.contato && (
                      <div>
                        <p className="text-xs text-muted-foreground">Pessoa de Contato</p>
                        <p className="font-medium">{cliente.contato}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ item }: { item: Interaction }) {
  const iconMap: Record<string, React.ReactNode> = {
    nota: <FileText className="h-5 w-5" />,
    email_enviado: <Mail className="h-5 w-5" />,
    whatsapp_enviado: <MessageSquare className="h-5 w-5" />,
    status_mudou: <Target className="h-5 w-5" />,
    campanha: <Mail className="h-5 w-5" />,
  };

  return (
    <Card className="hover-elevate">
      <CardContent className="pt-4">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary flex-shrink-0">
            {iconMap[item.tipo] || <FileText className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-sm" data-testid={`timeline-item-title-${item.id}`}>
                  {item.titulo || item.tipo}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('pt-BR') : 'Data desconhecida'}
                </p>
              </div>
            </div>
            {item.texto && (
              <p className="text-sm text-muted-foreground mt-2 leading-relaxed break-words">
                {item.texto}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfileSkeleton() {
  return (
    <div className="h-screen flex flex-col">
      <div className="border-b px-4 py-3">
        <Skeleton className="h-6 w-32" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-64 border-r p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
        {/* Center */}
        <div className="flex-1 border-r p-6 space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="h-10 w-10 rounded-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ))}
        </div>
        {/* Right Sidebar */}
        <div className="w-80 border-l p-4 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
