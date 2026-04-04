'use client';

import { cn } from '@/lib/utils';
import { useAssignedBranchLabel } from '@/hooks/useAssignedBranchLabel';

type Props = {
  branchId: string | null | undefined;
  className?: string;
  selectClassName?: string;
};

/**
 * Read-only branch control for Branch Head / Agent: fixed to assigned branch, shows name when available.
 */
export function LockedBranchSelect({ branchId, className, selectClassName }: Props) {
  const { label } = useAssignedBranchLabel(branchId);
  return (
    <div className={className}>
      <select
        className={cn(
          'h-10 min-h-[2.5rem] rounded-md border border-input bg-muted px-3 text-sm disabled:opacity-90 min-w-[160px]',
          selectClassName
        )}
        value={branchId ?? ''}
        disabled
        title="Your assigned branch (cannot change)"
      >
        <option value={branchId ?? ''}>{label}</option>
      </select>
    </div>
  );
}
