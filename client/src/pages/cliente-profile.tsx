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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <div className="border-b px-4 py-3 flex items-center justify-between bg-white dark:bg-slate-900">
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
                      {cliente?.nome?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-semibold text-sm" data-testid="text-cliente-nome">
                      {cliente?.nome}
                    </h3>
                    {cliente?.status && (
                      <div className="mt-1" data-testid="badge-status">
                        <Badge 
                          variant="outline" 
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
                  className="w-full justify-start text-sm" 
                  onClick={() => navigate(`/chat?clientId=${id}`)}
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
                {cliente && <CreateOpportunityPopover client={cliente} />}
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm"
                  data-testid="button-add-nota"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Adicionar Nota
                </Button>
                <Button 
                  variant="ghost" 
                  className="w-full justify-start text-sm bg-orange-50 dark:bg-orange-950 hover:bg-orange-100 dark:hover:bg-orange-900"
                  onClick={() => manualFollowUpMutation.mutate()}
                  disabled={manualFollowUpMutation.isPending}
                  data-testid="button-aguardando-atencao"
                >
                  <CheckCircle className="h-4 w-4 mr-2 text-orange-600 dark:text-orange-400" />
                  <span className="text-orange-700 dark:text-orange-300">Aguardando Atenção</span>
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
              {timelineLoading || notesLoading ? (
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
              ) : clientNotes && clientNotes.length > 0 ? (
                <div className="space-y-4">
                  {/* Mostrar client notes primeiro (mais recentes no topo) */}
                  {clientNotes.map((note) => (
                    <ClientNoteItem key={note.id} note={note} clientId={id || ""} />
                  ))}
                  {/* Depois mostrar timeline items */}
                  {timeline && timeline.length > 0 && (
                    <>
                      <Separator className="my-4" />
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
                  <Badge className={`w-full justify-center ${STATUS_COLORS[cliente.status] || 'bg-slate-200 text-slate-800'}`}>
                    {cliente?.status.toUpperCase()}
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
                      value={cliente?.celular}
                      field="celular"
                      clientId={id || ""}
                      label="Telefone"
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
                      value={cliente?.carteira}
                      field="carteira"
                      clientId={id || ""}
                      label="Carteira"
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
                      value={cliente?.cnpj}
                      field="cnpj"
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

function TimelineItem({ item }: { item: any }) {
  const iconMap: Record<string, React.ReactNode> = {
    nota: <FileText className="h-5 w-5" />,
    email_enviado: <Mail className="h-5 w-5" />,
    whatsapp_enviado: <MessageSquare className="h-5 w-5" />,
    status_mudou: <Target className="h-5 w-5" />,
    etapa_mudou: <Target className="h-5 w-5" />,
    campanha: <Mail className="h-5 w-5" />,
  };

  // Format date: "30/11/2025, 03:37"
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

  // Get tipo movimento from meta
  const tipoMovimento = (item.meta as any)?.tipo_movimento || item.origem;
  const userName = item.userName || 'Sistema';
  const isAutomation = tipoMovimento === 'automática' || item.origem === 'system' || item.origem === 'automation';

  return (
    <Card className="hover-elevate bg-white dark:bg-white border-border">
      <CardContent className="pt-4">
        <div className="flex gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
            {iconMap[item.tipo] || <FileText className="h-5 w-5" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-semibold text-xs text-slate-900" data-testid={`timeline-item-title-${item.id}`}>
                  {item.titulo || item.tipo}
                </h4>
                <div className="flex items-center gap-1 flex-wrap mt-1">
                  <p className="text-[10px] text-slate-600">
                    {formatDate(item.createdAt)} - {isAutomation ? (
                      <span className="italic">por IA</span>
                    ) : (
                      <>por {userName}</>
                    )}
                  </p>
                </div>
              </div>
            </div>
            {item.texto && (
              <p className="text-xs text-slate-600 mt-2 leading-relaxed break-words">
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
