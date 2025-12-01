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
    <div className="h-screen flex flex-col bg-background dark:bg-slate-950">
      {/* Header */}
      <div className="border-b px-4 py-3 flex items-center justify-between bg-white dark:bg-slate-900">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" asChild data-testid="button-back" className="h-8 w-8">
            <Link href="/clientes">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <h2 className="font-semibold text-lg truncate">{cliente?.nome || "Cliente"}</h2>
        </div>
        <Button size="icon" variant="ghost" data-testid="button-options" className="h-8 w-8">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </div>

      {/* Main Content - Single Column Responsive */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="max-w-4xl mx-auto w-full p-4">
          {clienteLoading ? (
            <ProfileSkeleton />
          ) : cliente ? (
            <div className="space-y-4">
              {/* Client Card */}
              <Card className="bg-white dark:bg-slate-900">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-4">
                    <Avatar className="h-16 w-16 flex-shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                        {cliente.nome?.[0]?.toUpperCase() || "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-lg" data-testid="text-cliente-nome">
                        {cliente.nome}
                      </h3>
                      {cliente.status && (
                        <div className="mt-2" data-testid="badge-status">
                          <Badge className={STATUS_COLORS[cliente.status] || 'bg-slate-200 text-slate-800'}>
                            {cliente.status.toUpperCase()}
                          </Badge>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card className="bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-base">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-2">
                    <Button 
                      variant="default" 
                      size="sm"
                      className="justify-start"
                      onClick={() => navigate(`/chat?clientId=${id}`)}
                      data-testid="button-enviar-whatsapp"
                    >
                      <MessageSquare className="h-4 w-4 mr-2" />
                      WhatsApp
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="justify-start"
                      data-testid="button-enviar-email"
                    >
                      <Mail className="h-4 w-4 mr-2" />
                      Email
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="justify-start"
                      onClick={() => navigate(`/clientes/editar/${id}`)}
                      data-testid="button-edit-cliente"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                    {cliente && <CreateOpportunityPopover client={cliente} />}
                  </div>
                </CardContent>
              </Card>

              {/* Contact Information */}
              <Card className="bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-base">Informações de Contato</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">TELEFONE</p>
                    <p className="text-sm font-medium">{cliente.celular || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">EMAIL</p>
                    <p className="text-sm font-medium break-all">{cliente.email || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">CARTEIRA</p>
                    <p className="text-sm font-medium">{cliente.carteira || '-'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Address Information */}
              <Card className="bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-base">Endereço</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">ENDEREÇO</p>
                    <p className="text-sm font-medium">{cliente.endereco || '-'}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">NÚMERO</p>
                      <p className="text-sm font-medium">{cliente.numero || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">CIDADE</p>
                      <p className="text-sm font-medium">{cliente.cidade || '-'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">UF</p>
                      <p className="text-sm font-medium">{cliente.uf || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">CEP</p>
                      <p className="text-sm font-medium">{cliente.cep || '-'}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Additional Information */}
              <Card className="bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-base">Dados Adicionais</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">CPF/CNPJ</p>
                    <p className="text-sm font-medium">{cliente.cnpj || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">OBSERVAÇÕES</p>
                    <p className="text-sm font-medium">{cliente.observacoes || '-'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Tags */}
              {cliente.tags && cliente.tags.length > 0 && (
                <Card className="bg-white dark:bg-slate-900">
                  <CardHeader>
                    <CardTitle className="text-base">Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {cliente.tags.map((tag, i) => (
                        <Badge key={i} variant="secondary" className="cursor-pointer hover-elevate">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Timeline */}
              <Card className="bg-white dark:bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-base">Histórico de Interações</CardTitle>
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

  return (
    <div className="flex gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary flex-shrink-0">
        {iconMap[item.tipo] || <FileText className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-sm" data-testid={`timeline-item-title-${item.id}`}>
          {item.titulo || item.tipo}
        </h4>
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
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
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
