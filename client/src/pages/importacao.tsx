import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileText,
  Users,
  Loader2,
  Download,
  Package,
} from "lucide-react";
import Papa from "papaparse";

type Step = 1 | 2 | 3 | 4;

interface FileData {
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  nome: number;
  cnpj: number;
  status: number;
  carteira: number;
  tipo: number;
  categoria: number;
  score: number;
  planoAtual: number;
  produtoAtual: number;
  celular: number;
  email: number;
  contato: number;
  endereco: number;
  numero: number;
  complemento: number;
  cep: number;
  cidade: number;
  uf: number;
  dataContrato: number;
  valorContrato: number;
  dataUltimoContato: number;
  observacoes: number;
  APARELHO_LIBERADO: number;
  PEDIDO_MOVEL: number;
  M_FIXA: number;
  PEDIDO_FIXA: number;
  NOME_CONTATO: number;
  TIPO_GESTOR: number;
  FLG_DOMINIO_PUBLICO_SFA: number;
  telefone2: number;
  TELEFONE_RESIDENCIAL: number;
  EMAIL_SIBEL: number;
  PROP_MOVEL_AVANCADA: number;
}

const createDefaultMapping = (): ColumnMapping => ({
  nome: -1,
  cnpj: -1,
  status: -1,
  carteira: -1,
  tipo: -1,
  categoria: -1,
  score: -1,
  planoAtual: -1,
  produtoAtual: -1,
  celular: -1,
  email: -1,
  contato: -1,
  endereco: -1,
  numero: -1,
  complemento: -1,
  cep: -1,
  cidade: -1,
  uf: -1,
  dataContrato: -1,
  valorContrato: -1,
  dataUltimoContato: -1,
  observacoes: -1,
  APARELHO_LIBERADO: -1,
  PEDIDO_MOVEL: -1,
  M_FIXA: -1,
  PEDIDO_FIXA: -1,
  NOME_CONTATO: -1,
  TIPO_GESTOR: -1,
  FLG_DOMINIO_PUBLICO_SFA: -1,
  telefone2: -1,
  TELEFONE_RESIDENCIAL: -1,
  EMAIL_SIBEL: -1,
  PROP_MOVEL_AVANCADA: -1,
});

const autoDetectMapping = (headers: string[]): ColumnMapping => {
  const mapping = createDefaultMapping();
  
  const lowerHeaders = headers.map(h => h.toLowerCase().trim());
  
  lowerHeaders.forEach((header, idx) => {
    if (header.includes('nome') && !header.includes('contato')) mapping.nome = idx;
    else if (header.includes('cnpj') || header.includes('cpf')) mapping.cnpj = idx;
    else if (header.includes('status')) mapping.status = idx;
    else if (header.includes('carteira')) mapping.carteira = idx;
    else if (header.includes('tipo') && !header.includes('gestor')) mapping.tipo = idx;
    else if (header.includes('categoria')) mapping.categoria = idx;
    else if (header.includes('celular') || header.includes('whatsapp')) mapping.celular = idx;
    else if (header.includes('email') && !header.includes('sibel')) mapping.email = idx;
    else if (header.includes('endereço') || header.includes('endereco')) mapping.endereco = idx;
    else if (header.includes('cidade')) mapping.cidade = idx;
    else if (header.includes('cep')) mapping.cep = idx;
  });
  
  return mapping;
};

