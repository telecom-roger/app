import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
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
} from "lucide-react";
import Papa from "papaparse";

type Step = 1 | 2 | 3 | 4;

interface FileData {
  headers: string[];
  rows: string[][];
}

interface ColumnMapping {
  nome: number;
  razaoSocial: number;
  cpfCnpj: number;
  status: number;
  carteira: number;
  categoria: number;
  score: number;
  planoAtual: number;
  produtoAtual: number;
  telefone: number;
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
  EMAIL_PRINCIPAL: number;
  CELULAR_PRINCIPAL: number;
  TIPO_GESTOR: number;
  FLG_DOMINIO_PUBLICO_SFA: number;
  TELEFONE_COMERCIAL: number;
  CELULAR: number;
  TELEFONE_RESIDENCIAL: number;
  EMAIL_SIBEL: number;
  PROP_MOVEL_AVANCADA: number;
  SERASA: number;
  MENSAGEM_SERASA: number;
}

export default function Importacao() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [mapping, setMapping] = useState<ColumnMapping>({
    nome: 0,
    razaoSocial: 1,
    cpfCnpj: 2,
    status: 3,
    carteira: 4,
    categoria: 5,
    score: 6,
    planoAtual: 7,
    produtoAtual: 8,
    telefone: -1,
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
    EMAIL_PRINCIPAL: -1,
    CELULAR_PRINCIPAL: -1,
    TIPO_GESTOR: -1,
    FLG_DOMINIO_PUBLICO_SFA: -1,
    TELEFONE_COMERCIAL: -1,
    CELULAR: -1,
    TELEFONE_RESIDENCIAL: -1,
    EMAIL_SIBEL: -1,
    PROP_MOVEL_AVANCADA: -1,
    SERASA: -1,
    MENSAGEM_SERASA: -1,
  });
  const [importing, setImporting] = useState(false);
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
            setCurrentStep(2);
            toast({
              title: "Sucesso",
              description: `${rows.length} linhas detectadas`,
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
    try {
      const response = await apiRequest("POST", "/api/import/clients", {
        data: fileData.rows,
        mapping,
      });

      const result = await response.json();
      setImportResult(result);
      setCurrentStep(4);
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
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Importação de Clientes
        </h1>
        <p className="text-muted-foreground mt-1">
          Importe sua base de clientes via CSV ou XLSX
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between max-w-3xl mx-auto">
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
        <Card>
          <CardHeader>
            <CardTitle>Selecione seu arquivo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition cursor-pointer">
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
                <Upload className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <p className="font-medium">Clique ou arraste seu arquivo aqui</p>
                  <p className="text-sm text-muted-foreground">
                    CSV ou XLSX (máx. 10MB)
                  </p>
                </div>
              </label>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Mapping */}
      {currentStep === 2 && fileData && (
        <Card>
          <CardHeader>
            <CardTitle>Mapeie as colunas</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Associe as colunas do seu arquivo aos campos do sistema
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preview */}
            <div className="bg-muted rounded-lg p-4 mb-6">
              <p className="text-sm font-medium mb-2">Primeira linha (prévia):</p>
              <div className="flex gap-2 flex-wrap">
                {fileData.headers.map((header, idx) => (
                  <Badge key={idx} variant="outline">
                    {header}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Mapping selects */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { key: "nome", label: "Nome *" },
                { key: "cpfCnpj", label: "CNPJ" },
                { key: "razaoSocial", label: "Razão Social" },
                { key: "PEDIDO_MOVEL", label: "PEDIDO MOVEL" },
                { key: "M_FIXA", label: "M FIXA" },
                { key: "PEDIDO_FIXA", label: "PEDIDO FIXA" },
                { key: "endereco", label: "Endereço" },
                { key: "cidade", label: "Cidade" },
                { key: "cep", label: "CEP" },
                { key: "numero", label: "Número" },
                { key: "NOME_CONTATO", label: "Nome Contato" },
                { key: "EMAIL_PRINCIPAL", label: "Email Principal" },
                { key: "CELULAR_PRINCIPAL", label: "Celular Principal" },
                { key: "TIPO_GESTOR", label: "Tipo Gestor" },
                { key: "FLG_DOMINIO_PUBLICO_SFA", label: "FLG_DOMINIO_SFA" },
                { key: "TELEFONE_COMERCIAL", label: "Telefone Comercial" },
                { key: "CELULAR", label: "Celular" },
                { key: "TELEFONE_RESIDENCIAL", label: "Telefone Residencial" },
                { key: "EMAIL_SIBEL", label: "Email Sibel" },
                { key: "PROP_MOVEL_AVANCADA", label: "Prop. Movel/Avançada" },
                { key: "SERASA", label: "Serasa" },
                { key: "MENSAGEM_SERASA", label: "Mensagem Serasa" },
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

            {/* Actions */}
            <div className="flex gap-2 pt-4">
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
          </CardContent>
        </Card>
      )}

      {/* Step 3: Import */}
      {currentStep === 3 && fileData && (
        <Card>
          <CardHeader>
            <CardTitle>Revisar e Importar</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-4 flex gap-2">
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

            {/* Preview table */}
            <div className="border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">#</th>
                      <th className="px-4 py-2 text-left font-medium">Nome</th>
                      <th className="px-4 py-2 text-left font-medium">CPF/CNPJ</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fileData.rows.slice(0, 5).map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-4 py-2">{idx + 1}</td>
                        <td className="px-4 py-2">
                          {row[mapping.nome] || "-"}
                        </td>
                        <td className="px-4 py-2">
                          {row[mapping.cpfCnpj] || "-"}
                        </td>
                        <td className="px-4 py-2">
                          {row[mapping.status] || "lead"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {fileData.rows.length > 5 && (
              <p className="text-sm text-muted-foreground">
                ... e mais {fileData.rows.length - 5} registros
              </p>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
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
          </CardContent>
        </Card>
      )}

      {/* Step 4: Result */}
      {currentStep === 4 && importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              Importação Concluída
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-green-50 dark:bg-green-950 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Sucessos</p>
                <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                  {importResult.successCount}
                </p>
              </div>
              <div className="bg-red-50 dark:bg-red-950 rounded-lg p-4">
                <p className="text-sm text-muted-foreground">Erros</p>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">
                  {importResult.errorCount}
                </p>
              </div>
            </div>

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Erros encontrados:</p>
                <div className="bg-muted rounded-lg p-4 space-y-1 max-h-48 overflow-y-auto">
                  {importResult.errors.map((error, idx) => (
                    <p key={idx} className="text-sm text-destructive">
                      {error}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-4">
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
          </CardContent>
        </Card>
      )}
    </div>
  );
}
