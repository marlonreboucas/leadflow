'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type N8nWebhook = {
  id: string;
  name: string;
  url: string;
  events: string[];
  isActive: boolean;
  retries: number;
  createdAt: string;
  secret?: string;
};

const EVENT_OPTIONS = [
  'lead.created',
  'lead.stage_changed',
  'message.received',
  'ai.run_completed',
];

export default function N8nIntegrationsPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>(['lead.created']);
  const [lastSecret, setLastSecret] = useState<string | null>(null);

  const { data: webhooks, isLoading } = useQuery({
    queryKey: ['n8n-webhooks'],
    queryFn: async () => (await api.get<N8nWebhook[]>('/n8n/webhooks')).data,
  });

  const create = useMutation({
    mutationFn: async () =>
      (
        await api.post<N8nWebhook>('/n8n/webhooks', {
          name: name.trim(),
          url: url.trim(),
          events,
        })
      ).data,
    onSuccess: (hook) => {
      toast.success('Webhook n8n criado');
      setLastSecret(hook.secret ?? null);
      setName('');
      setUrl('');
      queryClient.invalidateQueries({ queryKey: ['n8n-webhooks'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar webhook');
    },
  });

  const toggleEvent = (ev: string) => {
    setEvents((prev) => (prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]));
  };

  const inboundBase =
    typeof window !== 'undefined'
      ? `${window.location.origin.replace(':3000', ':3001')}/api/n8n/inbound`
      : 'http://localhost:3001/api/n8n/inbound';

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold">Integração n8n</h1>
        <p className="text-sm text-muted-foreground">
          Webhooks de saída (LeadFlow → n8n) e URL de entrada para automações externas
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Novo webhook de saída</CardTitle>
          <CardDescription>Dispara quando eventos ocorrem no CRM</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Nome (slug inbound)</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="crm-sync" />
          </div>
          <div className="space-y-1">
            <Label>URL do workflow n8n</Label>
            <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://n8n.../webhook/..." />
          </div>
          <div className="space-y-2">
            <Label>Eventos</Label>
            <div className="flex flex-wrap gap-2">
              {EVENT_OPTIONS.map((ev) => (
                <Button
                  key={ev}
                  type="button"
                  size="sm"
                  variant={events.includes(ev) ? 'default' : 'outline'}
                  onClick={() => toggleEvent(ev)}
                >
                  {ev}
                </Button>
              ))}
            </div>
          </div>
          <Button
            disabled={!name.trim() || !url.trim() || !events.length || create.isPending}
            onClick={() => create.mutate()}
          >
            {create.isPending ? 'Criando...' : 'Criar webhook'}
          </Button>
          {lastSecret && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
              Secret (copie agora): <code className="font-mono">{lastSecret}</code>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhooks cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-3">
          {isLoading ? (
            <p className="text-muted-foreground">Carregando...</p>
          ) : !webhooks?.length ? (
            <p className="text-muted-foreground">Nenhum webhook ainda.</p>
          ) : (
            webhooks.map((w) => (
              <div key={w.id} className="border rounded-md p-3 space-y-1">
                <div className="font-medium">{w.name}</div>
                <div className="text-xs text-muted-foreground break-all">{w.url}</div>
                <div className="text-xs">{w.events.join(', ')}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Entrada (n8n → LeadFlow)</CardTitle>
          <CardDescription>POST com header X-LeadFlow-Signature (HMAC)</CardDescription>
        </CardHeader>
        <CardContent className="text-xs font-mono break-all space-y-2">
          <p>{inboundBase}/{'{companyId}'}/{'{slug}'}</p>
          <p className="text-muted-foreground font-sans">
            Body: <code>{'{"action":"create_lead","contactName":"...","phone":"..."}'}</code> ou{' '}
            <code>{'{"action":"move_stage","dealId":"...","stageName":"Qualificação"}'}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
