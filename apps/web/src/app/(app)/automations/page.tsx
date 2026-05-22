'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Plus, Workflow } from 'lucide-react';
import Link from 'next/link';

type Rule = {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
  _count: { conditions: number; actions: number; executions: number };
};

const triggers = [
  { value: 'MESSAGE_RECEIVED', label: 'Mensagem recebida' },
  { value: 'LEAD_CREATED', label: 'Lead criado' },
  { value: 'LEAD_STAGE_CHANGED', label: 'Lead mudou de etapa' },
  { value: 'LEAD_IDLE', label: 'Lead parado' },
  { value: 'TASK_OVERDUE', label: 'Tarefa atrasada' },
];

export default function AutomationsPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [trigger, setTrigger] = useState('MESSAGE_RECEIVED');

  const { data, isLoading } = useQuery({
    queryKey: ['automations'],
    queryFn: async () => (await api.get<Rule[]>('/automations')).data,
  });

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/automations', { name, trigger, isActive: false });
    },
    onSuccess: () => {
      toast.success('Regra criada (rascunho)');
      setName('');
      qc.invalidateQueries({ queryKey: ['automations'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar');
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Automações</h1>
        <p className="text-sm text-muted-foreground">
          Regras gatilho → condições → ações. Clique em uma regra para editar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Nova regra (rascunho)</CardTitle>
          <CardDescription>Criada inativa — configure condições depois</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label>Nome</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="SDR → Vendedor" />
          </div>
          <div className="space-y-1 min-w-[200px]">
            <Label>Gatilho</Label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={trigger}
              onChange={(e) => setTrigger(e.target.value)}
            >
              {triggers.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <Button onClick={() => create.mutate()} disabled={!name.trim() || create.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            Criar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Regras</CardTitle>
          <CardDescription>{isLoading ? '...' : `${data?.length ?? 0} regra(s)`}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {!data?.length && !isLoading ? (
            <p className="text-sm text-muted-foreground">Nenhuma automação ainda.</p>
          ) : (
            data?.map((r) => (
              <Link
                key={r.id}
                href={`/automations/${r.id}`}
                className="flex items-center gap-3 border rounded-lg p-3 hover:bg-muted/30"
              >
                <Workflow className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.trigger} · {r._count.conditions} cond. · {r._count.actions} ações ·{' '}
                    {r._count.executions} exec.
                  </div>
                </div>
                <span
                  className={cn(
                    'text-xs px-2 py-0.5 rounded',
                    r.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-muted text-muted-foreground',
                  )}
                >
                  {r.isActive ? 'Ativa' : 'Rascunho'}
                </span>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
