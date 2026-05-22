'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  closeDeal,
  fetchPipelines,
  formatBRL,
  moveDeal,
  temperatureClass,
  temperatureLabel,
  updateDeal,
  type Deal,
} from '@/lib/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ExternalLink, Flame } from 'lucide-react';

type InboxDeal = {
  id: string;
  title: string;
  valueCents: number;
  temperature: Deal['temperature'];
  status: Deal['status'];
  stageId: string;
  pipelineId: string;
  stage: { id: string; name: string; isWon: boolean; isLost: boolean };
  pipeline: { id: string; name: string };
  tasks?: Array<{
    id: string;
    title: string;
    status: string;
    dueAt: string | null;
    kind: string;
  }>;
};

type Props = {
  conversationId: string;
  contactName: string;
  deals: InboxDeal[];
  onCreateDeal: (title: string) => void;
  creatingDeal?: boolean;
};

export function InboxDealPanel({
  conversationId,
  contactName,
  deals,
  onCreateDeal,
  creatingDeal,
}: Props) {
  const qc = useQueryClient();
  const primary = deals.find((d) => d.status === 'OPEN') ?? deals[0];
  const [dealTitle, setDealTitle] = useState('');
  const [valueReais, setValueReais] = useState('');
  const [closeReason, setCloseReason] = useState('');

  const pipelines = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
  });

  const pipeline = pipelines.data?.find((p) => p.id === primary?.pipelineId);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['conversation', conversationId] });
    qc.invalidateQueries({ queryKey: ['conversations'] });
    qc.invalidateQueries({ queryKey: ['deals'] });
  };

  const patchDeal = useMutation({
    mutationFn: (body: Parameters<typeof updateDeal>[1]) =>
      updateDeal(primary!.id, body),
    onSuccess: () => {
      toast.success('Lead atualizado');
      invalidate();
    },
  });

  const move = useMutation({
    mutationFn: ({ stageId, lossReason }: { stageId: string; lossReason?: string }) =>
      moveDeal(primary!.id, stageId, lossReason),
    onSuccess: () => {
      toast.success('Etapa atualizada');
      setCloseReason('');
      invalidate();
    },
  });

  const close = useMutation({
    mutationFn: ({ status, reason }: { status: 'WON' | 'LOST'; reason?: string }) =>
      closeDeal(primary!.id, status, reason),
    onSuccess: () => {
      toast.success('Negócio fechado');
      setCloseReason('');
      invalidate();
    },
  });

  if (!primary) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Lead no funil</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">Nenhum lead aberto para este contato.</p>
          <Input
            placeholder="Título do lead"
            value={dealTitle}
            onChange={(e) => setDealTitle(e.target.value)}
            className="h-8 text-sm"
          />
          <Button
            size="sm"
            className="w-full"
            disabled={creatingDeal}
            onClick={() => {
              onCreateDeal(dealTitle || `Lead — ${contactName}`);
              setDealTitle('');
            }}
          >
            Criar no funil
          </Button>
        </CardContent>
      </Card>
    );
  }

  const valueDisplay =
    valueReais !== '' ? valueReais : String((primary.valueCents / 100).toFixed(2)).replace('.', ',');

  return (
    <div className="space-y-3">
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm truncate pr-2">{primary.title}</CardTitle>
          <Link href={`/leads/${primary.id}`} className="text-primary shrink-0">
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            {primary.pipeline.name} · {primary.stage.name}
          </p>

          <div>
            <label className="text-xs text-muted-foreground">Valor (R$)</label>
            <div className="flex gap-1 mt-0.5">
              <Input
                className="h-8 text-sm"
                value={valueDisplay}
                onChange={(e) => setValueReais(e.target.value)}
                onBlur={() => {
                  const n = parseFloat(valueReais.replace(',', '.'));
                  if (!Number.isNaN(n) && n >= 0) {
                    patchDeal.mutate({ valueCents: Math.round(n * 100) });
                    setValueReais('');
                  }
                }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{formatBRL(primary.valueCents)}</p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground">Temperatura</label>
            <div className="flex gap-1 mt-1 flex-wrap">
              {(['COLD', 'WARM', 'HOT'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    'text-[10px] px-2 py-0.5 rounded-full border',
                    temperatureClass[t],
                    primary.temperature === t && 'ring-2 ring-primary ring-offset-1',
                  )}
                  onClick={() => patchDeal.mutate({ temperature: t })}
                >
                  {t === 'HOT' ? <Flame className="h-3 w-3 inline mr-0.5" /> : null}
                  {temperatureLabel[t]}
                </button>
              ))}
            </div>
          </div>

          {pipeline && primary.status === 'OPEN' ? (
            <div>
              <label className="text-xs text-muted-foreground">Mover etapa</label>
              <select
                className="mt-1 flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={primary.stageId}
                onChange={(e) => {
                  const stage = pipeline.stages.find((s) => s.id === e.target.value);
                  if (!stage) return;
                  if (stage.isLost && !closeReason.trim()) {
                    toast.message('Informe o motivo da perda abaixo e confirme');
                    return;
                  }
                  move.mutate({
                    stageId: stage.id,
                    lossReason: stage.isLost ? closeReason : undefined,
                  });
                }}
              >
                {pipeline.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.isWon ? ' ✓' : ''}
                    {s.isLost ? ' ✗' : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {primary.status === 'OPEN' ? (
            <div className="space-y-2 pt-1 border-t">
              <Input
                placeholder="Motivo ganho ou perda"
                value={closeReason}
                onChange={(e) => setCloseReason(e.target.value)}
                className="h-8 text-sm"
              />
              <div className="flex gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-green-700 border-green-300"
                  disabled={close.isPending}
                  onClick={() => close.mutate({ status: 'WON', reason: closeReason || undefined })}
                >
                  Ganho
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 text-red-700 border-red-300"
                  disabled={close.isPending}
                  onClick={() => {
                    if (!closeReason.trim()) {
                      toast.error('Informe o motivo da perda');
                      return;
                    }
                    close.mutate({ status: 'LOST', reason: closeReason });
                  }}
                >
                  Perdido
                </Button>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {primary.tasks?.length ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Próximas ações</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-2">
            {primary.tasks.map((t) => (
              <div key={t.id} className="flex justify-between gap-2">
                <span className="truncate">{t.title}</span>
                {t.dueAt ? (
                  <span className="text-muted-foreground shrink-0">
                    {new Date(t.dueAt).toLocaleDateString('pt-BR')}
                  </span>
                ) : null}
              </div>
            ))}
            <Button variant="link" size="sm" className="h-auto p-0" asChild>
              <Link href="/tasks">Ver tarefas</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {deals.length > 1 ? (
        <p className="text-xs text-muted-foreground px-1">
          +{deals.length - 1} outro(s) lead(s) —{' '}
          <Link href={`/leads/${deals[1].id}`} className="text-primary hover:underline">
            ver
          </Link>
        </p>
      ) : null}

      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link href={`/kanban/${primary.pipelineId}`}>Abrir funil</Link>
      </Button>
    </div>
  );
}
