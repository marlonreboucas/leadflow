'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type AuditLog = {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  userId: string | null;
  createdAt: string;
};

type WebhookLog = {
  id: string;
  direction: string;
  source: string;
  endpoint: string | null;
  status: number | null;
  createdAt: string;
  payload: { event?: string };
};

export default function LogsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['webhook-logs'],
    queryFn: async () => (await api.get<WebhookLog[]>('/logs/webhooks')).data,
    refetchInterval: 10_000,
  });

  const audit = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => (await api.get<AuditLog[]>('/logs/audit')).data,
    refetchInterval: 15_000,
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Logs</h1>
        <p className="text-sm text-muted-foreground">
          Webhooks recebidos (Evolution, n8n…) — atualiza a cada 10s
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Auditoria (ações na API)</CardTitle>
        </CardHeader>
        <CardContent>
          {audit.isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !audit.data?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum registro ainda.</p>
          ) : (
            <div className="text-sm space-y-1 max-h-48 overflow-y-auto">
              {audit.data.map((a) => (
                <div key={a.id} className="flex justify-between border-b py-1">
                  <span>
                    {a.action} · {a.entity}
                    {a.entityId ? ` · ${a.entityId.slice(0, 8)}…` : ''}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(a.createdAt).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Webhooks</CardTitle>
          <CardDescription>
            Se não aparecer nada após mensagem no WhatsApp, clique em Sincronizar webhook em
            /whatsapp
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="text-sm text-destructive">Sem permissão ou API indisponível.</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !data?.length ? (
            <p className="text-sm text-muted-foreground">Nenhum webhook registrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-4">Quando</th>
                    <th className="py-2 pr-4">Fonte</th>
                    <th className="py-2 pr-4">Evento</th>
                    <th className="py-2 pr-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((log) => (
                    <tr key={log.id} className="border-b border-border/50">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2 pr-4">{log.source}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {(log.payload as { event?: string })?.event ?? '—'}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={cn(
                            'px-1.5 py-0.5 rounded text-xs',
                            log.status && log.status < 400
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800',
                          )}
                        >
                          {log.status ?? '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
