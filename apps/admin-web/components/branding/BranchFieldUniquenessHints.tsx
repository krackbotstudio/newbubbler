'use client';

import type { BranchFieldUniquenessSlot } from '@/types';

/** Inline hint under branch name, invoice prefix, or item-tag brand input. */
export function BranchUniquenessUnderField({
  slot,
  isEmpty,
  optionalEmptyHelp,
  availableLabel,
  takenTemplate,
}: {
  slot: BranchFieldUniquenessSlot | undefined;
  isEmpty: boolean;
  optionalEmptyHelp?: string;
  availableLabel: string;
  takenTemplate: (otherBranch: string) => string;
}) {
  if (isEmpty && optionalEmptyHelp) {
    return <p className="mt-1 text-xs text-muted-foreground">{optionalEmptyHelp}</p>;
  }
  if (isEmpty) return null;
  if (!slot) {
    return <p className="mt-1 text-xs text-muted-foreground">Checking availability…</p>;
  }
  if (!slot.available && slot.takenByBranchName) {
    return <p className="mt-1 text-xs text-destructive">{takenTemplate(slot.takenByBranchName)}</p>;
  }
  if (!slot.available) {
    return <p className="mt-1 text-xs text-destructive">Already used by another branch.</p>;
  }
  return <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400">{availableLabel}</p>;
}
