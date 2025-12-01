import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
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
  CheckCircle,
} from "lucide-react";
import { EditableField } from "@/components/EditableField";
import { SelectableField } from "@/components/SelectableField";
import { AddClientNote } from "@/components/AddClientNote";
import { ClientNoteItem } from "@/components/ClientNoteItem";
import { CreateOpportunityPopover } from "@/components/CreateOpportunityPopover";
import type { Client, Interaction, ClientNote } from "@shared/schema";

const STATUS_COLORS: Record<string, string> = {
  lead_quente: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  engajado: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  em_negociacao: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  em_fechamento: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  ativo: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  perdido: "bg-slate-100 text-slate-800 dark:bg-slate-900 dark:text-slate-200",
  remarketing: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200",
};

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
    refetchOnWindowFocus: true,
  });

  const { data: clientNotes, isLoading: notesLoading } = useQuery<ClientNote[]>({
    queryKey: ["/api/client-notes", id],
    enabled: isAuthenticated && !!id,
  });

  const manualFollowUpMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/clients/${id}/manual-follow-up`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/timeline", id] });
      toast({
        title: "Sucesso",
        description: "Cliente marcado como 'Aguardando Atenção'",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível marcar como 'Aguardando Atenção'",
        variant: "destructive",
      });
    },
  });

  if (authLoading || !isAuthenticated) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header */}
      <div className="border-b px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <Button variant="ghost" size="sm" asChild data-testid="button-back" className="h-8 w-8 sm:h-9 sm:w-9">
            <Link href="/clientes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="font-semibold text-sm sm:text-lg truncate">{cliente?.nome || "Cliente"}</h2>
        </div>
        <Button size="icon" variant="ghost" data-testid="button-options" className="h-8 w-8 sm:h-9 sm:w-9">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Layout - Responsive Grid (Sidebar + Content) */}
      <div className="flex flex-1 overflow-hidden gap-0">
        {/* LEFT SIDEBAR - Profile & Actions (Hidden on Mobile) */}
        <div className="hidden lg:flex lg:w-80 border-r bg-white dark:bg-slate-900 overflow-y-auto flex-col">
          <ScrollArea className="h-full">
            <div className="p-4 sm:p-6 space-y-6">
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
                      <div className="mt-2" data-testid="badge-status">
                        <Badge 
                          className={`text-xs ${STATUS_COLORS[cliente.status] || 'bg-slate-200 text-slate-800'}`}
                        >
                          {cliente.status.toUpperCase()}
                        </Badge>
                      </div>
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
                  className="w-full justify-start text-sm h-9"
                  onClick={() => navigate(`/chat?clientId=${id}`)}
                  data-testid="button-enviar-whatsapp"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Enviar WhatsApp
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm h-9"
                  data-testid="button-enviar-email"
                >
                  <Mail className="h-4 w-4 mr-2" />
                  Enviar Email
                </Button>
                {cliente && <CreateOpportunityPopover client={cliente} />}
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm h-9"
                  onClick={() => navigate(`/clientes/editar/${id}`)}
                  data-testid="button-edit-cliente"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar Cliente
                </Button>
              </div>

              <Separator />

              {/* Contact Information */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground px-2">INFORMAÇÕES DE CONTATO</p>
                <EditableField
                  value={cliente?.celular}
                  field="celular"
                  clientId={id || ""}
                  label="Telefone"
                  data-testid="field-celular"
                />
                <EditableField
                  value={cliente?.email}
                  field="email"
                  clientId={id || ""}
                  label="Email"
                  data-testid="field-email"
                />
                <SelectableField
                  value={cliente?.carteira}
                  field="carteira"
                  clientId={id || ""}
                  label="Carteira"
                  endpoint="/api/clients/carteiras"
                  data-testid="field-carteira"
                />
              </div>

              <Separator />

              {/* Address Information */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground px-2">ENDEREÇO</p>
                <EditableField
                  value={cliente?.endereco}
                  field="endereco"
                  clientId={id || ""}
                  label="Rua"
                  data-testid="field-endereco"
                />
                <div className="grid grid-cols-2 gap-2">
                  <EditableField
                    value={cliente?.numero}
                    field="numero"
                    clientId={id || ""}
                    label="Número"
                    data-testid="field-numero"
                  />
                  <EditableField
                    value={cliente?.cep}
                    field="cep"
                    clientId={id || ""}
                    label="CEP"
                    data-testid="field-cep"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <EditableField
                    value={cliente?.cidade}
                    field="cidade"
                    clientId={id || ""}
                    label="Cidade"
                    data-testid="field-cidade"
                  />
                  <EditableField
                    value={cliente?.uf}
                    field="uf"
                    clientId={id || ""}
                    label="UF"
                    data-testid="field-uf"
                  />
                </div>
              </div>

              <Separator />

              {/* Additional Information */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-muted-foreground px-2">DADOS ADICIONAIS</p>
                <EditableField
                  value={cliente?.cnpj}
                  field="cnpj"
                  clientId={id || ""}
                  label="CPF/CNPJ"
                  data-testid="field-cnpj"
                />
                <EditableField
                  value={cliente?.observacoes}
                  field="observacoes"
                  clientId={id || ""}
                  label="Observações"
                  data-testid="field-observacoes"
                />
              </div>

              {/* Tags */}
              {cliente?.tags && cliente.tags.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-3">
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

        {/* RIGHT CONTENT - Timeline & Feed */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="max-w-3xl w-full p-3 sm:p-6 mx-auto">
              {clienteLoading ? (
                <ProfileSkeleton />
              ) : cliente ? (
                <div className="space-y-4 sm:space-y-6">
                  {/* Mobile: Client Card (only shown on mobile) */}
                  <div className="lg:hidden">
                    <Card className="bg-white dark:bg-slate-800">
                      <CardContent className="pt-6">
                        <div className="flex items-start gap-4">
                          <Avatar className="h-14 w-14 flex-shrink-0">
                            <AvatarFallback className="bg-primary text-primary-foreground text-base">
                              {cliente.nome?.[0]?.toUpperCase() || "?"}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-base" data-testid="text-cliente-nome-mobile">
                              {cliente.nome}
                            </h3>
                            {cliente.status && (
                              <div className="mt-2" data-testid="badge-status-mobile">
                                <Badge className={`text-xs ${STATUS_COLORS[cliente.status] || 'bg-slate-200 text-slate-800'}`}>
                                  {cliente.status.toUpperCase()}
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Mobile: Quick Actions (only shown on mobile) */}
                  <div className="lg:hidden">
                    <Card className="bg-white dark:bg-slate-800">
                      <CardContent className="pt-4">
                        <div className="grid grid-cols-2 gap-2">
                          <Button 
                            variant="default" 
                            size="sm"
                            className="justify-center text-xs sm:text-sm h-9 sm:h-10"
                            onClick={() => navigate(`/chat?clientId=${id}`)}
                            data-testid="button-enviar-whatsapp-mobile"
                          >
                            <MessageSquare className="h-4 w-4 mr-1" />
                            WhatsApp
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="justify-center text-xs sm:text-sm h-9 sm:h-10"
                            data-testid="button-enviar-email-mobile"
                          >
                            <Mail className="h-4 w-4 mr-1" />
                            Email
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="justify-center text-xs sm:text-sm h-9 sm:h-10"
                            onClick={() => navigate(`/clientes/editar/${id}`)}
                            data-testid="button-edit-cliente-mobile"
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          {cliente && <CreateOpportunityPopover client={cliente} />}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Timeline/Feed Card */}
                  <Card className="bg-white dark:bg-slate-800">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-base sm:text-lg">Histórico de Interações</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {!clienteLoading && cliente && (
                        <>
                          <AddClientNote clientId={cliente.id} />
                          <Separator />
                        </>
                      )}

                      {timelineLoading || notesLoading ? (
                        <div className="space-y-4">
                          {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex gap-3">
                              <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
                              <div className="flex-1 space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-16 w-full" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : clientNotes && clientNotes.length > 0 ? (
                        <div className="space-y-4">
                          {clientNotes.map((note) => (
                            <ClientNoteItem key={note.id} note={note} clientId={id || ""} />
                          ))}
                          {timeline && timeline.length > 0 && (
                            <>
                              <Separator />
                              {timeline.map((item) => (
                                <TimelineItem key={item.id} item={item} />
                              ))}
                            </>
                          )}
                        </div>
                      ) : timeline && timeline.length > 0 ? (
                        <div className="space-y-4">
                          {timeline.map((item) => (
                            <TimelineItem key={item.id} item={item} />
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                          <p className="text-sm text-muted-foreground">Nenhuma interação registrada</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            As interações com este cliente aparecerão aqui
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ item }: { item: any }) {
  const iconMap: Record<string, React.ReactNode> = {
    nota: <FileText className="h-5 w-5" />,
    email_enviado: <Mail className="h-5 w-5" />,
    whatsapp_enviado: <MessageSquare className="h-5 w-5" />,
    status_mudou: <Target className="h-5 w-5" />,
    etapa_mudou: <Target className="h-5 w-5" />,
    oportunidade_criada: <Target className="h-5 w-5" />,
    campanha: <Mail className="h-5 w-5" />,
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return 'Data desconhecida';
    const d = new Date(date);
    return d.toLocaleString('pt-BR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const tipoMovimento = (item.meta as any)?.tipo_movimento || item.origem;
  const userName = item.userName || 'Sistema';
  const isAutomation = tipoMovimento === 'automática' || item.origem === 'system' || item.origem === 'automation';
  const metaData = item.meta as any;
  const origem = metaData?.origem_disparo || metaData?.origem;

  return (
    <div className="flex gap-3 sm:gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
        {iconMap[item.tipo] || <FileText className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h4 className="font-semibold text-sm" data-testid={`timeline-item-title-${item.id}`}>
            {item.titulo || item.tipo}
          </h4>
          {origem && (
            <Badge variant="outline" className="text-xs">
              {origem === 'envio_imediato' ? '⚡ Imediato' : '📅 Agendado'}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {formatDate(item.createdAt)} - {isAutomation ? (
            <span className="italic">por IA</span>
          ) : (
            <>por {userName}</>
          )}
        </p>
        {item.texto && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed break-words">
            {item.texto}
          </p>
        )}
        {metaData?.status && (
          <div className="mt-2">
            <Badge className={`text-xs ${metaData.status === 'enviado' ? 'bg-green-500' : metaData.status === 'erro' ? 'bg-red-500' : 'bg-yellow-500'}`}>
              {metaData.status === 'enviado' ? '✅ Enviado' : metaData.status === 'erro' ? '❌ Erro' : '⏳ Pendente'}
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Skeleton className="h-14 w-14 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
