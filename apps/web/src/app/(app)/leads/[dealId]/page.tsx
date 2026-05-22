'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  fetchDeal,
  fetchDealTimeline,
  formatBRL,
  temperatureLabel,
  type TimelineItem,
} from '@/lib/crm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Bot, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function LeadDetailPage() {
  const { dealId } = useParams<{ dealId: string }>();

  const { data: deal, isLoading, isError } = useQuery({
    queryKey: ['deal', dealId],
    queryFn: () => fetchDeal(dealId),
    enabled: Boolean(dealId),
  });

  const timeline = useQuery({
    queryKey: ['deal-timeline', dealId],
    queryFn: () => fetchDealTimeline(dealId),
    enabled: Boolean(dealId),
  });

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando lead...</div>;
  }

  if (isError || !deal) {
    return <div className="p-6 text-sm text-destructive">Lead não encontrado.</div>;
  }

  const tasks = (deal as { tasks?: { id: string; title: string; status: string; dueAt: string | null }[] })
    .tasks;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/leads">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Voltar
          </Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href="/inbox">Abrir Inbox</Link>
        </Button>
        <Button variant="outline" size="sm" asChild>
          <Link href={`/kanban/${deal.pipelineId}`}>Ver no funil</Link>
        </Button>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">{deal.title}</h1>
        <p className="text-sm text-muted-foreground">
          {deal.pipeline.name} · {deal.stage.name} · {temperatureLabel[deal.temperature]}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Valor" value={formatBRL(deal.valueCents)} />
            <Row label="Temperatura" value={temperatureLabel[deal.temperature]} />
            <Row label="Status" value={deal.status} />
            <Row
              label="Responsável"
              value={deal.ownerUser?.name ?? deal.ownerAgent?.name ?? '—'}
            />
            {deal.nextActionAt ? (
              <Row
                label="Próxima ação"
                value={new Date(deal.nextActionAt).toLocaleString('pt-BR')}
              />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Nome" value={deal.contact.name ?? '—'} />
            <Row label="Telefone" value={deal.contact.phone} />
            <Row label="E-mail" value={deal.contact.email ?? '—'} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tarefas</CardTitle>
          <CardDescription>Vinculadas a este lead</CardDescription>
        </CardHeader>
        <CardContent>
          {!tasks?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa vinculada.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((t) => (
                <li key={t.id} className="flex justify-between text-sm border-b py-2 last:border-0">
                  <span>{t.title}</span>
                  <span className="text-muted-foreground">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            Mensagens WhatsApp, decisões da IA e tarefas — ordem cronológica
          </CardDescription>
        </CardHeader>
        <CardContent>
          {timeline.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando histórico...</p>
          ) : !timeline.data?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum evento ainda.</p>
          ) : (
            <ul className="space-y-3">
              {timeline.data.map((item) => (
                <TimelineRow key={item.id} item={item} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TimelineRow({ item }: { item: TimelineItem }) {
  const Icon = item.type === 'ai' ? Bot : item.type === 'message' ? MessageSquare : null;
  return (
    <li className="flex gap-3 text-sm border-l-2 border-muted pl-3 py-1">
      {Icon ? (
        <Icon
          className={cn(
            'h-4 w-4 shrink-0 mt-0.5',
            item.type === 'ai' ? 'text-violet-600' : 'text-muted-foreground',
          )}
        />
      ) : (
        <span className="w-4 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex justify-between gap-2 flex-wrap">
          <span className="font-medium">{item.title}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(item.at).toLocaleString('pt-BR')}
          </span>
        </div>
        {item.body ? (
          <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">{item.body}</p>
        ) : null}
        {item.meta?.tools && item.meta.tools !== '—' ? (
          <p className="text-xs text-violet-700 mt-1">Tools: {item.meta.tools}</p>
        ) : null}
      </div>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
