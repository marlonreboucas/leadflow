'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatBRL } from '@/lib/crm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Inbox, Kanban, ListChecks, Bot, Smartphone, TrendingUp } from 'lucide-react';
import { OnboardingWizard } from '@/components/onboarding-wizard';

type Stats = {
  conversationsOpen: number;
  unreadMessages: number;
  dealsOpen: number;
  dealsNewToday: number;
  tasksPending: number;
  tasksOverdue: number;
  agentsActive: number;
  whatsappConnected: number;
  whatsappTotal: number;
  forecastWeightedCents?: number;
  wonThisMonthValueCents?: number;
  defaultPipelineId?: string | null;
};

export default function DashboardPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => (await api.get<Stats>('/dashboard/stats')).data,
    refetchInterval: 30_000,
  });

  const kpis = [
    {
      label: 'Conversas abertas',
      value: data?.conversationsOpen,
      sub: data?.unreadMessages ? `${data.unreadMessages} não lidas` : undefined,
      href: '/inbox',
      icon: Inbox,
    },
    {
      label: 'Leads no funil',
      value: data?.dealsOpen,
      sub: data?.dealsNewToday ? `+${data.dealsNewToday} hoje` : undefined,
      href: '/kanban',
      icon: Kanban,
    },
    {
      label: 'Forecast',
      value:
        data?.forecastWeightedCents != null
          ? formatBRL(data.forecastWeightedCents)
          : undefined,
      sub:
        data?.wonThisMonthValueCents
          ? `Ganhos mês ${formatBRL(data.wonThisMonthValueCents)}`
          : 'Valor ponderado por etapa',
      href: data?.defaultPipelineId ? `/kanban/${data.defaultPipelineId}` : '/kanban',
      icon: TrendingUp,
    },
    {
      label: 'Tarefas pendentes',
      value: data?.tasksPending,
      sub: data?.tasksOverdue ? `${data.tasksOverdue} atrasadas` : undefined,
      href: '/tasks',
      icon: ListChecks,
    },
    {
      label: 'Agentes IA ativos',
      value: data?.agentsActive,
      href: '/agents',
      icon: Bot,
    },
    {
      label: 'WhatsApp conectado',
      value:
        data?.whatsappTotal != null
          ? `${data.whatsappConnected}/${data.whatsappTotal}`
          : undefined,
      href: '/whatsapp',
      icon: Smartphone,
    },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral do seu CRM</p>
      </div>

      <OnboardingWizard />

      {isError ? (
        <p className="text-sm text-destructive">Erro ao carregar métricas. A API está rodando?</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {kpis.map((k) => {
            const Icon = k.icon;
            return (
              <Card key={k.label} className="hover:border-primary/30 transition-colors">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardDescription>{k.label}</CardDescription>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <CardTitle className="text-2xl">
                    {isLoading ? '…' : (k.value ?? '—')}
                  </CardTitle>
                  {k.sub ? (
                    <p className="text-xs text-muted-foreground">{k.sub}</p>
                  ) : null}
                </CardHeader>
                <CardContent className="pt-0">
                  <Button variant="link" size="sm" className="h-auto p-0" asChild>
                    <Link href={k.href}>Abrir</Link>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Próximos passos</CardTitle>
            <CardDescription>Enquanto aguarda mensagens no Inbox</CardDescription>
          </CardHeader>
          <CardContent className="text-sm space-y-2 text-muted-foreground">
            <p>1. Confirme WhatsApp <strong>CONNECTED</strong> e sincronize o webhook.</p>
            <p>2. Peça para outro número enviar mensagem de teste.</p>
            <p>3. Responda no Inbox ou use sugestão do agente SDR.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Atalhos</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/inbox">Inbox</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/kanban">Funil</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/agents">Agentes IA</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/knowledge-base">Conhecimento</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
