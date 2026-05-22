'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { fetchPipelines } from '@/lib/crm';

export default function KanbanIndexPage() {
  const router = useRouter();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['pipelines'],
    queryFn: fetchPipelines,
  });

  useEffect(() => {
    if (!data?.length) return;
    const pipeline = data.find((p) => p.isDefault) ?? data[0];
    router.replace(`/kanban/${pipeline.id}`);
  }, [data, router]);

  if (isError) {
    return (
      <div className="p-6 text-sm text-destructive">
        Erro ao carregar funis. Verifique se a API está rodando.
      </div>
    );
  }

  return (
    <div className="p-6 text-sm text-muted-foreground">
      {isLoading ? 'Carregando funil...' : 'Nenhum pipeline encontrado. Crie uma conta ou rode o seed.'}
    </div>
  );
}
