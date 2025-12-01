import { useQuery } from "@tanstack/react-query";

export function useWhatsAppStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/status"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/status");
      if (!res.ok) throw new Error("Failed to check WhatsApp status");
      return res.json();
    },
    refetchInterval: 5000, // ✅ Aumentado para 5s (reduz sobrecarga e falsos "desconectado")
    staleTime: 1000, // ✅ 1s de cache para evitar re-fetches muito frequentes
    gcTime: 3000, // ✅ 3s garbage collection
    retry: 2, // ✅ Retry 2x em caso de falha
  });

  return {
    connected: data?.connected || false,
    sessionId: data?.sessionId || null,
    message: data?.message || "Carregando...",
    isLoading,
  };
}
