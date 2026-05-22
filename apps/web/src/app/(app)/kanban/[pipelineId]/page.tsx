'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { fetchDeals, fetchPipelineForecast, fetchPipelines, formatBRL } from '@/lib/crm';
import { KanbanBoard } from '@/components/crm/kanban-board';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function KanbanPipelinePage() {
  const { pipelineId } = useParams<{ pipelineId: string }>();
  const [ownerFilter, setOwnerFilter] = useState<'all' | 'human' | 'ai'>('all');

  const pipelinesQuery = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
  });

  const pipeline = pipelinesQuery.data?.find((p) => p.id === pipelineId);

  const dealsQuery = useQuery({
    queryKey: ['deals', pipelineId],
    queryFn: () => fetchDeals({ pipelineId, status: 'OPEN', take: 500 }),
    enabled: Boolean(pipelineId),
  });

  const forecastQuery = useQuery({
    queryKey: ['forecast', pipelineId],
    queryFn: () => fetchPipelineForecast(pipelineId),
    enabled: Boolean(pipelineId),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b flex flex-wrap items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{pipeline?.name ?? 'Funil'}</h1>
          <p className="text-sm text-muted-foreground">
            {dealsQuery.data?.total ?? 0} leads abertos · arraste cards entre colunas
            {forecastQuery.data ? (
              <>
                {' '}
                · forecast {formatBRL(forecastQuery.data.weightedForecast)}
                {' '}
                (aberto {formatBRL(forecastQuery.data.totalOpenValue)})
              </>
            ) : null}
          </p>
          {forecastQuery.data && forecastQuery.data.wonThisMonthValueCents > 0 ? (
            <p className="text-xs text-green-700">
              Ganhos no mês: {formatBRL(forecastQuery.data.wonThisMonthValueCents)} (
              {forecastQuery.data.wonThisMonthCount} negócios)
            </p>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {pipelinesQuery.data?.map((p) => (
            <Link
              key={p.id}
              href={`/kanban/${p.id}`}
              className={cn(
                'text-sm px-3 py-1.5 rounded-md border transition-colors',
                p.id === pipelineId
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'hover:bg-accent',
              )}
            >
              {p.name}
            </Link>
          ))}
        </div>
        <div className="flex gap-1 rounded-md border p-0.5">
          {(
            [
              ['all', 'Todos'],
              ['human', 'Humanos'],
              ['ai', 'IA'],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={ownerFilter === key ? 'default' : 'ghost'}
              className="h-7 text-xs"
              onClick={() => setOwnerFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden px-6 py-4">
        {dealsQuery.isError ? (
          <p className="text-sm text-destructive">Erro ao carregar deals.</p>
        ) : dealsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando board...</p>
        ) : pipeline ? (
          <KanbanBoard
            pipeline={pipeline}
            deals={dealsQuery.data?.items ?? []}
            ownerFilter={ownerFilter}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Pipeline não encontrado.</p>
        )}
      </div>
    </div>
  );
}
