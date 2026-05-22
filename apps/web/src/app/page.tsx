'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-store';

export default function HomePage() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  useEffect(() => {
    router.replace(user ? '/dashboard' : '/login');
  }, [user, router]);
  return null;
}
