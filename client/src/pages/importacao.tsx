import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
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
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

export default function Importacao() {
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

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
    if (file) {
      const validTypes = [
        'text/csv',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      
      if (validTypes.includes(file.type) || file.name.endsWith('.csv') || file.name.endsWith('.xlsx')) {
        setSelectedFile(file);
      } else {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione um arquivo CSV ou XLSX",
          variant: "destructive",
        });
      }
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    
    setUploading(true);
    setUploadProgress(0);
    
    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          setCurrentStep(2);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };

  if (authLoading || !isAuthenticated) {
    return null;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Importação de Clientes</h1>
        <p className="text-muted-foreground mt-1">
          Importe sua base de clientes via CSV ou XLSX
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        {[
          { step: 1, label: "Upload" },
          { step: 2, label: "Mapeamento" },
          { step: 3, label: "Validação" },
          { step: 4, label: "Concluído" },
        ].map((item, index) => (
          <div key={item.step} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div className={`
                flex h-10 w-10 items-center justify-center rounded-full border-2 font-medium text-sm
                ${currentStep >= item.step 
                  ? 'border-primary bg-primary text-primary-foreground' 
                  : 'border-border bg-background text-muted-foreground'
                }
              `}>
                {currentStep > item.step ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  item.step
                )}
              </div>
              <span className={`
                text-xs mt-2 font-medium
                ${currentStep >= item.step ? 'text-foreground' : 'text-muted-foreground'}
              `}>
                {item.label}
              </span>
            </div>
            {index < 3 && (
              <div className={`
                h-0.5 w-full -mt-6
                ${currentStep > item.step ? 'bg-primary' : 'bg-border'}
              `} />
            )}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto">
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Selecione o arquivo para importar</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-2 border-dashed rounded-lg p-12 text-center hover-elevate transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  className="hidden"
                  accept=".csv,.xlsx"
                  onChange={handleFileSelect}
                  data-testid="input-file-upload"
                />
                <label 
                  htmlFor="file-upload" 
                  className="cursor-pointer flex flex-col items-center gap-4"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-medium">
                      {selectedFile ? selectedFile.name : "Clique para selecionar ou arraste o arquivo"}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Formatos suportados: CSV, XLSX (até 10GB)
                    </p>
                  </div>
                </label>
              </div>

              {selectedFile && (
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-medium">{selectedFile.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <Badge>Pronto</Badge>
                </div>
              )}

              {uploading && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Fazendo upload...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <Progress value={uploadProgress} />
                </div>
              )}

              <Button 
                className="w-full" 
                disabled={!selectedFile || uploading}
                onClick={handleUpload}
                data-testid="button-upload"
              >
                {uploading ? "Enviando..." : "Continuar"}
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Mapeamento de Colunas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Associe as colunas do seu arquivo aos campos do sistema
              </p>

              {[
                { col: "A", sample: "João Silva", field: "nome" },
                { col: "B", sample: "Silva & Cia Ltda", field: "razaoSocial" },
                { col: "C", sample: "12.345.678/0001-99", field: "cpfCnpj" },
                { col: "D", sample: "joao@email.com", field: "email" },
                { col: "E", sample: "(11) 99999-9999", field: "telefone" },
              ].map((item) => (
                <div key={item.col} className="flex items-center gap-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded bg-muted font-mono font-medium">
                    {item.col}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-mono">{item.sample}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Select defaultValue={item.field}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nome">Nome</SelectItem>
                      <SelectItem value="razaoSocial">Razão Social</SelectItem>
                      <SelectItem value="cpfCnpj">CPF/CNPJ</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="telefone">Telefone</SelectItem>
                      <SelectItem value="carteira">Carteira</SelectItem>
                      <SelectItem value="planoAtual">Plano Atual</SelectItem>
                      <SelectItem value="ignorar">Ignorar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ))}

              <Button 
                className="w-full mt-6" 
                onClick={() => setCurrentStep(3)}
                data-testid="button-validar"
              >
                Validar e Importar
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 3 && (
          <Card>
            <CardHeader>
              <CardTitle>Validação e Importação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Processando registros...</span>
                  <span>75%</span>
                </div>
                <Progress value={75} />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Total de Linhas</span>
                  </div>
                  <p className="text-2xl font-semibold">1,250</p>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Válidos</span>
                  </div>
                  <p className="text-2xl font-semibold text-green-600">1,180</p>
                </div>
                <div className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    <span className="text-sm font-medium">Erros</span>
                  </div>
                  <p className="text-2xl font-semibold text-red-600">70</p>
                </div>
              </div>

              <Button 
                className="w-full" 
                onClick={() => setCurrentStep(4)}
              >
                Concluir Importação
              </Button>
            </CardContent>
          </Card>
        )}

        {currentStep === 4 && (
          <Card>
            <CardContent className="py-12 text-center space-y-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900 mx-auto">
                <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <h3 className="text-2xl font-semibold mb-2">Importação Concluída!</h3>
                <p className="text-muted-foreground">
                  1,180 clientes foram importados com sucesso
                </p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => setCurrentStep(1)}>
                  Nova Importação
                </Button>
                <Button asChild>
                  <a href="/clientes">
                    <Users className="h-4 w-4 mr-2" />
                    Ver Clientes
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
