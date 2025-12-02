import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Target, Loader2, Lock, Mail } from "lucide-react";
import { queryClient } from "@/lib/queryClient";

export default function Login() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json();
        toast({
          title: "Erro no login",
          description: error.message || "Credenciais inválidas",
          variant: "destructive",
        });
        return;
      }

      // Invalidar cache de autenticação para recarregar dados do usuário
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });

      toast({
        title: "Sucesso",
        description: "Login realizado com sucesso",
      });

      navigate("/");
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-700 dark:from-white dark:to-slate-100">
            <Target className="h-8 w-8 text-white dark:text-slate-900" />
          </div>
        </div>

        {/* Login Card */}
        <Card className="border-0 shadow-sm bg-white dark:bg-slate-800/50 overflow-hidden">
          <div className="px-6 pt-6">
            <div className="space-y-2">
              <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-200 bg-clip-text text-transparent">
                Bem-vindo
              </h1>
              <p className="text-slate-600 dark:text-slate-400">
                Acesse sua plataforma de atendimento
              </p>
            </div>
          </div>

          <div className="px-6 pb-6 mt-6 space-y-6">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 dark:text-white">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    data-testid="input-email-login"
                    className="pl-9 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-900 dark:text-white">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400 dark:text-slate-500" />
                  <Input
                    type="password"
                    placeholder="Sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    data-testid="input-password-login"
                    className="pl-9 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30 text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-10 bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 font-semibold"
                disabled={isLoading}
                data-testid="button-login-submit"
              >
                {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200 dark:border-slate-700" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white dark:bg-slate-800/50 text-slate-600 dark:text-slate-400">
                  Ou
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                Não tem conta?{" "}
                <Button
                  asChild
                  variant="ghost"
                  className="h-auto p-0 text-slate-900 dark:text-white font-semibold hover:text-slate-700 dark:hover:text-slate-200"
                  data-testid="button-go-to-register"
                >
                  <a href="/register">Registrar agora</a>
                </Button>
              </p>
            </div>
          </div>
        </Card>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 dark:text-slate-400">
          © 2024 Plataforma de Atendimento Inteligente
        </p>
      </div>
    </div>
  );
}
