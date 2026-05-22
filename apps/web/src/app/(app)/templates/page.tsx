'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
import { Plus, Trash2 } from 'lucide-react';

type Template = {
  id: string;
  name: string;
  niche: string | null;
  body: string;
  createdAt: string;
};

export default function TemplatesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [niche, setNiche] = useState('');
  const [body, setBody] = useState('Olá {{nome}}, tudo bem?');

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => (await api.get<Template[]>('/templates')).data,
  });

  const create = useMutation({
    mutationFn: async () => {
      await api.post('/templates', {
        name,
        niche: niche || undefined,
        body,
      });
    },
    onSuccess: () => {
      toast.success('Template criado');
      setName('');
      setNiche('');
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
    onError: (e: { response?: { data?: { message?: string } } }) => {
      toast.error(e?.response?.data?.message ?? 'Erro ao criar');
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/templates/${id}`),
    onSuccess: () => {
      toast.success('Template removido');
      qc.invalidateQueries({ queryKey: ['templates'] });
    },
  });

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-semibold">Templates</h1>
        <p className="text-sm text-muted-foreground">
          Mensagens rápidas para WhatsApp (use variáveis como {'{{nome}}'})
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Boas-vindas" />
            </div>
            <div className="space-y-1">
              <Label>Nicho (opcional)</Label>
              <Input value={niche} onChange={(e) => setNiche(e.target.value)} placeholder="SDR" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Texto</Label>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
          </div>
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || !body.trim() || create.isPending}
          >
            <Plus className="h-4 w-4 mr-1" />
            Adicionar
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Biblioteca</CardTitle>
          <CardDescription>
            {isLoading ? 'Carregando...' : `${data?.length ?? 0} template(s)`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {!data?.length && !isLoading ? (
            <p className="text-sm text-muted-foreground">Nenhum template ainda.</p>
          ) : (
            data?.map((t) => (
              <div key={t.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <div className="font-medium">{t.name}</div>
                    {t.niche ? (
                      <div className="text-xs text-muted-foreground">{t.niche}</div>
                    ) : null}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => remove.mutate(t.id)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <pre className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded">{t.body}</pre>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
