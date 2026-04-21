import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface AdminFinalInvoiceRow {
  invoiceId: string;
  type: 'FINAL';
  orderId: string | null;
  code: string | null;
  total: number;
  issuedAt: string | null;
  paymentStatus: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  branchName: string | null;
  /** WALK_IN | ONLINE | null for order invoices; used to show Type as Walk in / Online. */
  orderSource: string | null;
}

export interface AdminFinalInvoicesResponse {
  data: AdminFinalInvoiceRow[];
  nextCursor: string | null;
}

export interface FinalInvoicesFilters {
  customerId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  cursor?: string;
}

function fetchFinalInvoices(filters: FinalInvoicesFilters): Promise<AdminFinalInvoicesResponse> {
  const params = new URLSearchParams();
  if (filters.customerId) params.set('customerId', filters.customerId);
  if (filters.branchId) params.set('branchId', filters.branchId);
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
  if (filters.dateTo) params.set('dateTo', filters.dateTo);
  params.set('limit', String(filters.limit ?? 50));
  if (filters.cursor) params.set('cursor', filters.cursor);

  return api.get<AdminFinalInvoicesResponse>(`/admin/final-invoices?${params.toString()}`).then((r) => r.data);
}

export function useFinalInvoices(filters: FinalInvoicesFilters) {
  return useQuery({
    queryKey: ['admin', 'final-invoices', filters],
    queryFn: () => fetchFinalInvoices(filters),
  });
}
