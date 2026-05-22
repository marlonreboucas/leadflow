'use client';

import { useDraggable } from '@dnd-kit/core';
import type { Deal } from '@/lib/crm';
import { DealCard } from './deal-card';

export function DraggableDeal({ deal }: { deal: Deal }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <DealCard deal={deal} dragging={isDragging} />
    </div>
  );
}
