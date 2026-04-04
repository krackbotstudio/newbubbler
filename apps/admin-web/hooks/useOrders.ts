import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { AdminOrdersResponse, AdminOrdersFilters } from '@/types';

function fetchOrders(filters: AdminOrdersFilters): Promise<AdminOrdersResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.pincode) params.set('pincode', filters.pincode);
  if (filters.serviceType) params.set('serviceType', filters.serviceType);
  if (filters.customerId) params.set('customerId', filters.customerId);
  if (filters.branchId) params.set('branchId', filters.branchId);
  if (filters.orderSource) params.set('orderSource', filters.orderSource);
  if (filters.search) params.set('search', filters.search);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  if (filters.pickupDateFrom) params.set('pickupDateFrom', filters.pickupDateFrom);
  if (filters.pickupDateTo) params.set('pickupDateTo', filters.pickupDateTo);
  params.set('limit', String(filters.limit ?? 20));
  if (filters.cursor) params.set('cursor', filters.cursor);

  return api.get<AdminOrdersResponse>(`/admin/orders?${params.toString()}`).then((r) => r.data);
}

export function useOrders(
  filters: AdminOrdersFilters,
  options?: { refetchInterval?: number }
) {
  return useQuery({
    queryKey: ['admin', 'orders', filters],
    queryFn: () => fetchOrders(filters),
    refetchInterval: options?.refetchInterval,
  });
}
