'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

type KnowledgeBase = {
  id: string;
  name: string;
  description: string | null;
  _count: { items: number };
  items?: Array<{ id: string; kind: string; title: string; content: string }>;
};

export default function KnowledgeBasePage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newKbName, setNewKbName] = useState('');
  const [itemTitle, setItemTitle] = useState('');
  const [itemContent, setItemContent] = useState('');

  const { data: bases, isLoading } = useQuery({
    queryKey: ['knowledge-bases'],
    queryFn: async () => {
      const { data } = await api.get<KnowledgeBase[]>('/knowledge-bases');
      return data;
    },
  });

  const { data: detail } = useQuery({
    queryKey: ['knowledge-base', selectedId],
    queryFn: async () => {
      const { data } = await api.get<KnowledgeBase>(`/knowledge-bases/${selectedId}`);
      return data;
    },
    enabled: Boolean(selectedId),
  });

  const createKb = useMutation({
    mutationFn: async () => api.post('/knowledge-bases', { name: newKbName }),
    onSuccess: () => {
      setNewKbName('');
      qc.invalidateQueries({ queryKey: ['knowledge-bases'] });
      toast.success('Base criada');
    },
  });

  const addItem = useMutation({
    mutationFn: async () =>
      api.post(`/knowledge-bases/${selectedId}/items`, {
        kind: 'FAQ',
        title: itemTitle,
        content: itemContent,
      }),
    onSuccess: () => {
      setItemTitle('');
      setItemContent('');
      qc.invalidateQueries({ queryKey: ['knowledge-base', selectedId] });
      toast.success('Item adicionado — indexação na fila');
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Base de conhecimento</h1>
        <p className="text-sm text-muted-foreground">
          FAQs e conteúdos usados pelos agentes (RAG com embeddings)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nova base</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Input
            placeholder="Nome da base"
            value={newKbName}
            onChange={(e) => setNewKbName(e.target.value)}
          />
          <Button onClick={() => createKb.mutate()} disabled={!newKbName.trim()}>
            Criar
          </Button>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Bases</CardTitle>
            <CardDescription>{isLoading ? '...' : `${bases?.length ?? 0} base(s)`}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {bases?.map((kb) => (
              <button
                key={kb.id}
                type="button"
                onClick={() => setSelectedId(kb.id)}
                className={`w-full text-left px-3 py-2 rounded-md border text-sm ${
                  selectedId === kb.id ? 'border-primary bg-primary/5' : ''
                }`}
              >
                <div className="font-medium">{kb.name}</div>
                <div className="text-xs text-muted-foreground">{kb._count.items} itens</div>
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Itens</CardTitle>
            <CardDescription>
              {selectedId ? detail?.name : 'Selecione uma base'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedId ? (
              <>
                <ul className="text-sm space-y-2 max-h-48 overflow-y-auto">
                  {detail?.items?.map((item) => (
                    <li key={item.id} className="border-b pb-2">
                      <div className="font-medium">
                        [{item.kind}] {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground line-clamp-2">
                        {item.content}
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="space-y-2 border-t pt-3">
                  <Input
                    placeholder="Título"
                    value={itemTitle}
                    onChange={(e) => setItemTitle(e.target.value)}
                  />
                  <Textarea
                    placeholder="Conteúdo"
                    value={itemContent}
                    onChange={(e) => setItemContent(e.target.value)}
                    rows={4}
                  />
                  <Button
                    onClick={() => addItem.mutate()}
                    disabled={!itemTitle.trim() || !itemContent.trim()}
                  >
                    Adicionar item
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Selecione uma base à esquerda.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
