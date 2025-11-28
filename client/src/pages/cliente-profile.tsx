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
import { EditableField } from "@/components/EditableField";
import { AddClientNote } from "@/components/AddClientNote";
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild data-testid="button-back">
            <Link href="/clientes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="font-semibold text-lg">{cliente?.razaoSocial || "Cliente"}</h2>
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
        <div className="w-64 border-r bg-white dark:bg-slate-900 overflow-y-auto">
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
                      {cliente?.razaoSocial?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-sm" data-testid="text-cliente-nome">
                      {cliente?.razaoSocial}
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
        <div className="flex-1 border-r flex flex-col">
          {/* Timeline Header */}
          <div className="border-b px-6 py-4 bg-white dark:bg-slate-900">
            <h3 className="font-semibold text-sm">Histórico de Interações</h3>
          </div>

          {/* Timeline Feed */}
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-6">
              {/* Add Client Note Card */}
              {!clienteLoading && cliente && (
                <>
                  <AddClientNote clientId={cliente.id} />
                  <Separator className="my-4" />
                </>
              )}
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
        <div className="w-80 bg-white dark:bg-slate-900 border-l overflow-y-auto">
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
                    <EditableField
                      value={cliente?.email}
                      field="email"
                      clientId={id || ""}
                      label="Email"
                    />
                    <EditableField
                      value={cliente?.CELULAR_PRINCIPAL}
                      field="CELULAR_PRINCIPAL"
                      clientId={id || ""}
                      label="Telefone"
                    />
                    <EditableField
                      value={cliente?.contato}
                      field="contato"
                      clientId={id || ""}
                      label="Pessoa de Contato"
                    />
                  </div>
                )}
              </div>

              <Separator />

              {/* Business Information */}
              {!clienteLoading && cliente && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">NEGÓCIO</p>
                  <div className="space-y-2">
                    <EditableField
                      value={cliente?.razaoSocial}
                      field="razaoSocial"
                      clientId={id || ""}
                      label="Razão Social"
                    />
                    <EditableField
                      value={cliente?.carteira}
                      field="carteira"
                      clientId={id || ""}
                      label="Carteira"
                    />
                    <EditableField
                      value={cliente?.planoAtual}
                      field="planoAtual"
                      clientId={id || ""}
                      label="Plano"
                    />
                  </div>
                </div>
              )}

              <Separator />

              {/* Address Information */}
              {!clienteLoading && cliente && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">ENDEREÇO</p>
                  <div className="space-y-2">
                    <EditableField
                      value={cliente?.endereco}
                      field="endereco"
                      clientId={id || ""}
                      label="Endereço"
                    />
                    <EditableField
                      value={cliente?.numero}
                      field="numero"
                      clientId={id || ""}
                      label="Número"
                    />
                    <EditableField
                      value={cliente?.complemento}
                      field="complemento"
                      clientId={id || ""}
                      label="Complemento"
                    />
                    <EditableField
                      value={cliente?.cidade}
                      field="cidade"
                      clientId={id || ""}
                      label="Cidade"
                    />
                    <EditableField
                      value={cliente?.uf}
                      field="uf"
                      clientId={id || ""}
                      label="UF"
                    />
                    <EditableField
                      value={cliente?.cep}
                      field="cep"
                      clientId={id || ""}
                      label="CEP"
                    />
                  </div>
                </div>
              )}

              <Separator />

              {/* Additional Data */}
              {!clienteLoading && cliente && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground">DADOS ADICIONAIS</p>
                  <div className="space-y-2">
                    <EditableField
                      value={cliente?.cpfCnpj}
                      field="cpfCnpj"
                      clientId={id || ""}
                      label="CPF/CNPJ"
                    />
                    <EditableField
                      value={cliente?.observacoes}
                      field="observacoes"
                      clientId={id || ""}
                      label="Observações"
                    />
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
    <Card className="hover-elevate bg-card border-border">
      <CardContent className="pt-4">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
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
