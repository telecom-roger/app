import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";

export type CampaignFilters = {
  diasDesdeEnvio?: number;
  tags?: string[];
  semEtiqueta?: boolean;
  cidades?: string[];
  tipos?: string[];
  carteiras?: string[];
};

interface CampaignFiltersBuilderProps {
  onFiltersChange: (filters: CampaignFilters) => void;
  clientsCount?: number;
  allTags?: string[];
  allCidades?: string[];
  allTipos?: string[];
  allCarteiras?: string[];
}

export function CampaignFiltersBuilder({
  onFiltersChange,
  clientsCount = 0,
  allTags = [],
  allCidades = [],
  allTipos = [],
  allCarteiras = [],
}: CampaignFiltersBuilderProps) {
  const [filters, setFilters] = useState<CampaignFilters>({});
  const [diasDesdeEnvio, setDiasDesdeEnvio] = useState<string>("");
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedCidades, setSelectedCidades] = useState<Set<string>>(new Set());
  const [selectedTipos, setSelectedTipos] = useState<Set<string>>(new Set());
  const [selectedCarteiras, setSelectedCarteiras] = useState<Set<string>>(new Set());
  const [semEtiqueta, setSemEtiqueta] = useState(false);

  const updateFilters = () => {
    const newFilters: CampaignFilters = {};
    
    if (diasDesdeEnvio) {
      newFilters.diasDesdeEnvio = parseInt(diasDesdeEnvio);
    }
    if (selectedTags.size > 0) {
      newFilters.tags = Array.from(selectedTags);
    }
    if (selectedCidades.size > 0) {
      newFilters.cidades = Array.from(selectedCidades);
    }
    if (selectedTipos.size > 0) {
      newFilters.tipos = Array.from(selectedTipos);
    }
    if (selectedCarteiras.size > 0) {
      newFilters.carteiras = Array.from(selectedCarteiras);
    }
    if (semEtiqueta) {
      newFilters.semEtiqueta = true;
    }

    setFilters(newFilters);
    onFiltersChange(newFilters);
  };

  const toggleTag = (tag: string) => {
    const updated = new Set(selectedTags);
    if (updated.has(tag)) {
      updated.delete(tag);
    } else {
      updated.add(tag);
    }
    setSelectedTags(updated);
  };

  const toggleCidade = (cidade: string) => {
    const updated = new Set(selectedCidades);
    if (updated.has(cidade)) {
      updated.delete(cidade);
    } else {
      updated.add(cidade);
    }
    setSelectedCidades(updated);
  };

  const toggleTipo = (tipo: string) => {
    const updated = new Set(selectedTipos);
    if (updated.has(tipo)) {
      updated.delete(tipo);
    } else {
      updated.add(tipo);
    }
    setSelectedTipos(updated);
  };

  const toggleCarteira = (carteira: string) => {
    const updated = new Set(selectedCarteiras);
    if (updated.has(carteira)) {
      updated.delete(carteira);
    } else {
      updated.add(carteira);
    }
    setSelectedCarteiras(updated);
  };

  const resetFilters = () => {
    setDiasDesdeEnvio("");
    setSelectedTags(new Set());
    setSelectedCidades(new Set());
    setSelectedTipos(new Set());
    setSelectedCarteiras(new Set());
    setSemEtiqueta(false);
    setFilters({});
    onFiltersChange({});
  };

  const activeFilterCount = 
    (diasDesdeEnvio ? 1 : 0) +
    selectedTags.size +
    selectedCidades.size +
    selectedTipos.size +
    selectedCarteiras.size +
    (semEtiqueta ? 1 : 0);

  return (
    <Card className="bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-800">
      <CardHeader className="bg-slate-100 dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>🎯 Filtros Avançados de Campanha</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary">{activeFilterCount} ativo{activeFilterCount !== 1 ? "s" : ""}</Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-2">
              Combine filtros para atingir clientes específicos com precisão
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-6 space-y-6">
        {/* Dias desde último envio */}
        <div className="space-y-3">
          <Label className="font-semibold">📅 Enviado há quantos dias?</Label>
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                placeholder="Ex: 7, 30, 90..."
                value={diasDesdeEnvio}
                onChange={(e) => setDiasDesdeEnvio(e.target.value)}
                className="h-9"
                data-testid="input-dias-desde-envio"
              />
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Busca clientes que receberam campanhas há X dias
              </p>
            </div>
          </div>
        </div>

        {/* Sem Etiqueta (sem retorno) */}
        <div className="border-l-4 border-orange-400 bg-orange-50 dark:bg-orange-900/20 p-4 rounded">
          <div className="flex items-center gap-3">
            <Checkbox
              id="sem-etiqueta"
              checked={semEtiqueta}
              onCheckedChange={(checked) => setSemEtiqueta(!!checked)}
              data-testid="checkbox-sem-etiqueta"
            />
            <div className="flex-1">
              <Label htmlFor="sem-etiqueta" className="font-semibold cursor-pointer">
                🔍 Sem Etiqueta (Sem Retorno)
              </Label>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                Seleciona clientes que receberam campanha mas não responderam
              </p>
            </div>
          </div>
        </div>

        {/* Tags / Etiquetas */}
        {allTags.length > 0 && (
          <div className="space-y-3">
            <Label className="font-semibold">🏷️ Etiquetas dos Clientes</Label>
            <div className="flex flex-wrap gap-2">
              {allTags.map((tag) => (
                <Badge
                  key={tag}
                  variant={selectedTags.has(tag) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTag(tag)}
                  data-testid={`badge-tag-${tag}`}
                >
                  {tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Tipos */}
        {allTipos.length > 0 && (
          <div className="space-y-3">
            <Label className="font-semibold">📱 Tipos de Cliente</Label>
            <div className="flex flex-wrap gap-2">
              {allTipos.map((tipo) => (
                <Badge
                  key={tipo}
                  variant={selectedTipos.has(tipo) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleTipo(tipo)}
                  data-testid={`badge-tipo-${tipo}`}
                >
                  {tipo}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Carteiras */}
        {allCarteiras.length > 0 && (
          <div className="space-y-3">
            <Label className="font-semibold">👤 Carteiras</Label>
            <div className="flex flex-wrap gap-2">
              {allCarteiras.map((carteira) => (
                <Badge
                  key={carteira}
                  variant={selectedCarteiras.has(carteira) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleCarteira(carteira)}
                  data-testid={`badge-carteira-${carteira}`}
                >
                  {carteira}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Cidades */}
        {allCidades.length > 0 && (
          <div className="space-y-3">
            <Label className="font-semibold">🏙️ Cidades</Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {allCidades.map((cidade) => (
                <Badge
                  key={cidade}
                  variant={selectedCidades.has(cidade) ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => toggleCidade(cidade)}
                  data-testid={`badge-cidade-${cidade}`}
                >
                  {cidade}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Info Box */}
        {activeFilterCount > 0 && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">
                Filtros Aplicados: {activeFilterCount} critério{activeFilterCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">
                Os filtros serão usados para segmentar os clientes. Combinando múltiplos filtros você terá resultados mais específicos.
              </p>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
          <Button
            variant="outline"
            onClick={resetFilters}
            disabled={activeFilterCount === 0}
            size="sm"
            data-testid="button-limpar-filtros"
          >
            ✕ Limpar Filtros
          </Button>
          <Button
            onClick={updateFilters}
            className="bg-blue-600 hover:bg-blue-700"
            size="sm"
            data-testid="button-aplicar-filtros"
          >
            ✓ Aplicar Filtros
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
