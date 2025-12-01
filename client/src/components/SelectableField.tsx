import { useState, useRef, useEffect } from "react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
  const [isTruncated, setIsTruncated] = useState(false);
  const valueRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Detectar se valor é truncado
  useEffect(() => {
    if (valueRef.current) {
      setIsTruncated(
        valueRef.current.scrollWidth > valueRef.current.clientWidth
      );
    }
  }, [value]);

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

  // Always include current value in the options - ensure it appears even if not in the API list
  const allOptions = [
    ...(value && !options.includes(value) ? [value] : []),
    ...options,
  ];

  const content = (
    <div
      className="cursor-pointer hover:bg-muted/50 p-1.5 rounded transition-colors min-w-0"
      data-testid={testId || `field-${field}`}
    >
      <p className="text-xs text-muted-foreground mb-2 truncate">{label}</p>
      <Select value={value || ""} onValueChange={handleSave} disabled={isLoading}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue placeholder="Selecione uma carteira..." />
        </SelectTrigger>
        <SelectContent>
          {allOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isLoading && <Loader2 className="h-4 w-4 animate-spin mt-1" />}
    </div>
  );

  if (isTruncated && value) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div ref={valueRef} className="truncate">
              {content}
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs break-words">
            {value}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
