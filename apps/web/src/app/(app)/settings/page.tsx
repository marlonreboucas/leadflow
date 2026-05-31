'use client';
import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { api, setTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

interface CompanyResponse {
  id: string;
  name: string;
  slug: string;
  segment: string | null;
  timezone: string;
  defaultGreeting: string | null;
  status: string;
  subscription: {
    status: string;
    plan: { name: string; slug: string } | null;
  } | null;
}

interface FormValues {
  name: string;
  segment: string;
  timezone: string;
  defaultGreeting: string;
}

export default function SettingsPage() {
  const queryClient = useQueryClient();

  const { data: company, isLoading } = useQuery<CompanyResponse>({
    queryKey: ['company', 'me'],
    queryFn: async () => (await api.get('/companies/me')).data,
  });

  const { register, handleSubmit, reset, formState: { isDirty } } = useForm<FormValues>({
    defaultValues: { name: '', segment: '', timezone: '', defaultGreeting: '' },
  });

  useEffect(() => {
    if (company) {
      reset({
        name: company.name,
        segment: company.segment ?? '',
        timezone: company.timezone,
        defaultGreeting: company.defaultGreeting ?? '',
      });
    }
  }, [company, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const payload = {
        name: values.name,
        segment: values.segment || null,
        timezone: values.timezone,
        defaultGreeting: values.defaultGreeting || null,
      };
      return (await api.patch('/companies/me', payload)).data;
    },
    onSuccess: () => {
      toast.success('Configurações salvas');
      queryClient.invalidateQueries({ queryKey: ['company', 'me'] });
    },
    onError: (e: any) => {
      toast.error(e?.response?.data?.message ?? 'Erro ao salvar');
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">Dados gerais da empresa</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
          <CardDescription>
            {isLoading ? 'Carregando...' : `${company?.name ?? ''} · ${company?.slug ?? ''}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit((v) => mutation.mutate(v))}>
            <div className="space-y-1">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" {...register('name', { required: true })} disabled={isLoading} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="segment">Segmento</Label>
              <Input
                id="segment"
                placeholder="Ex.: imobiliária, clínica, agência..."
                {...register('segment')}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="timezone">Fuso horário</Label>
              <Input
                id="timezone"
                placeholder="America/Sao_Paulo"
                {...register('timezone', { required: true })}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="defaultGreeting">Saudação padrão</Label>
              <Textarea
                id="defaultGreeting"
                placeholder="Mensagem inicial usada por agentes IA"
                {...register('defaultGreeting')}
                disabled={isLoading}
              />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!isDirty || mutation.isPending || isLoading}>
                {mutation.isPending ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AgencyChildCard />

      <SecurityCard />

      <Card>
        <CardHeader>
          <CardTitle>Plano</CardTitle>
          <CardDescription>Assinatura atual da empresa</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <div>
            <span className="text-muted-foreground">Plano: </span>
            <span className="font-medium">{company?.subscription?.plan?.name ?? '—'}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Status: </span>
            <span className="font-medium">{company?.subscription?.status ?? company?.status ?? '—'}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SecurityCard() {
  const setSession = useAuth((s) => s.setSession);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const mutation = useMutation({
    mutationFn: async () =>
      (await api.post('/auth/change-password', { currentPassword, newPassword })).data,
    onSuccess: (data: {
      accessToken: string;
      refreshToken: string;
      user: { id: string; email: string; companyId: string; roleSlug: string };
    }) => {
      // A troca de senha revoga as sessões antigas e reemite tokens: atualiza
      // a sessão atual com os novos tokens para o usuário não ser deslogado.
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      setSession(data);
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
      toast.success('Senha alterada. Outras sessões foram desconectadas.');
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Erro ao alterar senha');
    },
  });

  const mismatch = confirm.length > 0 && newPassword !== confirm;
  const canSubmit =
    currentPassword.length > 0 &&
    newPassword.length >= 8 &&
    newPassword === confirm &&
    !mutation.isPending;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Segurança</CardTitle>
        <CardDescription>
          Alterar senha desconecta as demais sessões deste usuário
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) mutation.mutate();
          }}
        >
          <div className="space-y-1">
            <Label htmlFor="currentPassword">Senha atual</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="newPassword">Nova senha</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="Mínimo de 8 caracteres"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {mismatch && (
              <p className="text-xs text-destructive">As senhas não coincidem</p>
            )}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending ? 'Salvando...' : 'Alterar senha'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function AgencyChildCard() {
  const [childName, setChildName] = useState('');
  const mutation = useMutation({
    mutationFn: async () => (await api.post('/companies/children', { name: childName.trim() })).data,
    onSuccess: (data: { name: string; slug: string }) => {
      toast.success(`Filial criada: ${data.name} (${data.slug})`);
      setChildName('');
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar filial');
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agência — empresa filha</CardTitle>
        <CardDescription>Cria conta trial independente vinculada (plano agency)</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Nome da filial"
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
        />
        <Button
          variant="outline"
          disabled={!childName.trim() || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Criar filial
        </Button>
      </CardContent>
    </Card>
  );
}
