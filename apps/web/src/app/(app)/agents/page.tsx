'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { fetchAgents } from '@/lib/agents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Bot } from 'lucide-react';

const typeLabels: Record<string, string> = {
  SDR: 'SDR',
  SALES: 'Vendas',
  SUPPORT: 'Suporte',
  SCHEDULING: 'Agendamento',
  RECOVERY: 'Recuperação',
  FINANCE: 'Financeiro',
  SUPERVISOR: 'Supervisor',
  CUSTOM: 'Customizado',
};

export default function AgentsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['agents'],
    queryFn: fetchAgents,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agentes IA</h1>
          <p className="text-sm text-muted-foreground">
            SDR, vendas, suporte — com tools e base de conhecimento
          </p>
        </div>
        <Button asChild>
          <Link href="/agents/new">Novo agente</Link>
        </Button>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">Erro ao carregar agentes.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !data?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhum agente</CardTitle>
            <CardDescription>
              Configure OPENAI_API_KEY no .env e rode o seed para o agente demo.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.map((agent) => (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="hover:border-primary/40 transition-colors h-full">
                <CardHeader className="flex flex-row items-start gap-3">
                  <div className="h-10 w-10 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base truncate">{agent.name}</CardTitle>
                    <CardDescription>
                      {typeLabels[agent.type] ?? agent.type} · {agent.model}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="text-xs text-muted-foreground space-y-1">
                  <div>
                    Modo:{' '}
                    <span className="font-medium text-foreground">{agent.mode}</span>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={cn(
                        'px-1.5 py-0.5 rounded',
                        agent.isActive
                          ? 'bg-green-100 text-green-800'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {agent.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                    {agent._count?.logs ? (
                      <span>{agent._count.logs} execuções</span>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
