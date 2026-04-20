import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getBranchCustomerPortal,
  upsertBranchCustomerPortal,
  uploadBranchPortalAppIcon,
  uploadBranchPortalCarousel,
  uploadBranchPortalLogo,
  type UpsertCustomerPortalInput,
} from '@/lib/customer-portal-api';

export function useBranchCustomerPortal(branchId: string) {
  return useQuery({
    queryKey: ['admin', 'customer-portal', 'branch', branchId],
    queryFn: () => getBranchCustomerPortal(branchId),
    enabled: Boolean(branchId),
  });
}

export function useUpsertBranchCustomerPortal(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertCustomerPortalInput) => upsertBranchCustomerPortal(branchId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'customer-portal', 'branch', branchId] }),
  });
}

export function useUploadBranchPortalLogo(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadBranchPortalLogo(branchId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'customer-portal', 'branch', branchId] }),
  });
}

export function useUploadBranchPortalAppIcon(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadBranchPortalAppIcon(branchId, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'customer-portal', 'branch', branchId] }),
  });
}

export function useUploadBranchPortalCarousel(branchId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ position, file }: { position: number; file: File }) =>
      uploadBranchPortalCarousel(branchId, position, file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'customer-portal', 'branch', branchId] }),
  });
}

