'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { fetchAgent, testAgent } from '@/lib/agents';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { AgentForm } from '@/components/agent-form';

export default function AgentDetailPage() {
  const { agentId } = useParams<{ agentId: string }>();
  const [message, setMessage] = useState('Olá, quanto custa o plano?');
  const [reply, setReply] = useState('');

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent', agentId],
    queryFn: () => fetchAgent(agentId),
    enabled: Boolean(agentId) && agentId !== 'new',
  });

  const playground = useMutation({
    mutationFn: () => testAgent(agentId, message),
    onSuccess: (res) => {
      setReply(res.reply);
      toast.success(`Resposta gerada (${res.inputTokens + res.outputTokens} tokens)`);
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Erro no playground (verifique OPENAI_API_KEY)');
    },
  });

  if (agentId === 'new') {
    return (
      <div className="p-6 space-y-6 max-w-3xl">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/agents">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Agentes
          </Link>
        </Button>
        <AgentForm />
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Carregando agente...</div>;
  }

  if (!agent) {
    return <div className="p-6 text-sm text-destructive">Agente não encontrado.</div>;
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/agents">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Agentes
        </Link>
      </Button>

      <div>
        <h1 className="text-2xl font-semibold">{agent.name}</h1>
        <p className="text-sm text-muted-foreground">
          {agent.type} · {agent.model} · modo {agent.mode}
        </p>
      </div>

      <AgentForm
        agentId={agent.id}
        initial={{
          name: agent.name,
          type: agent.type as 'SDR',
          model: agent.model,
          mode: agent.mode as 'SUGGEST',
          systemPrompt: agent.systemPrompt,
          objective: agent.objective ?? '',
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
          isActive: agent.isActive,
        }}
        initialKnowledgeBaseIds={
          (agent.knowledgeBases as { kb: { id: string } }[] | undefined)?.map((l) => l.kb.id) ??
          []
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Playground</CardTitle>
          <CardDescription>
            Testa o agente sem enviar WhatsApp (não persiste mensagens).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={3}
            placeholder="Mensagem simulada do cliente..."
          />
          <Button onClick={() => playground.mutate()} disabled={playground.isPending}>
            {playground.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              'Testar resposta'
            )}
          </Button>
          {reply ? (
            <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
              {reply}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Últimas execuções</CardTitle>
        </CardHeader>
        <CardContent>
          {!agent.logs?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum log ainda.</p>
          ) : (
            <ul className="text-xs space-y-2">
              {(agent.logs as Array<{ decision: string; costCents: number; createdAt: string }>).map(
                (log, i) => (
                  <li key={i} className="flex justify-between border-b py-1">
                    <span>{log.decision}</span>
                    <span className="text-muted-foreground">
                      {(log.costCents / 100).toFixed(4)} ¢ ·{' '}
                      {new Date(log.createdAt).toLocaleString('pt-BR')}
                    </span>
                  </li>
                ),
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
