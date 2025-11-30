import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

export function LogoutButton() {
  const [, setLocation] = useLocation();

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/logout", {});
    },
    onSuccess: () => {
      setLocation("/login");
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
