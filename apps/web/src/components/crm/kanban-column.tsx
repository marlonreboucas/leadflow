'use client';

import { useDroppable } from '@dnd-kit/core';
import type { Deal, PipelineStage } from '@/lib/crm';
import { DealCard } from './deal-card';
import { DraggableDeal } from './draggable-deal';
import { cn } from '@/lib/utils';

export function KanbanColumn({
  stage,
  deals,
  className,
}: {
  stage: PipelineStage;
  deals: Deal[];
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 shrink-0 flex-col rounded-lg border bg-muted/30',
        isOver && 'ring-2 ring-primary/40',
        className,
      )}
    >
      <div
        className="flex items-center gap-2 border-b px-3 py-2.5"
        style={{ borderTopColor: stage.color ?? undefined, borderTopWidth: 3 }}
      >
        <span
          className="h-2.5 w-2.5 rounded-full shrink-0"
          style={{ backgroundColor: stage.color ?? '#94a3b8' }}
        />
        <span className="font-medium text-sm truncate">{stage.name}</span>
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">{deals.length}</span>
      </div>
      <div className="flex flex-col gap-2 p-2 min-h-[120px] flex-1 overflow-y-auto max-h-[calc(100vh-14rem)]">
        {deals.map((deal) => (
          <DraggableDeal key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  );
}
