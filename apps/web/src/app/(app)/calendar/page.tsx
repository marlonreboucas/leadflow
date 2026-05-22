'use client';

import { useMemo, useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, dateFnsLocalizer, type View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import 'react-big-calendar/lib/css/react-big-calendar.css';

const locales = { 'pt-BR': ptBR };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

type Appointment = {
  id: string;
  title: string;
  description: string | null;
  dueAt: string;
  durationMinutes: number;
  status: string;
  googleEventId?: string | null;
  deal?: { contact?: { name: string | null; phone: string } };
  conversation?: { contact?: { name: string | null; phone: string } };
  createdByAgent?: { name: string } | null;
};

type CalEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: Appointment;
};

export default function CalendarPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<View>('month');
  const [date, setDate] = useState(new Date());
  const [title, setTitle] = useState('');
  const [dueAt, setDueAt] = useState('');

  const range = useMemo(() => {
    const from = new Date(date);
    from.setMonth(from.getMonth() - 1);
    const to = new Date(date);
    to.setMonth(to.getMonth() + 2);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [date]);

  const { data: events, isLoading } = useQuery({
    queryKey: ['calendar-events', range.from, range.to],
    queryFn: async () =>
      (
        await api.get<Appointment[]>('/calendar/events', {
          params: { from: range.from, to: range.to },
        })
      ).data,
  });

  const { data: googleStatus, refetch: refetchGoogle } = useQuery({
    queryKey: ['google-calendar-status'],
    queryFn: async () =>
      (await api.get<{ configured: boolean; connected: boolean }>(
        '/integrations/google-calendar/status',
      )).data,
  });

  const calEvents: CalEvent[] = useMemo(
    () =>
      (events ?? [])
        .filter((e) => e.dueAt && e.status !== 'CANCELED')
        .map((e) => {
          const start = new Date(e.dueAt);
          const end = new Date(start.getTime() + (e.durationMinutes ?? 60) * 60000);
          const contact =
            e.conversation?.contact?.name ?? e.deal?.contact?.name ?? '';
          return {
            id: e.id,
            title: contact ? `${e.title} · ${contact}` : e.title,
            start,
            end,
            resource: e,
          };
        }),
    [events],
  );

  const create = useMutation({
    mutationFn: async () =>
      api.post('/calendar/events', {
        title: title.trim(),
        dueAt: new Date(dueAt).toISOString(),
      }),
    onSuccess: () => {
      toast.success('Compromisso criado');
      setTitle('');
      setDueAt('');
      qc.invalidateQueries({ queryKey: ['calendar-events'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Erro ao agendar');
    },
  });

  const connectGoogle = useMutation({
    mutationFn: async () => {
      const { data } = await api.get<{ url: string }>('/integrations/google-calendar/auth-url');
      window.location.href = data.url;
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Google Calendar não configurado no .env');
    },
  });

  const disconnectGoogle = useMutation({
    mutationFn: async () => api.delete('/integrations/google-calendar'),
    onSuccess: () => {
      toast.success('Google Calendar desconectado');
      refetchGoogle();
    },
  });

  const onSelectSlot = useCallback(({ start }: { start: Date }) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
    setDueAt(local);
    setTitle('Novo compromisso');
  }, []);

  return (
    <div className="p-6 space-y-6 h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Calendário</h1>
          <p className="text-sm text-muted-foreground">
            Visualização mensal/semanal · agendamentos da IA no WhatsApp
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {googleStatus?.configured && !googleStatus.connected && (
            <Button variant="outline" size="sm" onClick={() => connectGoogle.mutate()}>
              Conectar Google Calendar
            </Button>
          )}
          {googleStatus?.connected && (
            <Button variant="ghost" size="sm" onClick={() => disconnectGoogle.mutate()}>
              Desconectar Google
            </Button>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-4 flex-1 min-h-0">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Novo compromisso</CardTitle>
            <CardDescription>Clique em um horário no calendário para preencher a data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label>Título</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Data e hora</Label>
              <Input type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
            </div>
            <Button
              className="w-full"
              disabled={!title.trim() || !dueAt || create.isPending}
              onClick={() => create.mutate()}
            >
              Agendar
            </Button>
            {googleStatus?.connected && (
              <p className="text-xs text-muted-foreground">Sincroniza com Google Calendar automaticamente.</p>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3 flex flex-col min-h-[480px]">
          <CardContent className="flex-1 p-4 min-h-[420px] calendar-rbc">
            {isLoading ? (
              <p className="text-sm text-muted-foreground p-4">Carregando...</p>
            ) : (
              <Calendar
                localizer={localizer}
                culture="pt-BR"
                events={calEvents}
                view={view}
                onView={setView}
                date={date}
                onNavigate={setDate}
                selectable
                onSelectSlot={onSelectSlot}
                messages={{
                  next: 'Próximo',
                  previous: 'Anterior',
                  today: 'Hoje',
                  month: 'Mês',
                  week: 'Semana',
                  day: 'Dia',
                  agenda: 'Lista',
                }}
                style={{ height: '100%', minHeight: 400 }}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <style jsx global>{`
        .calendar-rbc .rbc-toolbar button {
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }
        .calendar-rbc .rbc-event {
          background: hsl(var(--primary));
          border: none;
        }
        .calendar-rbc .rbc-today {
          background: hsl(var(--primary) / 0.08);
        }
      `}</style>
    </div>
  );
}
