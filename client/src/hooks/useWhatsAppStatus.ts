import { useQuery } from "@tanstack/react-query";

export function useWhatsAppStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/status"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/status");
      if (!res.ok) throw new Error("Failed to check WhatsApp status");
      return res.json();
    },
    refetchInterval: 5000, // Atualiza a cada 5 segundos
  });

  return {
    connected: data?.connected || false,
    sessionId: data?.sessionId || null,
    message: data?.message || "Carregando...",
    isLoading,
  };
}
