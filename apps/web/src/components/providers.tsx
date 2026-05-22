'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { useState, useEffect } from 'react';
import { loadTokens, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false } } }));
  const { accessToken, refreshToken } = useAuth();

  useEffect(() => {
    if (accessToken && refreshToken) {
      setTokens({ accessToken, refreshToken });
    } else {
      loadTokens();
    }
  }, [accessToken, refreshToken]);

  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <QueryClientProvider client={client}>
        {children}
        <Toaster richColors position="top-right" />
      </QueryClientProvider>
    </ThemeProvider>
  );
}
