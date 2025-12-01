import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Build URL from query key, handling nested objects/arrays correctly
    let url = "";
    for (let i = 0; i < queryKey.length; i++) {
      const key = queryKey[i];
      if (typeof key === "string") {
        // Add slash before string keys after the first one (for path segments like /api/clients/:id)
        if (i > 0 && !url.endsWith("/")) {
          url += "/";
        }
        url += key;
      } else if (typeof key === "object" && key !== null) {
        // Handle object query parameters
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(key)) {
          if (v) params.append(k, String(v));
        }
        const queryString = params.toString();
        url += queryString ? `?${queryString}` : "";
      }
    }

    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: (failureCount, error: any) => {
        // Retry on 401 (session not ready) with exponential backoff
        const is401 = error?.message?.includes("401");
        if (is401 && failureCount < 3) {
          return true;
        }
        return false;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
    mutations: {
      retry: false,
    },
  },
});

