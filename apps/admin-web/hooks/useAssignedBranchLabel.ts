'use client';

import { useMemo } from 'react';
import { useBranches, useBranch } from '@/hooks/useBranches';

/**
 * Resolves a human-readable branch name for Branch Head / Agent (list + single fetch fallback).
 */
export function useAssignedBranchLabel(branchId: string | null | undefined) {
  const { data: branches = [], isFetching: listFetching } = useBranches();
  const fromList = useMemo(
    () => (branchId ? branches.find((b) => b.id === branchId)?.name : undefined),
    [branches, branchId]
  );
  const needDetail = !!branchId && !fromList;
  const { data: detail, isFetching: detailFetching } = useBranch(needDetail ? branchId : null);

  const name = fromList ?? detail?.name;
  const loading = !!branchId && !name && (listFetching || detailFetching);
  const label = !branchId ? '—' : loading ? 'Loading…' : name ?? branchId;

  return { label, loading, name: name ?? null };
}