export default function Importacao() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>(createDefaultMapping());
  const [importing, setImporting] = useState(false);
  const [currentProgress, setCurrentProgress] = useState(0);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    errorCount: number;
    errors: string[];
  } | null>(null);

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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx?)$/i)) {
      toast({
        title: "Arquivo inválido",
        description: "Por favor, selecione um arquivo CSV ou XLSX",
        variant: "destructive",
      });
      return;
    }

    if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      Papa.parse(file, {
        complete: (results: any) => {
          if (results.data && results.data.length > 0) {
            const headers = results.data[0];
            const rows = results.data.slice(1).filter((row: any) => row.some((cell: any) => cell));
            setFileData({ headers, rows });
            
            // Auto-detect mapping based on column headers
            const detectedMapping = autoDetectMapping(headers);
            setMapping(detectedMapping);
            
            setCurrentStep(2);
            toast({
              title: "Sucesso",
              description: `${rows.length} linhas detectadas. Colunas mapeadas automaticamente.`,
            });
          }
        },
        error: () => {
          toast({
            title: "Erro",
            description: "Falha ao ler o arquivo CSV",
            variant: "destructive",
          });
        },
      });
    } else {
      // For XLSX, just show a message for now (would need xlsx library)
      toast({
        title: "Atenção",
        description: "Converta seu arquivo XLSX para CSV primeiro",
      });
    }
  };

  const handleImport = async () => {
    if (!fileData || !fileData.rows.length) return;

    setImporting(true);
    setCurrentProgress(0);
    try {
      const response = await apiRequest("POST", "/api/import/clients", {
        data: fileData.rows,
        mapping,
      });

      const result = await response.json();
      setImportResult(result);
      setCurrentStep(4);
      setCurrentProgress(fileData.rows.length);
      queryClient.invalidateQueries({ queryKey: ["/api/clients"] });

      toast({
        title: "Importação Concluída",
        description: `${result.successCount} clientes importados com sucesso`,
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message || "Falha ao importar clientes",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  if (authLoading || !isAuthenticated) {
    return <ImportacaoSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Header Section */}
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Download className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
              Importação de Clientes
            </h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Importe sua base de clientes via CSV ou XLSX em 4 etapas simples
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 pb-12">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Stepper */}
          <div className="flex items-center justify-between">
        {[
          { step: 1, label: "Upload" },
          { step: 2, label: "Mapeamento" },
          { step: 3, label: "Importação" },
          { step: 4, label: "Concluído" },
        ].map((item, index) => (
          <div key={item.step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`
                flex h-10 w-10 items-center justify-center rounded-full border-2 font-medium text-sm
                ${
                  currentStep >= item.step
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground"
                }
              `}
              >
                {currentStep > item.step ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  item.step
                )}
              </div>
              <span className="text-xs mt-2 text-center">{item.label}</span>
            </div>
            {index < 3 && (
              <ArrowRight
                className={`h-5 w-5 mx-2 ${
                  currentStep > item.step
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              />
            )}
          </div>
        ))}
      </div>

        {/* Step 1: Upload */}
        {currentStep === 1 && (
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
          <div className="px-6 pt-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">Selecione seu arquivo</h2>
          </div>
          <div className="px-6 pb-6 space-y-4">
            <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg p-8 text-center hover:bg-slate-50 dark:hover:bg-slate-900/50 transition cursor-pointer">
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
                data-testid="input-file-import"
              />
              <label
                htmlFor="file-input"
                className="cursor-pointer space-y-2 flex flex-col items-center"
              >
                <Upload className="h-12 w-12 text-slate-400 dark:text-slate-500 mx-auto" />
                <div>
                  <p className="font-medium text-slate-900 dark:text-white">Clique ou arraste seu arquivo aqui</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    CSV ou XLSX (máx. 10MB)
                  </p>
                </div>
              </label>
            </div>
          </div>
        </Card>
      )}

        {/* Step 2: Mapping */}
        {currentStep === 2 && fileData && (
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
          <div className="px-6 pt-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Mapeie as colunas</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Associe as colunas do seu arquivo aos campos do sistema
            </p>
          </div>
          <div className="px-6 pb-6 space-y-4 mt-4">
            {/* Preview */}
            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-slate-900 dark:text-white mb-2">Primeira linha (prévia):</p>
              <div className="flex gap-2 flex-wrap">
                {fileData.headers.map((header, idx) => (
                  <Badge key={idx} variant="outline">
                    {header}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Mapping selects with scroll */}
            <ScrollArea className="h-80 border border-slate-200 dark:border-slate-700 rounded-lg p-4">
              <div className="grid grid-cols-4 gap-2 pr-4">
                {[
                  { key: "nome", label: "Nome *" },
                  { key: "cnpj", label: "CNPJ" },
                  { key: "carteira", label: "Carteira" },
                  { key: "tipo", label: "Tipo" },
                  { key: "celular", label: "Celular/WhatsApp *" },
                  { key: "email", label: "Email" },
                  { key: "PEDIDO_MOVEL", label: "PEDIDO MOVEL" },
                  { key: "M_FIXA", label: "M FIXA" },
                  { key: "PEDIDO_FIXA", label: "PEDIDO FIXA" },
                  { key: "endereco", label: "Endereço" },
                  { key: "cidade", label: "Cidade" },
                  { key: "cep", label: "CEP" },
                  { key: "numero", label: "Número" },
                  { key: "NOME_CONTATO", label: "Nome Contato" },
                  { key: "TIPO_GESTOR", label: "Tipo Gestor" },
                  { key: "FLG_DOMINIO_PUBLICO_SFA", label: "FLG_DOMINIO_SFA" },
                  { key: "telefone2", label: "Telefone Secundário" },
                  { key: "TELEFONE_RESIDENCIAL", label: "Telefone Residencial" },
                  { key: "EMAIL_SIBEL", label: "Email Sibel" },
                  { key: "PROP_MOVEL_AVANCADA", label: "Prop. Movel/Avançada" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="text-sm font-medium">{field.label}</label>
                    <Select
                      value={mapping[field.key as keyof ColumnMapping].toString()}
                      onValueChange={(val) =>
                        setMapping({
                          ...mapping,
                          [field.key]: parseInt(val),
                        })
                      }
                    >
                      <SelectTrigger className="mt-1" data-testid={`select-map-${field.key}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="-1">Ignorar</SelectItem>
                        {fileData.headers.map((header, idx) => (
                          <SelectItem key={idx} value={idx.toString()}>
                            {header}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep(1);
                  setFileData(null);
                }}
                data-testid="button-back-upload"
              >
                Voltar
              </Button>
              <Button
                onClick={() => setCurrentStep(3)}
                data-testid="button-continue-validation"
              >
                Continuar
              </Button>
            </div>
          </div>
        </Card>
      )}

        {/* Step 3: Import */}
        {currentStep === 3 && fileData && (
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
          <div className="px-6 pt-6">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Revisar e Importar</h2>
          </div>
          <div className="px-6 pb-6 space-y-4 mt-4">
            <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 flex gap-2 border border-blue-200 dark:border-blue-800/50">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  {fileData.rows.length} clientes serão importados
                </p>
                <p className="text-blue-800 dark:text-blue-200 mt-1">
                  Certifique-se de que o mapeamento está correto antes de prosseguir
                </p>
              </div>
            </div>

            {/* Progress during import */}
            {importing && (
              <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4 border border-amber-200 dark:border-amber-800/50">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Importando...</p>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                    {currentProgress}/{fileData.rows.length}
                  </p>
                </div>
                <Progress value={(currentProgress / fileData.rows.length) * 100} className="h-2" />
              </div>
            )}

            {/* Preview table */}
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700">
                    <tr className="hover:bg-transparent">
                      <th className="px-4 py-2 text-left font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">#</th>
                      <th className="px-4 py-2 text-left font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">Nome</th>
                      <th className="px-4 py-2 text-left font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">CPF/CNPJ</th>
                      <th className="px-4 py-2 text-left font-semibold text-xs uppercase tracking-wider text-slate-900 dark:text-slate-100">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.rows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors">
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">
                          {row[mapping.nome] || "-"}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                          {row[mapping.cnpj] || "-"}
                        </td>
                        <td className="px-4 py-2">
                          <Badge className="bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs border-0">{row[mapping.status] || "lead"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {fileData.rows.length > 5 && (
              <p className="text-sm text-slate-600 dark:text-slate-400 px-4 py-2">
                ... e mais {fileData.rows.length - 5} registros
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
              <Button
                variant="outline"
                onClick={() => setCurrentStep(2)}
                disabled={importing}
                data-testid="button-back-mapping"
              >
                Voltar
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing}
                data-testid="button-confirm-import"
              >
                {importing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {importing ? "Importando..." : "Importar Agora"}
              </Button>
            </div>
          </div>
        </Card>
      )}

        {/* Step 4: Result */}
        {currentStep === 4 && importResult && (
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
          <div className="px-6 pt-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Importação Concluída</h2>
            </div>
          </div>
          <div className="px-6 pb-6 space-y-4 mt-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4 border border-green-200 dark:border-green-800/50">
                <p className="text-sm text-slate-600 dark:text-slate-400">Sucessos</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400 mt-1">
                  {importResult.successCount}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 rounded-lg p-4 border border-red-200 dark:border-red-800/50">
                <p className="text-sm text-slate-600 dark:text-slate-400">Erros</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400 mt-1">
                  {importResult.errorCount}
                </p>
              </div>
            </div>

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-900 dark:text-white">Erros encontrados:</p>
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-4 space-y-1 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700">
                  {importResult.errors.map((error, idx) => (
                    <p key={idx} className="text-sm text-red-600 dark:text-red-400">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-700 mt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setCurrentStep(1);
                  setFileData(null);
                  setImportResult(null);
                }}
                data-testid="button-import-another"
              >
                Importar outro arquivo
              </Button>
              <Button asChild data-testid="button-view-clientes">
                <a href="/clientes">Ver clientes importados</a>
              </Button>
            </div>
          </div>
        </Card>
      )}
        </div>
      </div>
    </div>
  );
}

function ImportacaoSkeleton() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      <div className="px-6 py-8 md:py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center gap-3 mb-2">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <Skeleton className="h-8 w-64" />
          </div>
          <Skeleton className="h-4 w-96 mt-4" />
        </div>
      </div>
      <div className="px-6 pb-12">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-96 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
