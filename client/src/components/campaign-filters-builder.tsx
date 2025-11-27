import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar, AlertCircle } from "lucide-react";
import { DayPicker } from "react-day-picker";

export type CampaignFilters = {
  dataEnvioInicio?: Date;
  dataEnvioFim?: Date;
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
  const [dataEnvioInicio, setDataEnvioInicio] = useState<Date | undefined>();
  const [dataEnvioFim, setDataEnvioFim] = useState<Date | undefined>();
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [selectedCidades, setSelectedCidades] = useState<Set<string>>(new Set());
  const [selectedTipos, setSelectedTipos] = useState<Set<string>>(new Set());
  const [selectedCarteiras, setSelectedCarteiras] = useState<Set<string>>(new Set());
  const [semEtiqueta, setSemEtiqueta] = useState(false);

  const updateFilters = () => {
    const newFilters: CampaignFilters = {};
    
    if (dataEnvioInicio) {
      newFilters.dataEnvioInicio = dataEnvioInicio;
    }
    if (dataEnvioFim) {
      newFilters.dataEnvioFim = dataEnvioFim;
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
    setDataEnvioInicio(undefined);
    setDataEnvioFim(undefined);
    setSelectedTags(new Set());
    setSelectedCidades(new Set());
    setSelectedTipos(new Set());
    setSelectedCarteiras(new Set());
    setSemEtiqueta(false);
    setFilters({});
    onFiltersChange({});
  };

  const formatData = (data: Date | undefined) => {
    if (!data) return "";
    return data.toLocaleDateString("pt-BR");
  };

  const activeFilterCount = 
    (dataEnvioInicio || dataEnvioFim ? 1 : 0) +
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
        {/* Data de Envio - Range Picker */}
        <div className="space-y-3">
          <Label className="font-semibold">📅 Período de Envio</Label>
          <div className="flex gap-3 items-center flex-wrap">
            {/* Data Inicial */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto justify-start text-left font-normal border-slate-200 dark:border-slate-700 hover-elevate"
                  data-testid="button-data-inicio"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dataEnvioInicio ? formatData(dataEnvioInicio) : "Data Inicial"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" align="start">
                <div className="p-4">
                  <Label className="text-sm font-semibold mb-3 block">Selecione a data inicial:</Label>
                  <DayPicker
                    mode="single"
                    selected={dataEnvioInicio}
                    onSelect={setDataEnvioInicio}
                    disabled={(date) => date > new Date()}
                    className="[&_.rdp]:bg-transparent [&_.rdp-months]:m-0 [&_.rdp-month_table]:w-full [&_.rdp-cell]:w-full"
                  />
                </div>
              </PopoverContent>
            </Popover>

            <span className="text-slate-400">→</span>

            {/* Data Final */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto justify-start text-left font-normal border-slate-200 dark:border-slate-700 hover-elevate"
                  data-testid="button-data-fim"
                >
                  <Calendar className="mr-2 h-4 w-4" />
                  {dataEnvioFim ? formatData(dataEnvioFim) : "Data Final"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700" align="start">
                <div className="p-4">
                  <Label className="text-sm font-semibold mb-3 block">Selecione a data final:</Label>
                  <DayPicker
                    mode="single"
                    selected={dataEnvioFim}
                    onSelect={setDataEnvioFim}
                    disabled={(date) => date > new Date() || (dataEnvioInicio ? date < dataEnvioInicio : false)}
                    className="[&_.rdp]:bg-transparent [&_.rdp-months]:m-0 [&_.rdp-month_table]:w-full [&_.rdp-cell]:w-full"
                  />
                </div>
              </PopoverContent>
            </Popover>

            {(dataEnvioInicio || dataEnvioFim) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDataEnvioInicio(undefined);
                  setDataEnvioFim(undefined);
                }}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                data-testid="button-limpar-data"
              >
                ✕ Limpar
              </Button>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            Filtra clientes que receberam campanhas dentro do período selecionado
          </p>
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
                  className="cursor-pointer hover-elevate"
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
                  className="cursor-pointer hover-elevate"
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
                  className="cursor-pointer hover-elevate"
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
                  className="cursor-pointer hover-elevate"
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
