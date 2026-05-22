'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Template = { id: string; name: string; body: string };

type Props = {
  templates: Template[];
  onPick: (body: string) => void;
  className?: string;
};

export function QuickTemplates({ templates, onPick, className }: Props) {
  if (!templates.length) return null;

  return (
    <div className={cn('flex flex-wrap gap-1.5', className)}>
      {templates.slice(0, 8).map((t) => (
        <Button
          key={t.id}
          type="button"
          variant="secondary"
          size="sm"
          className="h-7 text-xs max-w-[140px] truncate"
          title={t.body}
          onClick={() => onPick(t.body)}
        >
          {t.name}
        </Button>
      ))}
    </div>
  );
}
