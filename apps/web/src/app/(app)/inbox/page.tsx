'use client';

import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@leadflow/shared';
import { temperatureClass, temperatureLabel } from '@/lib/crm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Bot, Pause, Play, Sparkles, User } from 'lucide-react';
import { toast } from 'sonner';
import { InboxDealPanel } from '@/components/inbox/inbox-deal-panel';
import { QuickTemplates } from '@/components/inbox/quick-templates';

type InboxFilter = 'all' | 'unread' | 'mine' | 'no_deal' | 'hot';

type Conversation = {
  id: string;
  status: string;
  unreadCount: number;
  isAiPaused: boolean;
  handlingMode: string;
  assignedUserId?: string | null;
  contact: { id: string; name: string | null; phone: string; email?: string | null };
  currentAgent?: { id: string; name: string; mode?: string } | null;
  lastMessage: { body: string | null; createdAt: string } | null;
  deals?: Array<{
    id: string;
    title: string;
    valueCents: number;
    temperature: 'COLD' | 'WARM' | 'HOT';
    stage: { id: string; name: string };
  }>;
};

type Message = {
  id: string;
  body: string | null;
  direction: string;
  senderType: string;
  status?: string;
  createdAt: string;
};

type ConversationDetail = Conversation & {
  deals?: Array<{
    id: string;
    title: string;
    valueCents: number;
    status: 'OPEN' | 'WON' | 'LOST';
    temperature: 'COLD' | 'WARM' | 'HOT';
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
  }>;
};

const FILTERS: { key: InboxFilter; label: string }[] = [
  { key: 'all', label: 'Todas' },
  { key: 'unread', label: 'Não lidas' },
  { key: 'mine', label: 'Minhas' },
  { key: 'no_deal', label: 'Sem lead' },
  { key: 'hot', label: 'Quentes' },
];

