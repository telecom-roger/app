import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EditableFieldProps {
  value: string | null | undefined;
  field: string;
  clientId: string;
  label: string;
  onSave?: (newValue: string) => void;
}

export function EditableField({
  value = "",
  field,
  clientId,
  label,
  onSave,
}: EditableFieldProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [isLoading, setIsLoading] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const { toast } = useToast();

  // Sincronizar quando o valor prop muda
  useEffect(() => {
    setInputValue(value || "");
  }, [value]);

  // Detectar se o texto foi truncado (line-clamp)
  useEffect(() => {
    if (textRef.current) {
      setIsTruncated(
        textRef.current.scrollHeight > textRef.current.clientHeight
      );
    }
  }, [inputValue]);

  const handleSave = async () => {
    if (inputValue === (value || "")) {
      setIsEditing(false);
      return;
    }

    try {
      setIsLoading(true);
      await apiRequest("PATCH", `/api/clients/${clientId}`, {
        [field]: inputValue,
      });

      toast({
        title: "Sucesso",
        description: `${label} atualizado com sucesso`,
      });

      onSave?.(inputValue);
      queryClient.invalidateQueries({ queryKey: ["/api/clients", clientId] });
      setIsEditing(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSave();
    } else if (e.key === "Escape") {
      setInputValue(value || "");
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          disabled={isLoading}
          autoFocus
          className="h-8 text-sm"
          data-testid={`input-edit-${field}`}
        />
        {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>
    );
  }

  const displayText = inputValue || "-";
  const content = (
    <div
      onClick={() => setIsEditing(true)}
      className="cursor-pointer hover:bg-muted/50 p-1.5 rounded transition-colors min-w-0"
      data-testid={`field-${field}`}
    >
      <p className="text-xs text-muted-foreground truncate">{label}</p>
      <p
        ref={textRef}
        className="font-medium text-sm break-words line-clamp-2"
      >
        {inputValue && (
          <span>{inputValue}</span>
        )}
        {!inputValue && (
          <span className="text-muted-foreground">-</span>
        )}
      </p>
    </div>
  );

  if (isTruncated && inputValue) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {content}
          </TooltipTrigger>
          <TooltipContent side="right" className="max-w-xs break-words">
            {inputValue}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
