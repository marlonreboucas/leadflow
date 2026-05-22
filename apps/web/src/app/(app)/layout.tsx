'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { useAuth } from '@/lib/auth-store';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const user = useAuth((s) => s.user);

  useEffect(() => {
    if (!user) router.replace('/login');
  }, [user, router]);

  if (!user) return null;

  return (
    <div className="flex h-screen w-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Topbar />
        <main className="flex-1 min-h-0 overflow-y-auto bg-background">{children}</main>
      </div>
    </div>
  );
}
