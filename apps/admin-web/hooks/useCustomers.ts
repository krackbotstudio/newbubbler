import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CustomerRecord,
  CustomerListRow,
  PatchCustomerBody,
} from '@/types';

export interface CustomersListResponse {
  data: CustomerListRow[];
  nextCursor: string | null;
}

export interface CustomersCountResponse {
  totalCustomersCount: number;
}

function fetchCustomersList(
  limit: number,
  cursor?: string | null,
  search?: string | null,
  branchId?: string | null,
): Promise<CustomersListResponse> {
  const params: { limit: number; cursor?: string; search?: string; branchId?: string } = { limit };
  if (cursor) params.cursor = cursor;
  if (search && search.trim()) params.search = search.trim();
  if (branchId && branchId.trim()) params.branchId = branchId.trim();
  return api.get<CustomersListResponse>('/admin/customers', { params }).then((r) => r.data);
}

function fetchCustomersByPhone(phone: string): Promise<CustomerListRow[]> {
  return api
    .get<CustomerListRow[]>('/admin/customers/search', { params: { phone } })
    .then((r) => r.data);
}

function fetchCustomersCount(branchId?: string | null): Promise<CustomersCountResponse> {
  const params: { branchId?: string } = {};
  if (branchId && branchId.trim()) params.branchId = branchId.trim();
  return api.get<CustomersCountResponse>('/admin/customers/count', { params }).then((r) => r.data);
}

function fetchCustomer(userId: string): Promise<CustomerRecord> {
  return api.get<CustomerRecord>(`/admin/customers/${userId}`).then((r) => r.data);
}

export interface CustomerPaymentRow {
  id: string;
  orderId: string | null;
  type: 'order';
  amount: number;
  status: string;
  provider: string;
  failureReason: string | null;
  createdAt: string;
  branchId?: string | null;
  branchName?: string | null;
}

function fetchCustomerPayments(userId: string, branchId?: string | null): Promise<CustomerPaymentRow[]> {
  const params = new URLSearchParams();
  if (branchId && branchId.trim()) params.set('branchId', branchId.trim());
  const qs = params.toString();
  const url = `/admin/customers/${userId}/payments${qs ? `?${qs}` : ''}`;
  return api.get<CustomerPaymentRow[]>(url).then((r) => r.data);
}

export function useCustomerPayments(userId: string | null, branchId?: string | null) {
  return useQuery({
    queryKey: ['admin', 'customers', userId, 'payments', branchId ?? ''],
    queryFn: () => fetchCustomerPayments(userId!, branchId),
    enabled: !!userId,
  });
}

export function useCustomersList(
  limit: number,
  cursor?: string | null,
  search?: string | null,
  branchId?: string | null,
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['admin', 'customers', 'list', limit, cursor ?? '', search ?? '', branchId ?? ''],
    queryFn: () => fetchCustomersList(limit, cursor, search, branchId),
    enabled: options?.enabled !== false,
  });
}

/** Phone-only lookup; runs when `digitsOnly` has at least 10 digits (full mobile). */
export function useCustomersPhoneSearch(digitsOnly: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['admin', 'customers', 'search', digitsOnly],
    queryFn: () => fetchCustomersByPhone(digitsOnly),
    enabled: (options?.enabled ?? true) && digitsOnly.length >= 10,
  });
}

export function useCustomersCount(
  branchId?: string | null,
  options?: { enabled?: boolean; refetchInterval?: number },
) {
  return useQuery({
    queryKey: ['admin', 'customers', 'count', branchId ?? ''],
    queryFn: () => fetchCustomersCount(branchId),
    enabled: options?.enabled ?? true,
    refetchInterval: options?.refetchInterval,
  });
}

export function useCustomer(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'customers', userId],
    queryFn: () => fetchCustomer(userId!),
    enabled: !!userId,
  });
}

export function useUpdateCustomer(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchCustomerBody) =>
      api.patch<CustomerRecord>(`/admin/customers/${userId}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'customers', userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
  });
}

// Subscription overrides removed.
