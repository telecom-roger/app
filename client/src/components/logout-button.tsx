import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";

export function LogoutButton() {
  const [, setLocation] = useLocation();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout", {});
    },
    onSuccess: () => {
      // Clear all queries from cache
      queryClient.clear();
      // Redirect to login
      setLocation("/login");
      // Hard refresh to ensure session is cleared
      window.location.href = "/login";
    },
    onError: () => {
      // Even if logout fails, clear cache and redirect
      queryClient.clear();
      setLocation("/login");
      window.location.href = "/login";
    },
  });

  return (
    <Button
      size="icon"
      variant="ghost"
      onClick={() => logoutMutation.mutate()}
      disabled={logoutMutation.isPending}
      data-testid="button-logout"
      title="Sair"
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
