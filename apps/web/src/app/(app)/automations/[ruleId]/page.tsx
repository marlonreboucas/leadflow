'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Play, TestTube } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

type Rule = {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
  conditions: Array<{ id: string; field: string; operator: string; value: unknown }>;
  actions: Array<{ id: string; type: string; position: number; config: unknown }>;
  executions: Array<{ id: string; status: string; startedAt: string; log: unknown }>;
};

const fields = [
  { value: 'message.body', label: 'Texto da mensagem' },
  { value: 'deal.stageName', label: 'Estágio do lead' },
  { value: 'deal.temperature', label: 'Temperatura' },
];

const operators = [
  { value: 'contains', label: 'Contém' },
  { value: 'regex', label: 'Regex' },
  { value: 'eq', label: 'Igual' },
];

const actionTypes = [
  { value: 'RUN_AI_AGENT', label: 'Executar agente IA' },
  { value: 'MOVE_STAGE', label: 'Mover estágio' },
  { value: 'SEND_WHATSAPP_MESSAGE', label: 'Enviar mensagem' },
  { value: 'PAUSE_AI', label: 'Pausar IA' },
  { value: 'CREATE_TASK', label: 'Criar tarefa' },
  { value: 'CREATE_FUTURE_EVENT', label: 'Agendar compromisso' },
  { value: 'APPLY_TAG', label: 'Aplicar tag' },
];

export default function AutomationEditorPage() {
  const { ruleId } = useParams<{ ruleId: string }>();
  const qc = useQueryClient();
  const [testBody, setTestBody] = useState('Quero um orçamento');

  const { data: rule, isLoading } = useQuery({
    queryKey: ['automation', ruleId],
    queryFn: async () => (await api.get<Rule>(`/automations/${ruleId}`)).data,
    enabled: Boolean(ruleId),
  });

  const [conds, setConds] = useState<Rule['conditions']>([]);
  const [acts, setActs] = useState<Rule['actions']>([]);

  useEffect(() => {
    if (rule) {
      setConds(rule.conditions);
      setActs(rule.actions);
    }
  }, [rule]);

  const saveConds = useMutation({
    mutationFn: async () =>
      api.post(`/automations/${ruleId}/conditions`, {
        conditions: conds.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
        })),
      }),
    onSuccess: () => {
      toast.success('Condições salvas');
      qc.invalidateQueries({ queryKey: ['automation', ruleId] });
    },
  });

  const saveActs = useMutation({
    mutationFn: async () =>
      api.post(`/automations/${ruleId}/actions`, {
        actions: acts.map((a, i) => ({
          type: a.type,
          position: i,
          config: (a.config as Record<string, unknown>) ?? {},
        })),
      }),
    onSuccess: () => {
      toast.success('Ações salvas');
      qc.invalidateQueries({ queryKey: ['automation', ruleId] });
    },
  });

  const toggleActive = useMutation({
    mutationFn: async (active: boolean) =>
      api.patch(`/automations/${ruleId}`, { isActive: active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['automation', ruleId] }),
  });

  const dryRun = useMutation({
    mutationFn: async () =>
      api.post(`/automations/${ruleId}/test`, {
        trigger: rule?.trigger ?? 'MESSAGE_RECEIVED',
        context: {
          message: { body: testBody, direction: 'INBOUND' },
          deal: { stageName: 'Novo lead', temperature: 'WARM' },
        },
      }),
    onSuccess: (res) => {
      toast.message(`Teste: ${JSON.stringify(res.data)}`);
    },
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando...</div>;
  }
  if (!rule) {
    return <div className="p-6 text-destructive text-sm">Regra não encontrada</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/automations">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Automações
        </Link>
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{rule.name}</h1>
          <p className="text-sm text-muted-foreground">Gatilho: {rule.trigger}</p>
        </div>
        <Button
          variant={rule.isActive ? 'default' : 'outline'}
          onClick={() => toggleActive.mutate(!rule.isActive)}
        >
          {rule.isActive ? 'Ativa' : 'Ativar regra'}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Se (condições — todas devem passar)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {conds.map((c, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-end border p-3 rounded-lg">
              <select
                className="h-10 rounded-md border px-2 text-sm"
                value={c.field}
                onChange={(e) => {
                  const next = [...conds];
                  next[i] = { ...c, field: e.target.value };
                  setConds(next);
                }}
              >
                {fields.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                className="h-10 rounded-md border px-2 text-sm"
                value={c.operator}
                onChange={(e) => {
                  const next = [...conds];
                  next[i] = { ...c, operator: e.target.value };
                  setConds(next);
                }}
              >
                {operators.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Input
                className="flex-1 min-w-[120px]"
                value={String(c.value ?? '')}
                onChange={(e) => {
                  const next = [...conds];
                  next[i] = { ...c, value: e.target.value };
                  setConds(next);
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConds(conds.filter((_, j) => j !== i))}
              >
                Remover
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setConds([
                ...conds,
                { id: `new-${conds.length}`, field: 'message.body', operator: 'contains', value: '' },
              ])
            }
          >
            + Condição
          </Button>
          <Button onClick={() => saveConds.mutate()} disabled={saveConds.isPending}>
            Salvar condições
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Então (ações em ordem)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {acts.map((a, i) => (
            <div key={i} className="flex flex-wrap gap-2 items-end border p-3 rounded-lg">
              <select
                className="h-10 rounded-md border px-2 text-sm"
                value={a.type}
                onChange={(e) => {
                  const next = [...acts];
                  next[i] = { ...a, type: e.target.value };
                  setActs(next);
                }}
              >
                {actionTypes.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
              <Input
                className="flex-1 min-w-[160px]"
                placeholder='config JSON ex: {"stageName":"Qualificação"}'
                defaultValue={JSON.stringify(a.config ?? {})}
                onBlur={(e) => {
                  try {
                    const next = [...acts];
                    next[i] = { ...a, config: JSON.parse(e.target.value || '{}') };
                    setActs(next);
                  } catch {
                    toast.error('JSON inválido na ação');
                  }
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setActs(acts.filter((_, j) => j !== i))}
              >
                Remover
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setActs([
                ...acts,
                { id: `new-${acts.length}`, type: 'RUN_AI_AGENT', position: acts.length, config: {} },
              ])
            }
          >
            + Ação
          </Button>
          <Button onClick={() => saveActs.mutate()} disabled={saveActs.isPending}>
            Salvar ações
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Testar (dry-run)</CardTitle>
          <CardDescription>Não executa ações reais</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Mensagem simulada</Label>
          <Input value={testBody} onChange={(e) => setTestBody(e.target.value)} />
          <Button variant="outline" onClick={() => dryRun.mutate()} disabled={dryRun.isPending}>
            <TestTube className="h-4 w-4 mr-1" />
            Testar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas execuções</CardTitle>
        </CardHeader>
        <CardContent className="text-xs space-y-2">
          {!rule.executions?.length ? (
            <p className="text-muted-foreground">Nenhuma execução ainda.</p>
          ) : (
            rule.executions.map((ex) => (
              <div key={ex.id} className="border-b py-2">
                <span className={ex.status === 'SUCCESS' ? 'text-green-700' : 'text-red-700'}>
                  {ex.status}
                </span>{' '}
                · {new Date(ex.startedAt).toLocaleString('pt-BR')}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
