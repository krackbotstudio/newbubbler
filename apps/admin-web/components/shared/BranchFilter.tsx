'use client';

import { useRef, useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { useBranches } from '@/hooks/useBranches';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getStoredUser, restrictBranchesForUser } from '@/lib/auth';

interface BranchFilterProps {
  selectedBranchIds: string[];
  onChange: (branchIds: string[]) => void;
  placeholder?: string;
  className?: string;
  /** When true, label shows "All branches" or "N branches" with tooltip; otherwise show branch names */
  compactLabel?: boolean;
  /** When true, filter is locked (e.g. Branch Head sees only their assigned branch) */
  disabled?: boolean;
  /** Selection behavior: multi-select (default) or single-select dropdown */
  selectionMode?: 'multi' | 'single';
}

export function BranchFilter({
  selectedBranchIds,
  onChange,
  placeholder = 'Branch',
  className,
  compactLabel = true,
  disabled = false,
  selectionMode = 'multi',
}: BranchFilterProps) {
  const user = getStoredUser();
  const { data: branches = [] } = useBranches();
  const branchOptions = useMemo(() => restrictBranchesForUser(branches, user), [branches, user]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const isAll = selectedBranchIds.length === 0;
  const selectedBranches = branchOptions.filter((b) => selectedBranchIds.includes(b.id));
  const singleSelectedId = selectedBranchIds[0] ?? null;

  const label = isAll
    ? 'All branches'
    : selectionMode === 'single'
      ? (branchOptions.find((b) => b.id === singleSelectedId)?.name ?? placeholder)
    : compactLabel
      ? selectedBranchIds.length === 1
        ? (branchOptions.find((b) => b.id === selectedBranchIds[0])?.name ?? '1 branch')
        : `${selectedBranchIds.length} branches`
      : selectedBranches.map((b) => b.name).join(', ') || 'All branches';

  const tooltipText = isAll
    ? 'All branches'
    : selectedBranches.map((b) => b.name).join(', ');

  const toggleBranch = (id: string) => {
    if (isAll) {
      // Currently "all" – selecting this branch means "all except this" (deselect one)
      onChange(branchOptions.filter((b) => b.id !== id).map((b) => b.id));
    } else if (selectedBranchIds.includes(id)) {
      const next = selectedBranchIds.filter((x) => x !== id);
      onChange(next.length === 0 ? [] : next); // empty = back to "all"
    } else {
      onChange([...selectedBranchIds, id]);
    }
  };

  const selectAll = () => {
    onChange([]);
    setOpen(false);
  };

  const selectSingleBranch = (id: string) => {
    onChange([id]);
    setOpen(false);
  };

  return (
    <div className={cn('relative', className)} ref={ref}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        title={disabled ? 'Your assigned branch (filter locked)' : tooltipText}
        className="min-w-[140px] justify-between"
      >
        <span className="truncate">{label}</span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      {open && !disabled && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[200px] rounded-md border bg-popover p-2 shadow-md">
          <button
            type="button"
            className="w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={selectAll}
          >
            All branches
          </button>
          <div className="my-1 border-t" />
          {branchOptions.length === 0 ? (
            <p className="px-2 py-1 text-muted-foreground text-xs">No branches</p>
          ) : selectionMode === 'single' ? (
            branchOptions.map((b) => (
              <button
                key={b.id}
                type="button"
                className={cn(
                  'w-full rounded px-2 py-1.5 text-left text-sm hover:bg-accent',
                  singleSelectedId === b.id && 'bg-accent/60 font-medium',
                )}
                onClick={() => selectSingleBranch(b.id)}
              >
                {b.name}
              </button>
            ))
          ) : (
            branchOptions.map((b) => (
              <label
                key={b.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
              >
                <input
                  type="checkbox"
                  checked={isAll ? true : selectedBranchIds.includes(b.id)}
                  onChange={() => toggleBranch(b.id)}
                  className="h-4 w-4 rounded border-input"
                />
                <span className="truncate">{b.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
