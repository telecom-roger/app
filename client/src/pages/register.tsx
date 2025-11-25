import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Target, Loader2 } from "lucide-react";

export default function Register() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    firstName: "",
    lastName: "",
  });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const error = await res.json();
        toast({
          title: "Erro no registro",
          description: error.error || "Falha ao registrar",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Conta criada com sucesso! Redirecionando para login...",
      });

      setTimeout(() => {
        navigate("/login");
      }, 1000);
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary">
            <Target className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>

        {/* Register Card */}
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Criar nova conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Primeiro nome</label>
                  <Input
                    placeholder="João"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData({ ...formData, firstName: e.target.value })
                    }
                    data-testid="input-firstname-register"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Sobrenome</label>
                  <Input
                    placeholder="Silva"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData({ ...formData, lastName: e.target.value })
                    }
                    data-testid="input-lastname-register"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="seu@email.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  required
                  data-testid="input-email-register"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Senha</label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  required
                  minLength={6}
                  data-testid="input-password-register"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
                data-testid="button-register-submit"
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isLoading ? "Registrando..." : "Criar conta"}
              </Button>
            </form>

            <div className="space-y-2">
              <p className="text-center text-sm text-muted-foreground">
                Já tem conta?{" "}
                <Button
                  asChild
                  variant="ghost"
                  className="h-auto p-0 text-primary underline"
                  data-testid="button-go-to-login"
                >
                  <a href="/login">Faça login</a>
                </Button>
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground">
          © 2024 Plataforma de Atendimento Inteligente
        </p>
      </div>
    </div>
  );
}
