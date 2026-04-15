import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Branch, BranchFieldUniquenessResponse, CreateBranchBody, UpdateBranchBody } from '@/types';

const BRANCHES_KEY = ['admin', 'branches'];

export function useBranches() {
  return useQuery({
    queryKey: BRANCHES_KEY,
    queryFn: () => api.get<Branch[]>('/admin/branches').then((r) => r.data),
  });
}

const FIELD_UNIQUENESS_KEY = [...BRANCHES_KEY, 'field-uniqueness'] as const;

/** Live check: branch name, invoice prefix, and item-tag short brand must be unique (case-insensitive) org-wide. */
export function useBranchFieldUniquenessQuery(opts: {
  excludeBranchId?: string | null;
  name: string;
  invoicePrefix: string;
  itemTagBrandName: string;
  enabled: boolean;
}) {
  const n = opts.name.trim();
  const p = opts.invoicePrefix.trim();
  const t = opts.itemTagBrandName.trim();
  const hasAny = n.length > 0 || p.length > 0 || t.length > 0;
  return useQuery({
    queryKey: [...FIELD_UNIQUENESS_KEY, opts.excludeBranchId ?? '', n, p, t],
    queryFn: () =>
      api
        .get<BranchFieldUniquenessResponse>('/admin/branches/field-uniqueness', {
          params: {
            excludeBranchId: opts.excludeBranchId || undefined,
            name: n || undefined,
            invoicePrefix: p || undefined,
            itemTagBrandName: t || undefined,
          },
        })
        .then((r) => r.data),
    enabled: opts.enabled && hasAny,
    staleTime: 8_000,
  });
}

export function useBranch(id: string | null) {
  return useQuery({
    queryKey: [...BRANCHES_KEY, id],
    queryFn: () => api.get<Branch>(`/admin/branches/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateBranchBody) =>
      api.post<Branch>('/admin/branches', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BRANCHES_KEY });
    },
  });
}

export function useUpdateBranch(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateBranchBody) =>
      api.patch<Branch>(`/admin/branches/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BRANCHES_KEY });
      qc.invalidateQueries({ queryKey: [...BRANCHES_KEY, id] });
    },
  });
}

export function useDeleteBranch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/branches/${id}`).then(() => undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BRANCHES_KEY });
    },
  });
}

export function useUploadBranchLogo(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<Branch>(`/admin/branches/${branchId}/logo`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BRANCHES_KEY });
      qc.invalidateQueries({ queryKey: [...BRANCHES_KEY, branchId] });
    },
  });
}

export function useUploadBranchUpiQr(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append('file', file);
      return api.post<Branch>(`/admin/branches/${branchId}/upi-qr`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BRANCHES_KEY });
      qc.invalidateQueries({ queryKey: [...BRANCHES_KEY, branchId] });
    },
  });
}
