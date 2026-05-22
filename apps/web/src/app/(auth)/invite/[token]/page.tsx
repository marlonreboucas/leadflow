'use client';

import { useParams, useRouter } from 'next/navigation';
import { useMutation, useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import axios from 'axios';
import { setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const publicApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api',
});

export default function AcceptInvitePage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const setSession = useAuth((s) => s.setSession);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');

  const { data: preview, isLoading } = useQuery({
    queryKey: ['invite-preview', token],
    queryFn: async () =>
      (await publicApi.get<{ email: string; companyName?: string }>(`/auth/invite/${token}`)).data,
    enabled: !!token,
  });

  const accept = useMutation({
    mutationFn: async () =>
      (
        await publicApi.post('/auth/accept-invite', {
          token,
          name: name.trim() || undefined,
          password: password || undefined,
        })
      ).data,
    onSuccess: (data: {
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; companyId: string; roleSlug: string };
    }) => {
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setSession({
        user: data.user,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      router.push('/dashboard');
    },
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Aceitar convite</CardTitle>
          <CardDescription>
            {isLoading
              ? 'Carregando...'
              : `${preview?.companyName ?? 'LeadFlow'} · ${preview?.email ?? ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Nome (se conta nova)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Senha</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mín. 6 caracteres para nova conta"
            />
          </div>
          <Button
            className="w-full"
            disabled={accept.isPending || !password}
            onClick={() => accept.mutate()}
          >
            {accept.isPending ? 'Entrando...' : 'Aceitar e entrar'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
