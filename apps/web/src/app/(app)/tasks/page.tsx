'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { fetchTasks, updateTask } from '@/lib/crm';
import type { Task } from '@/lib/crm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check, Bot } from 'lucide-react';

export default function TasksPage() {
  const [filter, setFilter] = useState<'all' | 'overdue' | 'pending'>('all');
  const qc = useQueryClient();

  const params =
    filter === 'overdue'
      ? { overdue: true, take: 200 }
      : filter === 'pending'
        ? { status: 'PENDING', take: 200 }
        : { take: 200 };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['tasks', filter],
    queryFn: () => fetchTasks(params),
  });

  const complete = useMutation({
    mutationFn: (id: string) => updateTask(id, { status: 'DONE' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Tarefa concluída');
    },
    onError: () => toast.error('Erro ao concluir tarefa'),
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Tarefas</h1>
        <p className="text-sm text-muted-foreground">Follow-ups e acompanhamentos</p>
      </div>

      <div className="flex gap-2">
        {(
          [
            ['all', 'Todas'],
            ['pending', 'Pendentes'],
            ['overdue', 'Atrasadas'],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={filter === key ? 'default' : 'outline'}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>
            {isLoading ? 'Carregando...' : `${data?.total ?? 0} tarefa(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isError ? (
            <p className="text-sm text-destructive">Erro ao carregar tarefas.</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !data?.items.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma tarefa.</p>
          ) : (
            <ul className="divide-y">
              {data.items.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  onComplete={() => complete.mutate(task.id)}
                  completing={complete.isPending}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function TaskRow({
  task,
  onComplete,
  completing,
}: {
  task: Task;
  onComplete: () => void;
  completing: boolean;
}) {
  const overdue =
    task.dueAt &&
    task.status !== 'DONE' &&
    task.status !== 'CANCELED' &&
    new Date(task.dueAt) < new Date();

  return (
    <li className="flex items-start gap-3 py-3">
      {task.status !== 'DONE' && task.status !== 'CANCELED' ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          className="h-8 w-8 shrink-0"
          disabled={completing}
          onClick={onComplete}
          aria-label="Concluir"
        >
          <Check className="h-4 w-4" />
        </Button>
      ) : (
        <div className="h-8 w-8 shrink-0 flex items-center justify-center text-green-600">
          <Check className="h-4 w-4" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={cn(
              'font-medium text-sm',
              task.status === 'DONE' && 'line-through text-muted-foreground',
            )}
          >
            {task.title}
          </span>
          {task.createdByAgent ? (
            <span className="inline-flex items-center gap-0.5 text-[10px] bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded font-medium">
              <Bot className="h-3 w-3" />
              IA
            </span>
          ) : null}
          {overdue ? (
            <span className="text-[10px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium">
              Atrasada
            </span>
          ) : null}
        </div>
        {task.deal ? (
          <Link
            href={`/leads/${task.deal.id}`}
            className="text-xs text-primary hover:underline mt-0.5 inline-block"
          >
            {task.deal.title}
          </Link>
        ) : null}
        <div className="text-xs text-muted-foreground mt-1 flex gap-3">
          {task.assignee ? <span>{task.assignee.name}</span> : null}
          {task.dueAt ? (
            <span className={cn(overdue && 'text-destructive font-medium')}>
              Prazo: {new Date(task.dueAt).toLocaleString('pt-BR')}
            </span>
          ) : null}
        </div>
      </div>
      <StatusPill status={task.status} />
    </li>
  );
}

function StatusPill({ status }: { status: Task['status'] }) {
  const map: Record<Task['status'], { label: string; cls: string }> = {
    PENDING: { label: 'Pendente', cls: 'bg-slate-100 text-slate-700' },
    DOING: { label: 'Em andamento', cls: 'bg-blue-100 text-blue-800' },
    DONE: { label: 'Feita', cls: 'bg-green-100 text-green-800' },
    CANCELED: { label: 'Cancelada', cls: 'bg-muted text-muted-foreground' },
  };
  const { label, cls } = map[status];
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded font-medium shrink-0', cls)}>{label}</span>
  );
}
