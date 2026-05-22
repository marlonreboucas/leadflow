'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessagesByDayChart, DealsByStageChart } from '@/components/reports-charts';

type ReportOverview = {
  messagesByDay: Array<{ day: string; count: number }>;
  dealsByStage: Array<{ stage: string; count: number }>;
  ai: { totalCostCents: number; runs: number; tokens: number };
  topAgents: Array<{ agentId: string; runs: number; costCents: number }>;
};

export default function ReportsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['reports-overview'],
    queryFn: async () => (await api.get<ReportOverview>('/reports/overview')).data,
  });

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold">Relatórios</h1>
        <p className="text-sm text-muted-foreground">Últimos 30 dias — agregações em tempo real</p>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardDescription>Custo IA (¢)</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? '…' : ((data?.ai.totalCostCents ?? 0) / 100).toFixed(2)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            {data?.ai.runs ?? 0} execuções · {data?.ai.tokens ?? 0} tokens
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Mensagens (dias com tráfego)</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? '…' : data?.messagesByDay.length ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Etapas com leads abertos</CardDescription>
            <CardTitle className="text-3xl">
              {isLoading ? '…' : data?.dealsByStage.length ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button variant="outline" size="sm" asChild>
              <Link href="/kanban">Kanban</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensagens por dia</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <MessagesByDayChart
              data={(data?.messagesByDay ?? []).map((m) => ({
                day: String(m.day),
                count: m.count,
              }))}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leads por etapa</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : (
            <DealsByStageChart data={data?.dealsByStage ?? []} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top agentes IA (execuções)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          {data?.topAgents.map((a) => (
            <div key={a.agentId} className="flex justify-between">
              <span className="font-mono text-xs">{a.agentId.slice(0, 12)}…</span>
              <span>
                {a.runs} runs · {(a.costCents / 100).toFixed(2)} ¢
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
