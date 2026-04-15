import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { ServiceArea, CreateServiceAreaBody, PatchServiceAreaBody } from '@/types';

function fetchServiceAreas(branchId?: string): Promise<ServiceArea[]> {
  const params = branchId ? { branchId } : {};
  return api.get<ServiceArea[]>('/admin/service-areas', { params }).then((r) => r.data);
}

export function useServiceAreas(branchId?: string) {
  return useQuery({
    queryKey: ['admin', 'service-areas', branchId ?? 'all'],
    queryFn: () => fetchServiceAreas(branchId),
  });
}

export function useCreateServiceArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateServiceAreaBody) =>
      api.post<ServiceArea>('/admin/service-areas', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'service-areas'] });
    },
  });
}

export function usePatchServiceArea(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchServiceAreaBody) =>
      api.patch<ServiceArea>(`/admin/service-areas/${encodeURIComponent(id)}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'service-areas'] });
    },
  });
}

export function useDeleteServiceArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/service-areas/${encodeURIComponent(id)}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'service-areas'] });
    },
  });
}
