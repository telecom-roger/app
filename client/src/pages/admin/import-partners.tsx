import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link } from "wouter";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Check, AlertTriangle, Loader2 } from "lucide-react";
import Papa from "papaparse";

export default function ImportPartners() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<any[]>([]);
  const [parceiro, setParceiro] = useState("");
  const [duplicatas, setDuplicatas] = useState<any[]>([]);

  if (authLoading || !user) {
    return <div className="p-6">Carregando...</div>;
  }

  const importMutation = useMutation({
    mutationFn: async (data: { preview: any[]; parceiro: string; duplicatas: any[] }) => {
      const response = await fetch("/api/admin/import-partners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Erro ao importar");
      }
      return response.json();
    },
    onSuccess: (result) => {
      toast({
        title: "✅ Importação concluída",
        description: `${result.inserted} inseridos, ${result.duplicados} duplicatas ignoradas`,
      });
      setFile(null);
      setPreview([]);
      setDuplicatas([]);
      setParceiro("");
    },
    onError: (error: any) => {
      toast({
        title: "❌ Erro",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    setFile(f);
    setParceiro(f.name.replace(/\.[^/.]+$/, "").toUpperCase());

    Papa.parse(f, {
      header: true,
      skipEmptyLines: true,
      complete: (results: any) => {
        setPreview(results.data.slice(0, 10));
        
        // Validar duplicatas
        const dups = results.data.filter((row: any) => 
          !row.nome || (!row.cnpj && !row.email && !row.celular)
        );
        setDuplicatas(dups);
      },
      error: (error) => {
        toast({
          title: "❌ Erro ao ler arquivo",
          description: error.message,
          variant: "destructive",
        });
      },
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Upload className="w-6 h-6 text-blue-600" />
            <h1 className="text-3xl font-bold">Importar Parceiros</h1>
          </div>
          <p className="text-slate-600 dark:text-slate-400">Envie uma planilha para organizar conforme banco de dados</p>
        </div>

        {/* Upload Card */}
        <Card className="border-2 border-dashed mb-6">
          <CardContent className="pt-8">
            <label className="flex flex-col items-center justify-center cursor-pointer">
              <Upload className="w-12 h-12 text-slate-400 mb-3" />
              <span className="text-base font-semibold text-slate-900 dark:text-white mb-1">
                Clique para selecionar arquivo
              </span>
              <span className="text-sm text-slate-500">CSV ou XLSX</span>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="input-file-partners"
              />
            </label>
          </CardContent>
        </Card>

        {file && (
          <>
            {/* Parceiro Info */}
            <Alert className="mb-6">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Parceiro:</strong> {parceiro} | <strong>Arquivo:</strong> {file.name}
              </AlertDescription>
            </Alert>

            {/* Validação */}
            {duplicatas.length > 0 && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  ⚠️ {duplicatas.length} linhas sem nome ou contato - serão ignoradas
                </AlertDescription>
              </Alert>
            )}

            {/* Preview */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-600" />
                  Preview ({preview.length} registros)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow>
                        {preview.length > 0 && Object.keys(preview[0]).map((key) => (
                          <TableHead key={key}>{key}</TableHead>
                        ))}
                        <TableHead>PARCEIRO</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.map((row, idx) => (
                        <TableRow key={idx}>
                          {Object.values(row).map((val, i) => (
                            <TableCell key={i} className="truncate max-w-32">
                              {String(val)}
                            </TableCell>
                          ))}
                          <TableCell>
                            <Badge>{parceiro}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                onClick={() => {
                  importMutation.mutate({ preview, parceiro, duplicatas });
                }}
                disabled={importMutation.isPending || duplicatas.length === preview.length}
                className="flex-1 gap-2"
                data-testid="btn-import-partners"
              >
                {importMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    Importar {preview.length} Clientes
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setFile(null);
                  setPreview([]);
                  setDuplicatas([]);
                  setParceiro("");
                }}
                data-testid="btn-cancel-import"
              >
                Cancelar
              </Button>
              <Link href="/admin/automacao-avancado">
                <Button variant="ghost" data-testid="link-back-automation">
                  Voltar
                </Button>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
