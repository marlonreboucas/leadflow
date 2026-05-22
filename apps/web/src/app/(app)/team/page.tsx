'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Member {
  userId: string;
  companyId: string;
  roleId: string;
  joinedAt: string;
  user: { id: string; name: string; email: string; avatarUrl: string | null };
  role: { slug: string; name: string };
}

type Invite = {
  id: string;
  email: string;
  expiresAt: string;
  createdAt: string;
};

export default function TeamPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [roleSlug, setRoleSlug] = useState('ATTENDANT');
  const [lastLink, setLastLink] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery<Member[]>({
    queryKey: ['team'],
    queryFn: async () => (await api.get('/users')).data,
  });

  const { data: invites } = useQuery({
    queryKey: ['team-invites'],
    queryFn: async () => (await api.get<Invite[]>('/users/invites')).data,
  });

  const invite = useMutation({
    mutationFn: async () =>
      (await api.post<{ token: string; email: string }>('/users/invites', { email, roleSlug }))
        .data,
    onSuccess: (row) => {
      const url = `${window.location.origin}/invite/${row.token}`;
      setLastLink(url);
      toast.success('Convite criado');
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['team-invites'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Erro ao convidar');
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Equipe</h1>
        <p className="text-sm text-muted-foreground">Membros e convites da empresa</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Convidar membro</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>E-mail</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          </div>
          <div className="space-y-1">
            <Label>Perfil</Label>
            <select
              className="w-full border rounded-md h-9 px-2 text-sm bg-background"
              value={roleSlug}
              onChange={(e) => setRoleSlug(e.target.value)}
            >
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Gerente</option>
              <option value="ATTENDANT">Atendente</option>
              <option value="SALES">Vendas</option>
              <option value="READONLY">Somente leitura</option>
            </select>
          </div>
          <Button
            disabled={!email.trim() || invite.isPending}
            onClick={() => invite.mutate()}
          >
            Enviar convite
          </Button>
          {lastLink && (
            <p className="text-xs break-all text-muted-foreground">
              Link: <a className="text-primary underline" href={lastLink}>{lastLink}</a>
            </p>
          )}
        </CardContent>
      </Card>

      {invites && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Convites pendentes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            {invites.map((i) => (
              <div key={i.id} className="flex justify-between border-b py-1">
                <span>{i.email}</span>
                <span className="text-muted-foreground text-xs">
                  expira {new Date(i.expiresAt).toLocaleDateString('pt-BR')}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Membros</CardTitle>
          <CardDescription>
            {isLoading ? 'Carregando...' : `${data?.length ?? 0} membro(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="text-sm text-destructive">
              {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ??
                'Erro ao carregar equipe'}
            </p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando membros...</p>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum membro cadastrado ainda.</p>
          ) : (
            <div className="divide-y">
              {data.map((m) => (
                <MemberRow key={m.userId} member={m} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  const initials = member.user.name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();
  const joined = new Date(member.joinedAt).toLocaleDateString('pt-BR');

  return (
    <div className="flex items-center gap-4 py-3">
      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm font-medium">
        {initials || '?'}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{member.user.name}</div>
        <div className="text-xs text-muted-foreground truncate">{member.user.email}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-medium">{member.role.name}</div>
        <div className="text-xs text-muted-foreground">desde {joined}</div>
      </div>
    </div>
  );
}
