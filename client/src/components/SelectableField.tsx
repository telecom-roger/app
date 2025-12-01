import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface SelectableFieldProps {
  value: string | null | undefined;
  field: string;
  clientId: string;
  label: string;
  endpoint: string;
  onSave?: (newValue: string) => void;
  "data-testid"?: string;
}

export function SelectableField({
  value = "",
  field,
  clientId,
  label,
  endpoint,
  onSave,
  "data-testid": testId,
}: SelectableFieldProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const { data: options = [] } = useQuery<string[]>({
    queryKey: [endpoint],
  });

  const handleSave = async (newValue: string) => {
    if (newValue === (value || "")) {
      return;
    }

    try {
      setIsLoading(true);
      await apiRequest("PATCH", `/api/clients/${clientId}`, {
        [field]: newValue,
      });

      toast({
        title: "Sucesso",
        description: `${label} atualizado com sucesso`,
      });

      onSave?.(newValue);
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao salvar",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Always include current value in the options
  const uniqueOptions = new Set([
    value ?? undefined, // Include current value even if undefined
    ...options,
  ]);
  const allOptions = Array.from(uniqueOptions).filter((opt) => opt !== undefined);

  const displayValue = value ?? "";

  return (
    <div
      className="cursor-pointer hover:bg-muted/50 p-1.5 rounded transition-colors"
      data-testid={testId || `field-${field}`}
    >
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <Select value={displayValue} onValueChange={handleSave} disabled={isLoading}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {allOptions.length > 0 ? (
            allOptions.map((option) => (
              <SelectItem key={option || "empty"} value={option || ""}>
                {option || "Sem carteira"}
              </SelectItem>
            ))
          ) : (
            <SelectItem value="" disabled>
              Carregando...
            </SelectItem>
          )}
        </SelectContent>
      </Select>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin mt-1" />}
    </div>
  );
}
