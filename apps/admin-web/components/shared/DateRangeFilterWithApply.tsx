'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface DateRangeFilterWithApplyProps {
  draftFrom: string;
  draftTo: string;
  onDraftFromChange: (value: string) => void;
  onDraftToChange: (value: string) => void;
  onApply: () => void;
  disabled?: boolean;
  className?: string;
  blockLabels?: boolean;
}

export function DateRangeFilterWithApply({
  draftFrom,
  draftTo,
  onDraftFromChange,
  onDraftToChange,
  onApply,
  disabled = false,
  className,
  blockLabels = true,
}: DateRangeFilterWithApplyProps) {
  const labelClass = blockLabels ? 'text-xs text-muted-foreground block' : 'text-xs text-muted-foreground';
  return (
    <div className={cn('flex flex-wrap items-end gap-3 shrink-0', className)}>
      <div className="space-y-1.5 min-w-0">
        <label className={labelClass}>Date from</label>
        <Input
          type="date"
          value={draftFrom}
          onChange={(e) => onDraftFromChange(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5 min-w-0">
        <label className={labelClass}>Date to</label>
        <Input
          type="date"
          value={draftTo}
          onChange={(e) => onDraftToChange(e.target.value)}
          disabled={disabled}
        />
      </div>
      <Button type="button" variant="default" size="sm" className="shrink-0" onClick={onApply} disabled={disabled}>
        Apply
      </Button>
    </div>
  );
}
