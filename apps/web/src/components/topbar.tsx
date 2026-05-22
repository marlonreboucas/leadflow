'use client';
import { useAuth } from '@/lib/auth-store';
import { setTokens } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LogOut } from 'lucide-react';

export function Topbar() {
  const user = useAuth((s) => s.user);
  const clear = useAuth((s) => s.clear);
  const router = useRouter();

  function logout() {
    clear();
    setTokens(null);
    router.replace('/login');
  }

  return (
    <header className="h-14 border-b bg-card flex items-center justify-between px-4">
      <div className="text-sm text-muted-foreground">{user?.email}</div>
      <Button variant="ghost" size="sm" onClick={logout}>
        <LogOut className="h-4 w-4 mr-2" /> Sair
      </Button>
    </header>
  );
}
