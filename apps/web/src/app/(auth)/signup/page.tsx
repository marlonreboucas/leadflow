'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { signupSchema, type SignupInput } from '@leadflow/shared';
import { toast } from 'sonner';
import { api, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SignupPage() {
  const router = useRouter();
  const { register, handleSubmit, formState: { errors } } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
  });
  const setSession = useAuth((s) => s.setSession);
  const [loading, setLoading] = useState(false);

  async function onSubmit(values: SignupInput) {
    setLoading(true);
    try {
      const { data } = await api.post('/auth/signup', values);
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setSession({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken });
      router.replace('/dashboard');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Falha ao criar conta');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Criar conta</CardTitle>
        <CardDescription>Comece com 14 dias de trial</CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-1">
            <Label htmlFor="name">Seu nome</Label>
            <Input id="name" {...register('name')} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="companyName">Nome da empresa</Label>
            <Input id="companyName" {...register('companyName')} />
            {errors.companyName && <p className="text-xs text-destructive">{errors.companyName.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" autoComplete="email" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <Label htmlFor="password">Senha</Label>
            <Input id="password" type="password" autoComplete="new-password" {...register('password')} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Criando...' : 'Criar conta'}
          </Button>
          <p className="text-sm text-center text-muted-foreground">
            Já tem conta? <Link className="underline" href="/login">Entrar</Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
