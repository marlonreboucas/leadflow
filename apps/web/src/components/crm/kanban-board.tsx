'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import type { Deal, Pipeline } from '@/lib/crm';
import { moveDeal } from '@/lib/crm';
import { getSocket } from '@/lib/socket';
import { SOCKET_EVENTS } from '@leadflow/shared';
import { DealCard } from './deal-card';
import { KanbanColumn } from './kanban-column';
import { cn } from '@/lib/utils';

type Props = {
  pipeline: Pipeline;
  deals: Deal[];
  ownerFilter: 'all' | 'human' | 'ai';
};

export function KanbanBoard({ pipeline, deals, ownerFilter }: Props) {
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (ownerFilter === 'all') return deals;
    if (ownerFilter === 'ai') return deals.filter((d) => d.ownerAgent);
    return deals.filter((d) => !d.ownerAgent);
  }, [deals, ownerFilter]);

  const byStage = useMemo(() => {
    const map = new Map<string, Deal[]>();
    for (const stage of pipeline.stages) map.set(stage.id, []);
    for (const deal of filtered) {
      const list = map.get(deal.stageId);
      if (list) list.push(deal);
    }
    return map;
  }, [pipeline.stages, filtered]);

  const moveMutation = useMutation({
    mutationFn: ({ dealId, stageId }: { dealId: string; stageId: string }) => moveDeal(dealId, stageId),
    onMutate: async ({ dealId, stageId }) => {
      await qc.cancelQueries({ queryKey: ['deals', pipeline.id] });
      const prev = qc.getQueryData<{ items: Deal[]; total: number }>(['deals', pipeline.id]);
      if (prev) {
        qc.setQueryData(['deals', pipeline.id], {
          ...prev,
          items: prev.items.map((d) => (d.id === dealId ? { ...d, stageId } : d)),
        });
      }
      return { prev };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['deals', pipeline.id], ctx.prev);
      toast.error('Não foi possível mover o card');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ['deals', pipeline.id] }),
  });

  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const refresh = () => qc.invalidateQueries({ queryKey: ['deals', pipeline.id] });
    s.on(SOCKET_EVENTS.DEAL_MOVED, refresh);
    s.on(SOCKET_EVENTS.LEAD_UPDATED, refresh);
    return () => {
      s.off(SOCKET_EVENTS.DEAL_MOVED, refresh);
      s.off(SOCKET_EVENTS.LEAD_UPDATED, refresh);
    };
  }, [qc, pipeline.id]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const activeDeal = activeId ? filtered.find((d) => d.id === activeId) : null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const dealId = String(e.active.id);
    const stageId = e.over ? String(e.over.id) : null;
    if (!stageId) return;
    const deal = filtered.find((d) => d.id === dealId);
    if (!deal || deal.stageId === stageId) return;
    moveMutation.mutate({ dealId, stageId });
  }

  const openStages = pipeline.stages.filter((s) => !s.isWon && !s.isLost);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 min-h-[calc(100vh-12rem)]">
        {openStages.map((stage) => (
          <KanbanColumn
            key={stage.id}
            stage={stage}
            deals={byStage.get(stage.id) ?? []}
          />
        ))}
        {pipeline.stages
          .filter((s) => s.isWon || s.isLost)
          .map((stage) => (
            <KanbanColumn
              key={stage.id}
              stage={stage}
              deals={byStage.get(stage.id) ?? []}
              className={cn(stage.isWon && 'border-green-200', stage.isLost && 'border-red-200')}
            />
          ))}
      </div>
      <DragOverlay>
        {activeDeal ? <DealCard deal={activeDeal} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}
