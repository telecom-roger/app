import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Mail,
  Phone,
  Building2,
  Calendar,
  Edit,
  MessageSquare,
  Target,
  FileText,
} from "lucide-react";
import type { Client, Interaction } from "@shared/schema";

export default function ClienteProfile() {
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

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

  const { data: cliente, isLoading: clienteLoading } = useQuery<Client>({
    queryKey: ["/api/clients", id],
    enabled: isAuthenticated && !!id,
  });

  const { data: timeline, isLoading: timelineLoading } = useQuery<Interaction[]>({
    queryKey: ["/api/timeline", id],
    enabled: isAuthenticated && !!id,
  });

  if (authLoading || !isAuthenticated) {
    return <ProfileSkeleton />;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back Button */}
      <Button variant="ghost" size="sm" asChild data-testid="button-back">
        <Link href="/clientes">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Link>
      </Button>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Client Info */}
        <div className="lg:col-span-1 space-y-6">
          {/* Client Card */}
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-16 w-16">
                    <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                      {cliente?.nome?.[0]?.toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    {clienteLoading ? (
                      <>
                        <Skeleton className="h-6 w-32 mb-1" />
                        <Skeleton className="h-4 w-24" />
                      </>
                    ) : (
                      <>
                        <h2 className="text-xl font-semibold" data-testid="text-cliente-nome">
                          {cliente?.nome}
                        </h2>
                        <Badge variant="secondary" className="mt-1">
                          {cliente?.status}
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
                <Button size="icon" variant="outline" data-testid="button-edit-cliente">
                  <Edit className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {clienteLoading ? (
                <>
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                </>
              ) : (
                <>
                  {cliente?.razaoSocial && (
                    <div className="flex items-start gap-3">
                      <Building2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Razão Social</p>
                        <p className="font-medium">{cliente.razaoSocial}</p>
                      </div>
                    </div>
                  )}

                  {cliente?.cpfCnpj && (
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">CPF/CNPJ</p>
                        <p className="font-medium font-mono">{cliente.cpfCnpj}</p>
                      </div>
                    </div>
                  )}

                  {cliente?.carteira && (
                    <div className="flex items-start gap-3">
                      <Target className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Carteira</p>
                        <p className="font-medium">{cliente.carteira}</p>
                      </div>
                    </div>
                  )}

                  {cliente?.planoAtual && (
                    <div className="flex items-start gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Plano Atual</p>
                        <p className="font-medium">{cliente.planoAtual}</p>
                      </div>
                    </div>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Score</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{cliente?.score || 0}</span>
                      <div className="h-2 w-24 rounded-full bg-muted overflow-hidden">
                        <div 
                          className="h-full bg-primary"
                          style={{ width: `${cliente?.score || 0}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {cliente?.tags && cliente.tags.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {cliente.tags.map((tag, i) => (
                          <Badge key={i} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" className="w-full justify-start" data-testid="button-enviar-email">
                <Mail className="h-4 w-4 mr-2" />
                Enviar Email
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-enviar-whatsapp">
                <MessageSquare className="h-4 w-4 mr-2" />
                Enviar WhatsApp
              </Button>
              <Button variant="outline" className="w-full justify-start" data-testid="button-criar-oportunidade">
                <Target className="h-4 w-4 mr-2" />
                Criar Oportunidade
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Timeline */}
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Timeline de Interações</CardTitle>
                <Button size="sm" variant="outline" data-testid="button-add-nota">
                  <FileText className="h-4 w-4 mr-2" />
                  Adicionar Nota
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {timelineLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex gap-4">
                      <Skeleton className="h-10 w-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : timeline && timeline.length > 0 ? (
                <div className="space-y-6 relative">
                  {/* Vertical line */}
                  <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-border" />
                  
                  {timeline.map((item, index) => (
                    <TimelineItem key={item.id} item={item} isLast={index === timeline.length - 1} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-40" />
                  <p>Nenhuma interação registrada</p>
                  <p className="text-sm mt-1">
                    As interações com este cliente aparecerão aqui
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ item, isLast }: { item: Interaction; isLast: boolean }) {
  const iconMap: Record<string, React.ReactNode> = {
    nota: <FileText className="h-5 w-5" />,
    email_enviado: <Mail className="h-5 w-5" />,
    whatsapp_enviado: <MessageSquare className="h-5 w-5" />,
    status_mudou: <Target className="h-5 w-5" />,
    campanha: <Mail className="h-5 w-5" />,
  };

  return (
    <div className="flex gap-4 relative">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground z-10">
        {iconMap[item.tipo] || <FileText className="h-5 w-5" />}
      </div>
      <div className="flex-1 pb-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h4 className="font-medium">{item.titulo || item.tipo}</h4>
            <p className="text-xs text-muted-foreground">
              {new Date(item.createdAt).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>
        {item.texto && (
          <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
            {item.texto}
          </p>
        )}
      </div>
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-10 w-24" />
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-16 w-16 rounded-full" />
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