export default function InboxPage() {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>('all');
  const [searchQ, setSearchQ] = useState('');

  const conversations = useQuery({
    queryKey: ['conversations', inboxFilter, searchQ],
    queryFn: async () => {
      const { data } = await api.get<{ items: Conversation[] }>('/conversations', {
        params: {
          filter: inboxFilter === 'all' ? undefined : inboxFilter,
          q: searchQ || undefined,
          take: 80,
        },
      });
      return data.items;
    },
    refetchInterval: 8000,
  });

  const detail = useQuery({
    queryKey: ['conversation', activeId],
    queryFn: async () => {
      const { data } = await api.get<ConversationDetail>(`/conversations/${activeId}`);
      return data;
    },
    enabled: Boolean(activeId),
  });

  const templates = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string; body: string }>>('/templates');
      return data;
    },
  });

  const messages = useQuery({
    queryKey: ['messages', activeId],
    queryFn: async () => {
      const { data } = await api.get<{ items: Message[] }>(
        `/conversations/${activeId}/messages`,
      );
      return data.items;
    },
    enabled: Boolean(activeId),
  });

  const selectConversation = (id: string) => {
    setActiveId(id);
    setAiSuggestion(null);
    api.post(`/conversations/${id}/read`).catch(() => {});
    qc.invalidateQueries({ queryKey: ['conversations'] });
  };

  const send = useMutation({
    mutationFn: async () => {
      await api.post('/messages', { conversationId: activeId, body: draft.trim() });
    },
    onSuccess: () => {
      setDraft('');
      setAiSuggestion(null);
      qc.invalidateQueries({ queryKey: ['messages', activeId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
    onError: (err: { response?: { data?: { message?: string } } }) => {
      toast.error(
        err?.response?.data?.message ??
          'Não foi possível enviar. Verifique se o WhatsApp está conectado.',
      );
    },
  });

  const assume = useMutation({
    mutationFn: async (id: string) => api.post(`/conversations/${id}/assume`),
    onSuccess: () => {
      toast.success('Conversa assumida');
      qc.invalidateQueries({ queryKey: ['conversation', activeId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  const pauseAi = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/ai/pause`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversation', activeId] }),
  });

  const resumeAi = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/ai/resume`),
    onSuccess: () => {
      toast.success('IA reativada');
      qc.invalidateQueries({ queryKey: ['conversation', activeId] });
    },
  });

  const runAi = useMutation({
    mutationFn: (id: string) => api.post(`/conversations/${id}/ai/run`),
    onSuccess: () => {
      const mode = detail.data?.currentAgent?.mode;
      const isAuto = mode === 'FULL_AUTO';
      toast.message(
        isAuto
          ? 'IA processando… a resposta deve ir ao WhatsApp em alguns segundos.'
          : 'IA processando… em modo Sugestão, aguarde o texto roxo acima do chat.',
      );
      for (const ms of [2500, 6000, 12000]) {
        setTimeout(() => qc.invalidateQueries({ queryKey: ['messages', activeId] }), ms);
      }
    },
    onError: () =>
      toast.error('Não foi possível acionar a IA. Verifique API e worker.'),
  });

  const createDeal = useMutation({
    mutationFn: async (title: string) => {
      await api.post(`/conversations/${activeId}/deals`, { title });
    },
    onSuccess: () => {
      toast.success('Lead criado no funil');
      qc.invalidateQueries({ queryKey: ['conversation', activeId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  useEffect(() => {
    const s = getSocket();
    if (!s) return;

    const refreshList = () => qc.invalidateQueries({ queryKey: ['conversations'] });
    const refreshMsgs = () => {
      if (activeId) {
        qc.invalidateQueries({ queryKey: ['messages', activeId] });
        qc.invalidateQueries({ queryKey: ['conversation', activeId] });
      }
    };

    s.on(SOCKET_EVENTS.CONVERSATION_UPDATED, () => {
      refreshList();
      refreshMsgs();
    });
    s.on(SOCKET_EVENTS.MESSAGE_RECEIVED, refreshMsgs);
    s.on(SOCKET_EVENTS.MESSAGE_SENT, refreshMsgs);
    s.on(SOCKET_EVENTS.MESSAGE_STATUS_UPDATED, refreshMsgs);
    s.on(SOCKET_EVENTS.CONVERSATION_CREATED, refreshList);
    s.on(SOCKET_EVENTS.DEAL_MOVED, refreshList);
    s.on(SOCKET_EVENTS.LEAD_UPDATED, () => {
      refreshList();
      refreshMsgs();
    });
    s.on(SOCKET_EVENTS.AI_RESPONSE_GENERATED, (payload: { text?: string }) => {
      if (payload?.text) setAiSuggestion(payload.text);
      refreshMsgs();
    });

    return () => {
      s.off(SOCKET_EVENTS.CONVERSATION_UPDATED);
      s.off(SOCKET_EVENTS.MESSAGE_RECEIVED);
      s.off(SOCKET_EVENTS.MESSAGE_SENT);
      s.off(SOCKET_EVENTS.MESSAGE_STATUS_UPDATED);
      s.off(SOCKET_EVENTS.CONVERSATION_CREATED);
      s.off(SOCKET_EVENTS.DEAL_MOVED);
      s.off(SOCKET_EVENTS.LEAD_UPDATED);
      s.off(SOCKET_EVENTS.AI_RESPONSE_GENERATED);
    };
  }, [qc, activeId]);

  useEffect(() => {
    const s = getSocket();
    if (!s || !activeId) return;
    s.emit(SOCKET_EVENTS.CONVERSATION_JOIN, { conversationId: activeId });
    return () => {
      s.emit(SOCKET_EVENTS.CONVERSATION_LEAVE, { conversationId: activeId });
    };
  }, [activeId]);

  const active = detail.data;

  const statusLabel: Record<string, string> = {
    PENDING: 'Enviando…',
    SENT: 'Enviado',
    DELIVERED: 'Entregue',
    READ: 'Lido',
    FAILED: 'Falhou',
  };

  return (
    <div className="flex h-full min-h-0 max-h-full overflow-hidden">
      <aside className="w-80 border-r flex flex-col shrink-0 bg-card/30">
        <div className="p-3 border-b space-y-2">
          <div className="font-medium flex justify-between items-center">
            <span>Inbox</span>
            <Link href="/whatsapp" className="text-xs text-primary hover:underline">
              WhatsApp
            </Link>
          </div>
          <Input
            placeholder="Buscar nome ou telefone…"
            value={searchQ}
            onChange={(e) => setSearchQ(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setInboxFilter(f.key)}
                className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full border transition-colors',
                  inboxFilter === f.key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-muted',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.isLoading ? (
            <p className="p-3 text-sm text-muted-foreground">Carregando...</p>
          ) : !conversations.data?.length ? (
            <p className="p-3 text-sm text-muted-foreground">
              Nenhuma conversa neste filtro.
            </p>
          ) : (
            conversations.data.map((c) => {
              const deal = c.deals?.[0];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => selectConversation(c.id)}
                  className={cn(
                    'w-full text-left px-3 py-3 border-b hover:bg-muted/50 transition-colors',
                    activeId === c.id && 'bg-primary/10 border-l-2 border-l-primary',
                  )}
                >
                  <div className="font-medium text-sm truncate flex items-center gap-1">
                    {c.contact.name ?? c.contact.phone}
                    {deal?.temperature === 'HOT' ? (
                      <span className={cn('text-[10px] px-1 rounded', temperatureClass.HOT)}>
                        {temperatureLabel.HOT}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {c.lastMessage?.body ?? 'Sem mensagens'}
                  </div>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {c.unreadCount > 0 ? (
                      <span className="text-[10px] bg-primary text-primary-foreground px-1.5 rounded">
                        {c.unreadCount}
                      </span>
                    ) : null}
                    {deal ? (
                      <span className="text-[10px] bg-slate-100 text-slate-700 px-1 rounded truncate max-w-[120px]">
                        {deal.stage.name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-700 bg-amber-50 px-1 rounded">
                        sem lead
                      </span>
                    )}
                    {c.currentAgent ? (
                      <span className="text-[10px] bg-violet-100 text-violet-700 px-1 rounded flex items-center gap-0.5">
                        <Bot className="h-3 w-3" />
                        IA
                      </span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
        {active ? (
          <>
            <div className="h-12 shrink-0 border-b px-4 flex items-center justify-between gap-2 flex-wrap">
              <div>
                <span className="font-medium">
                  {active.contact.name ?? active.contact.phone}
                </span>
                <span className="text-xs text-muted-foreground ml-2">{active.status}</span>
              </div>
              <div className="flex gap-1 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => runAi.mutate(active.id)}>
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  IA
                </Button>
                {active.isAiPaused ? (
                  <Button size="sm" variant="outline" onClick={() => resumeAi.mutate(active.id)}>
                    <Play className="h-3.5 w-3.5 mr-1" />
                    Ativar IA
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => pauseAi.mutate(active.id)}>
                    <Pause className="h-3.5 w-3.5 mr-1" />
                    Pausar IA
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => assume.mutate(active.id)}>
                  <User className="h-3.5 w-3.5 mr-1" />
                  Assumir
                </Button>
              </div>
            </div>

            {aiSuggestion ? (
              <div className="mx-4 mt-2 shrink-0 p-3 rounded-lg border border-violet-200 bg-violet-50 text-sm">
                <div className="flex items-center gap-1 text-violet-800 font-medium text-xs mb-1">
                  <Bot className="h-3.5 w-3.5" />
                  Sugestão da IA
                </div>
                <p className="text-violet-950 whitespace-pre-wrap">{aiSuggestion}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setDraft(aiSuggestion);
                      setAiSuggestion(null);
                    }}
                  >
                    Usar sugestão
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setAiSuggestion(null)}>
                    Descartar
                  </Button>
                </div>
              </div>
            ) : null}

            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
              {messages.data?.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'max-w-[80%] rounded-lg px-3 py-2 text-sm',
                    m.direction === 'OUTBOUND'
                      ? 'ml-auto bg-primary text-primary-foreground'
                      : 'bg-muted',
                  )}
                >
                  {m.senderType === 'AI_AGENT' ? (
                    <span className="text-[10px] opacity-80 block mb-0.5">IA</span>
                  ) : null}
                  {m.body}
                  {m.direction === 'OUTBOUND' && m.status ? (
                    <span className="text-[10px] opacity-70 block mt-1 text-right">
                      {statusLabel[m.status] ?? m.status}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            <form
              className="shrink-0 border-t bg-background p-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft.trim() && activeId) send.mutate();
              }}
            >
              <QuickTemplates
                templates={templates.data ?? []}
                onPick={(body) => setDraft(body)}
              />
              {templates.data?.length ? (
                <select
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    const t = templates.data?.find((x) => x.id === e.target.value);
                    if (t) setDraft(t.body);
                    e.target.value = '';
                  }}
                >
                  <option value="">Mais templates…</option>
                  {templates.data.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : null}
              <div className="flex gap-2">
                <Input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (draft.trim() && activeId) send.mutate();
                    }
                  }}
                />
                <Button type="submit" disabled={send.isPending || !draft.trim()}>
                  {send.isPending ? 'Enviando...' : 'Enviar'}
                </Button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecione uma conversa
          </div>
        )}
      </section>

      <aside className="w-80 border-l shrink-0 hidden lg:flex flex-col bg-card/20 overflow-y-auto">
        {active ? (
          <div className="p-4 space-y-4">
            <div className="text-xs text-muted-foreground space-y-0.5">
              <p className="font-medium text-foreground text-sm">Contato</p>
              <p>{active.contact.phone}</p>
              {active.currentAgent ? (
                <p className="text-violet-700">
                  Agente: {active.currentAgent.name}
                  {active.currentAgent.mode === 'FULL_AUTO' ? ' · automático' : ' · sugestão'}
                </p>
              ) : null}
            </div>
            <InboxDealPanel
              conversationId={active.id}
              contactName={active.contact.name ?? active.contact.phone}
              deals={(active.deals ?? []) as Parameters<typeof InboxDealPanel>[0]['deals']}
              onCreateDeal={(title) => createDeal.mutate(title)}
              creatingDeal={createDeal.isPending}
            />
          </div>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">Selecione uma conversa para ver o lead</p>
        )}
      </aside>
    </div>
  );
}
