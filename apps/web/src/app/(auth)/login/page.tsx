'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@leadflow/shared';
import { toast } from 'sonner';
import { api, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  });
  const setSession = useAuth((s) => s.setSession);
  const [loading, setLoading] = useState(false);

  async function onSubmit(values: LoginInput) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', values);
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setSession({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      router.replace('/dashboard');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Falha no login');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Entrar</CardTitle>
        <CardDescription>Acesse sua conta LeadFlow AI</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="current-password" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Não tem conta? <Link className="underline" href="/signup">Criar conta</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
