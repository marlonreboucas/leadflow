'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@leadflow/shared';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { ExternalLink, RefreshCw } from 'lucide-react';

type Instance = {
  id: string;
  externalName: string;
  status: string;
  phoneNumber: string | null;
  qrCode: string | null;
  settings?: { pairingCode?: string } | null;
};

type QrResponse = {
  qrCode: string | null;
  pairingCode?: string | null;
  managerUrl?: string;
  hint?: string;
};

export default function WhatsappPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-instances'],
    queryFn: async () => {
      const { data: list } = await api.get<Instance[]>('/whatsapp/instances');
      return list;
    },
    refetchInterval: (q) => {
      const needsSync = q.state.data?.some((i) =>
        ['PENDING', 'CONNECTING'].includes(i.status),
      );
      return needsSync ? 3000 : false;
    },
  });

  const create = useMutation({
    mutationFn: () => api.post<Instance>('/whatsapp/instances'),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      if (res.data.qrCode) toast.success('QR code gerado — escaneie no WhatsApp');
      else toast.message('Instância criada', {
        description: 'Clique em "Gerar QR" ou abra o Evolution Manager.',
      });
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message ?? 'Falha ao criar (Evolution rodando?)');
    },
  });

  const refreshWebhook = useMutation({
    mutationFn: (id: string) =>
      api.post<{ url: string; updated: boolean }>(`/whatsapp/instances/${id}/webhook`),
    onSuccess: (res) => {
      toast.success(
        res.data.updated
          ? `Webhook atualizado: ${res.data.url}`
          : 'Webhook já estava correto',
      );
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(err?.response?.data?.message ?? 'Falha ao atualizar webhook');
    },
  });

  const refreshQr = useMutation({
    mutationFn: (id: string) => api.get<QrResponse>(`/whatsapp/instances/${id}/qr`),
    onSuccess: (res, id) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-instances'] });
      if (res.data.qrCode) toast.success('QR atualizado');
      else if (res.data.hint) toast.message('Sem QR ainda', { description: res.data.hint });
      else toast.message('Aguardando QR', { description: 'Tente de novo em alguns segundos.' });
    },
    onError: () => toast.error('Erro ao buscar QR'),
  });

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const onUpdate = () => qc.invalidateQueries({ queryKey: ['whatsapp-instances'] });
    s.on(SOCKET_EVENTS.WHATSAPP_STATUS_UPDATED, onUpdate);
    return () => {
      s.off(SOCKET_EVENTS.WHATSAPP_STATUS_UPDATED, onUpdate);
    };
  }, [qc]);

  const qrFetched = useRef(new Set<string>());
  useEffect(() => {
    data?.forEach((inst) => {
      if (
        !inst.qrCode &&
        ['PENDING', 'CONNECTING'].includes(inst.status) &&
        !qrFetched.current.has(inst.id)
      ) {
        qrFetched.current.add(inst.id);
        refreshQr.mutate(inst.id);
      }
    });
  }, [data]);

  const managerUrl =
    process.env.NEXT_PUBLIC_EVOLUTION_URL ?? 'http://localhost:8080/manager';

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">WhatsApp</h1>
          <p className="text-sm text-muted-foreground">
            Conecte via QR code (Evolution API)
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={managerUrl} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4 mr-1" />
              Manager
            </a>
          </Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>
            Nova instância
          </Button>
        </div>
      </div>

      <Card className="border-amber-200 bg-amber-50/50">
        <CardContent className="pt-4 text-sm text-amber-900 space-y-2">
          <p>
            <strong>Checklist:</strong> `pnpm docker:up` · mesma `EVOLUTION_API_KEY` no `.env` e no
            Docker · se o QR não aparecer, recrie o container Evolution (imagem v2.3.7+).
          </p>
          <p className="text-xs">
            Após escanear o QR, o status atualiza sozinho (consulta a Evolution). Para mensagens no
            Inbox no Windows, use no `.env`:{' '}
            <code className="bg-amber-100 px-1 rounded">
              WEBHOOK_PUBLIC_URL=http://host.docker.internal:3001
            </code>{' '}
            e reinicie `pnpm dev` + Docker.
          </p>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : !data?.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Nenhuma instância</CardTitle>
            <CardDescription>Crie a primeira instância para gerar o QR.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        data.map((inst) => (
          <Card key={inst.id}>
            <CardHeader>
              <CardTitle className="text-base">{inst.externalName}</CardTitle>
              <CardDescription>
                Status: <strong>{inst.status}</strong>
                {inst.phoneNumber ? ` · ${inst.phoneNumber}` : ''}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {inst.qrCode ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={inst.qrCode}
                  alt="QR Code WhatsApp"
                  className="w-56 h-56 border rounded bg-white"
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Aguardando QR… WhatsApp → Aparelhos conectados → Conectar aparelho.
                </p>
              )}
              {inst.settings?.pairingCode ? (
                <p className="text-sm">
                  Código de pareamento:{' '}
                  <code className="bg-muted px-2 py-1 rounded">{inst.settings.pairingCode}</code>
                </p>
              ) : null}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refreshQr.mutate(inst.id)}
                  disabled={refreshQr.isPending}
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-1 ${refreshQr.isPending ? 'animate-spin' : ''}`}
                  />
                  Gerar QR
                </Button>
                {inst.status === 'CONNECTED' ? (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => refreshWebhook.mutate(inst.id)}
                      disabled={refreshWebhook.isPending}
                    >
                      Sincronizar webhook
                    </Button>
                    <Button size="sm" asChild>
                      <a href="/inbox">Abrir Inbox</a>
                    </Button>
                  </>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
