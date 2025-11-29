import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target } from "lucide-react";
import type { Client, KanbanStage } from "@shared/schema";

interface CreateOpportunityPopoverProps {
  client: Client;
}

const ETAPA_LABELS: Record<string, string> = {
  lead: "Lead",
  contato: "Contato",
  proposta: "Proposta",
  fechado: "Fechado",
  perdido: "Perdido",
};

export function CreateOpportunityPopover({ client }: CreateOpportunityPopoverProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [etapa, setEtapa] = useState("lead");
  const [valor, setValor] = useState("");

  // Fetch kanban stages for etapas
  const { data: stages = [] } = useQuery<KanbanStage[]>({
    queryKey: ["/api/kanban-stages"],
    refetchInterval: 5000,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/opportunities", {
        clientId: client.id,
        titulo: titulo || client.nome,
        etapa,
        valorEstimado: valor || "",
        responsavelId: client.createdBy,
      });
      return res.json();
    },
    onSuccess: async (opp) => {
      // Create interaction/timeline entry
      try {
        const etapaLabel = ETAPA_LABELS[etapa] || etapa;
        const interactionRes = await apiRequest("POST", `/api/interactions`, {
          clientId: client.id,
          tipo: "oportunidade_criada",
          origem: "user",
          titulo: `Oportunidade de Negócio - ${etapaLabel}`,
          texto: `${valor ? `Valor: ${valor}` : ""}`,
          meta: {
            opportunityId: opp.id,
            etapa,
            titulo: titulo || client.nome,
            valor: valor || "",
          },
          createdBy: user?.id,
        });
        
        const newInteraction = await interactionRes.json();
        
        // Update timeline cache immediately in real-time
        queryClient.setQueryData(["/api/timeline", client.id], (oldData: any[] = []) => {
          return [newInteraction, ...oldData];
        });
      } catch (error) {
        console.error("Erro ao criar timeline entry:", error);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/opportunities"] });
      
      setTitulo("");
      setEtapa("lead");
      setValor("");
      setShowSuccess(true);

      toast({
        title: "Sucesso",
        description: "Oportunidade criada!",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro",
        description: error.message || "Falha ao criar oportunidade",
        variant: "destructive",
      });
    },
  });

  const handleSave = () => {
    if (!etapa.trim()) {
      toast({
        title: "Erro",
        description: "Selecione uma etapa",
        variant: "destructive",
      });
      return;
    }
    mutation.mutate();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          className="w-full justify-start text-sm"
          data-testid="button-criar-oportunidade"
        >
          <Target className="h-4 w-4 mr-2" />
          Criar Oportunidade
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4 bg-background border border-border shadow-lg" align="start">
        <div className="space-y-3">
          <h4 className="font-semibold text-sm">Nova Oportunidade</h4>
          
          {/* Nome - Auto-filled */}
          <div>
            <label className="text-xs font-medium mb-1 block">Nome do Cliente</label>
            <Input
              value={client.nome}
              disabled
              className="text-xs h-8 bg-muted"
              data-testid="input-nome-cliente"
            />
          </div>

          {/* Título */}
          <div>
            <label className="text-xs font-medium mb-1 block">Título</label>
            <Input
              placeholder="Título da oportunidade"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="text-xs h-8"
              data-testid="input-titulo-oportunidade"
            />
          </div>

          {/* Etapa */}
          <div>
            <label className="text-xs font-medium mb-1 block">Etapa</label>
            <Select value={etapa} onValueChange={setEtapa}>
              <SelectTrigger className="text-xs h-8" data-testid="select-etapa">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {stages.sort((a, b) => a.ordem - b.ordem).map((stage) => (
                  <SelectItem key={stage.id} value={stage.titulo} data-testid={`option-stage-${stage.id}`}>
                    {stage.titulo}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Valor */}
          <div>
            <label className="text-xs font-medium mb-1 block">Valor Estimado</label>
            <Input
              placeholder="R$ 0,00"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="text-xs h-8"
              data-testid="input-valor-oportunidade"
            />
          </div>

          {/* Success State */}
          {showSuccess && (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded p-2 text-xs">
              <p className="text-green-700 dark:text-green-300 font-medium">✓ Oportunidade criada com sucesso!</p>
              <p className="text-green-600 dark:text-green-400 text-xs mt-1">Uma entrada foi adicionada na timeline.</p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-2 justify-end pt-2">
            {showSuccess ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    setShowSuccess(false);
                  }}
                  className="text-xs h-7"
                  data-testid="button-fechar-oportunidade"
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setOpen(false);
                    setShowSuccess(false);
                    navigate("/oportunidades");
                  }}
                  className="text-xs h-7"
                  data-testid="button-ver-kanban"
                >
                  Ver no Kanban
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="text-xs h-7"
                  data-testid="button-cancelar-oportunidade"
                >
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={mutation.isPending}
                  className="text-xs h-7"
                  data-testid="button-salvar-oportunidade"
                >
                  {mutation.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
