'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAgentSchema, type CreateAgentInput } from '@leadflow/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createAgent, updateAgent } from '@/lib/agents';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { toast } from 'sonner';

const types = [
  { value: 'SDR', label: 'SDR' },
  { value: 'SALES', label: 'Vendas' },
  { value: 'SUPPORT', label: 'Suporte' },
  { value: 'SCHEDULING', label: 'Agendamento' },
  { value: 'CUSTOM', label: 'Customizado' },
];

const modes = [
  { value: 'SUGGEST', label: 'Sugestão (humano envia)' },
  { value: 'FULL_AUTO', label: 'Automático (envia WhatsApp)' },
  { value: 'HUMAN_APPROVAL', label: 'Aprovação humana' },
];

type Props = {
  agentId?: string;
  initial?: Partial<CreateAgentInput>;
  initialKnowledgeBaseIds?: string[];
};

export function AgentForm({ agentId, initial, initialKnowledgeBaseIds = [] }: Props) {
  const router = useRouter();
  const qc = useQueryClient();
  const isEdit = Boolean(agentId);
  const [kbIds, setKbIds] = useState<string[]>(initialKnowledgeBaseIds);

  const knowledgeBases = useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: async () => {
      const { data } = await api.get<Array<{ id: string; name: string }>>('/knowledge-bases');
      return data;
    },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateAgentInput>({
    resolver: zodResolver(createAgentSchema),
    defaultValues: {
      name: initial?.name ?? '',
      type: (initial?.type as CreateAgentInput['type']) ?? 'SDR',
      model: initial?.model ?? 'gpt-4o-mini',
      mode: (initial?.mode as CreateAgentInput['mode']) ?? 'SUGGEST',
      systemPrompt:
        initial?.systemPrompt ??
        'Você é um assistente consultivo. Qualifique leads com empatia e use a base de conhecimento quando falar de preços.',
      objective: initial?.objective ?? '',
      temperature: initial?.temperature ?? 0.4,
      maxTokens: initial?.maxTokens ?? 800,
      isActive: initial?.isActive ?? true,
    },
  });

  const save = useMutation({
    mutationFn: (values: CreateAgentInput) =>
      isEdit && agentId ? updateAgent(agentId, values) : createAgent(values),
    onSuccess: (agent: { id: string }) => {
      toast.success(isEdit ? 'Agente atualizado' : 'Agente criado');
      qc.invalidateQueries({ queryKey: ['agent', agent.id] });
      qc.invalidateQueries({ queryKey: ['agents'] });
      if (!isEdit) router.push(`/agents/${agent.id}`);
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? (isEdit ? 'Erro ao salvar' : 'Erro ao criar agente'));
    },
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEdit ? 'Editar agente' : 'Novo agente IA'}</CardTitle>
        <CardDescription>Requer OPENAI_API_KEY no servidor</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="space-y-4"
          onSubmit={handleSubmit((v) => save.mutate({ ...v, knowledgeBaseIds: kbIds }))}
        >
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input {...register('name')} />
              {errors.name ? (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label>Tipo</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('type')}
              >
                {types.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Modelo</Label>
              <Input {...register('model')} placeholder="gpt-4o-mini" />
            </div>
            <div className="space-y-1">
              <Label>Modo</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                {...register('mode')}
              >
                {modes.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1">
            <Label>System prompt</Label>
            <Textarea rows={6} {...register('systemPrompt')} />
            {errors.systemPrompt ? (
              <p className="text-xs text-destructive">{errors.systemPrompt.message}</p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label>Objetivo (opcional)</Label>
            <Input {...register('objective')} placeholder="Qualificar e agendar demo" />
          </div>
          <div className="space-y-2">
            <Label>Bases de conhecimento (RAG)</Label>
            {!knowledgeBases.data?.length ? (
              <p className="text-xs text-muted-foreground">
                Nenhuma base cadastrada. Crie em Conhecimento.
              </p>
            ) : (
              <ul className="space-y-1 rounded-md border p-3 max-h-40 overflow-y-auto">
                {knowledgeBases.data.map((kb) => (
                  <li key={kb.id} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={kbIds.includes(kb.id)}
                      onChange={(e) => {
                        setKbIds((prev) =>
                          e.target.checked
                            ? [...prev, kb.id]
                            : prev.filter((id) => id !== kb.id),
                        );
                      }}
                    />
                    {kb.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="outline" onClick={() => router.push('/agents')}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? 'Salvando...' : isEdit ? 'Salvar' : 'Criar agente'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
