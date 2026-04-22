import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerFlowApi, getCustomerFlowApiError } from '@/lib/customer-flow/api';
import { toast } from 'sonner';

export interface OrderListItem {
  id: string;
  status: string;
  serviceType: string;
  orderType?: string;
  orderSource?: string | null;
  pickupDate: string;
  timeWindow: string;
  createdAt: string;
  paymentStatus?: string;
  amountToPayPaise?: number | null;
}

export interface OrderDetail extends OrderListItem {
  userId: string;
  addressId: string;
  pincode: string;
  estimatedWeightKg: number | null;
  actualWeightKg: number | null;
  paymentStatus: string;
  updatedAt: string;
}

export interface OrderInvoiceItem {
  id: string;
  type: string;
  name: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  /** Per-line remarks (same as admin invoice / PDF). */
  remarks?: string | null;
  /** Legacy line detail when remarks were not stored separately. */
  clothesCount?: number | null;
  catalogItemId?: string | null;
  icon?: string | null;
  segmentCategoryId?: string | null;
  segmentLabel?: string | null;
  serviceCategoryId?: string | null;
  serviceLabel?: string | null;
}

export interface OrderInvoice {
  id: string;
  code?: string | null;
  type: string;
  status: string;
  subtotal?: number;
  tax?: number;
  total: number;
  discountPaise?: number;
  issuedAt: string | null;
  pdfUrl: string;
  items?: OrderInvoiceItem[];
}

export function useCustomerFlowOrders(branchSlug: string) {
  return useQuery({
    queryKey: ['customer-flow', 'orders', branchSlug],
    queryFn: async (): Promise<OrderListItem[]> => {
      const { data } = await customerFlowApi.get<OrderListItem[]>('/orders');
      return data;
    },
    enabled: !!branchSlug,
  });
}

export function useCustomerFlowOrder(id: string | null, branchSlug: string) {
  return useQuery({
    queryKey: ['customer-flow', 'orders', id, branchSlug],
    queryFn: async (): Promise<OrderDetail> => {
      if (!id) throw new Error('No order id');
      const { data } = await customerFlowApi.get<OrderDetail>(`/orders/${id}`);
      return data;
    },
    enabled: !!id && !!branchSlug,
  });
}

export function useCustomerFlowOrderInvoices(id: string | null, branchSlug: string) {
  return useQuery({
    queryKey: ['customer-flow', 'orders', id, 'invoices', branchSlug],
    queryFn: async (): Promise<OrderInvoice[]> => {
      if (!id) throw new Error('No order id');
      const { data } = await customerFlowApi.get<OrderInvoice[]>(`/orders/${id}/invoices`);
      return data;
    },
    enabled: !!id && !!branchSlug,
  });
}

export interface CreateOrderInput {
  orderType?: 'INDIVIDUAL';
  serviceType?: string;
  selectedServices?: string[];
  addressId: string;
  pickupDate: string;
  timeWindow: string;
  estimatedWeightKg?: number;
}

export function useCreateCustomerFlowOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateOrderInput): Promise<{ orderId: string; orderType?: string }> => {
      const { data } = await customerFlowApi.post<{ orderId: string; orderType?: string }>('/orders', input);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-flow', 'orders'] });
      toast.success('Order created');
    },
    onError: (err) => {
      toast.error(getCustomerFlowApiError(err).message);
    },
  });
}
