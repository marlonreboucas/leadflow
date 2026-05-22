'use client';

import Link from 'next/link';
import type { Deal } from '@/lib/crm';
import { formatBRL, temperatureClass, temperatureLabel } from '@/lib/crm';
import { cn } from '@/lib/utils';

export function DealCard({ deal, dragging }: { deal: Deal; dragging?: boolean }) {
  const owner = deal.ownerUser ?? deal.ownerAgent;
  const isAi = Boolean(deal.ownerAgent);

  return (
    <Link
      href={`/leads/${deal.id}`}
      className={cn(
        'block rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md',
        dragging && 'opacity-60 ring-2 ring-primary',
      )}
      onClick={(e) => dragging && e.preventDefault()}
    >
      <div className="font-medium text-sm leading-snug">{deal.title}</div>
      <div className="mt-1 text-xs text-muted-foreground truncate">
        {deal.contact.name ?? deal.contact.phone}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-primary">{formatBRL(deal.valueCents)}</span>
        <span
          className={cn(
            'text-[10px] font-medium px-1.5 py-0.5 rounded',
            temperatureClass[deal.temperature],
          )}
        >
          {temperatureLabel[deal.temperature]}
        </span>
      </div>
      {owner ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className={cn(
              'h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-medium',
              isAi ? 'bg-violet-100 text-violet-700' : 'bg-primary/10 text-primary',
            )}
          >
            {owner.name.slice(0, 1)}
          </span>
          <span className="truncate">{owner.name}</span>
          {isAi ? (
            <span className="ml-auto text-[10px] bg-violet-100 text-violet-700 px-1 rounded">IA</span>
          ) : null}
        </div>
      ) : null}
    </Link>
  );
}
