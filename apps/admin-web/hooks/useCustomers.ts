import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CustomerRecord,
  CustomerListRow,
  PatchCustomerBody,
  PatchSubscriptionOverrideBody,
} from '@/types';

export interface CustomersListResponse {
  data: CustomerListRow[];
  nextCursor: string | null;
}

function fetchCustomersList(limit: number, cursor?: string | null, search?: string | null): Promise<CustomersListResponse> {
  const params: { limit: number; cursor?: string; search?: string } = { limit };
  if (cursor) params.cursor = cursor;
  if (search && search.trim()) params.search = search.trim();
  return api.get<CustomersListResponse>('/admin/customers', { params }).then((r) => r.data);
}

function fetchCustomersByPhone(phone: string): Promise<CustomerListRow[]> {
  return api
    .get<CustomerListRow[]>('/admin/customers/search', { params: { phone } })
    .then((r) => r.data);
}

function fetchCustomer(userId: string): Promise<CustomerRecord> {
  return api.get<CustomerRecord>(`/admin/customers/${userId}`).then((r) => r.data);
}

export interface CustomerPaymentRow {
  id: string;
  orderId: string | null;
  subscriptionId: string | null;
  type: 'order' | 'subscription';
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
  options?: { enabled?: boolean },
) {
  return useQuery({
    queryKey: ['admin', 'customers', 'list', limit, cursor ?? '', search ?? ''],
    queryFn: () => fetchCustomersList(limit, cursor, search),
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

export function useCustomer(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'customers', userId],
    queryFn: () => fetchCustomer(userId!),
    enabled: !!userId,
  });
}

export interface SubscriptionOrderItem {
  subscriptionId: string;
  orderIds: string[];
}

function fetchSubscriptionOrders(userId: string): Promise<SubscriptionOrderItem[]> {
  return api.get<SubscriptionOrderItem[]>(`/admin/customers/${userId}/subscription-orders`).then((r) => r.data);
}

export function useSubscriptionOrders(userId: string | null) {
  return useQuery({
    queryKey: ['admin', 'customers', userId, 'subscription-orders'],
    queryFn: () => fetchSubscriptionOrders(userId!),
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

export function useSubscriptionOverride(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: PatchSubscriptionOverrideBody) =>
      api
        .patch<CustomerRecord>(`/admin/customers/${userId}/subscription`, body)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'customers', userId] });
      qc.invalidateQueries({ queryKey: ['admin', 'customers'] });
    },
  });
}
