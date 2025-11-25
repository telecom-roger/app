import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, GripVertical, User, DollarSign } from "lucide-react";
import type { Opportunity } from "@shared/schema";

const colunas = [
  { id: "lead", titulo: "Lead", cor: "bg-blue-500" },
  { id: "contato", titulo: "Contato Realizado", cor: "bg-yellow-500" },
  { id: "proposta", titulo: "Proposta Enviada", cor: "bg-purple-500" },
  { id: "fechado", titulo: "Fechado", cor: "bg-green-500" },
  { id: "perdido", titulo: "Perdido", cor: "bg-red-500" },
];

export default function Kanban() {
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>("todos");

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

  const { data: oportunidades, isLoading } = useQuery<Opportunity[]>({
    queryKey: [
      "/api/opportunities",
      filtroResponsavel !== "todos" ? { responsavel: filtroResponsavel } : null,
    ].filter(Boolean),
    enabled: isAuthenticated,
  });

  const moveCardMutation = useMutation({
    mutationFn: async ({ id, etapa }: { id: string; etapa: string }) => {
      await apiRequest("PATCH", `/api/opportunities/${id}/move`, { etapa });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      toast({
        title: "Sucesso",
        description: "Oportunidade movida com sucesso",
      });
    },
    onError: (error: Error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Não autorizado",
          description: "Você foi desconectado. Fazendo login novamente...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Erro",
        description: "Não foi possível mover a oportunidade",
        variant: "destructive",
      });
    },
  });

  const oportunidadesPorEtapa = colunas.map(coluna => ({
    ...coluna,
    oportunidades: (oportunidades || []).filter(op => op.etapa === coluna.id),
  }));

  if (authLoading || !isAuthenticated) {
    return <KanbanSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Oportunidades</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie seu funil de vendas
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={filtroResponsavel} onValueChange={setFiltroResponsavel}>
            <SelectTrigger className="w-48" data-testid="select-responsavel">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value={user?.id ? String(user.id) : ""}>Minhas oportunidades</SelectItem>
            </SelectContent>
          </Select>
          <Button data-testid="button-nova-oportunidade">
            <Plus className="h-4 w-4 mr-2" />
            Nova Oportunidade
          </Button>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {oportunidadesPorEtapa.map((coluna) => (
            <KanbanColumn
              key={coluna.id}
              coluna={coluna}
              isLoading={isLoading}
              onMoveCard={moveCardMutation.mutate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ 
  coluna, 
  isLoading,
  onMoveCard,
}: { 
  coluna: { id: string; titulo: string; cor: string; oportunidades: Opportunity[] };
  isLoading: boolean;
  onMoveCard: (data: { id: string; etapa: string }) => void;
}) {
  return (
    <div className="flex-shrink-0 w-80">
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${coluna.cor}`} />
              <h3 className="font-semibold">{coluna.titulo}</h3>
            </div>
            <Badge variant="secondary" className="ml-auto">
              {coluna.oportunidades.length}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-y-auto max-h-[calc(100vh-300px)]">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))
          ) : coluna.oportunidades.length > 0 ? (
            coluna.oportunidades.map((oportunidade) => (
              <OpportunityCard 
                key={oportunidade.id} 
                oportunidade={oportunidade}
                onMove={onMoveCard}
              />
            ))
          ) : (
            <div className="text-center py-8 text-sm text-muted-foreground">
              Nenhuma oportunidade
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function OpportunityCard({ 
  oportunidade,
  onMove,
}: { 
  oportunidade: Opportunity;
  onMove: (data: { id: string; etapa: string }) => void;
}) {
  return (
    <Card 
      className="cursor-move hover-elevate active-elevate-2"
      data-testid={`card-oportunidade-${oportunidade.id}`}
      draggable
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium leading-snug flex-1">{oportunidade.titulo}</h4>
          <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        </div>

        {oportunidade.valorEstimado && (
          <div className="flex items-center gap-2 text-sm">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold text-primary">
              R$ {(oportunidade.valorEstimado / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          {oportunidade.prazo && (
            <span>
              Prazo: {new Date(oportunidade.prazo).toLocaleDateString('pt-BR')}
            </span>
          )}
          {oportunidade.responsavelId && (
            <div className="flex items-center gap-1">
              <User className="h-3 w-3" />
              <span>Atribuído</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function KanbanSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>
      <div className="flex gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i} className="w-80">
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
  );
}
