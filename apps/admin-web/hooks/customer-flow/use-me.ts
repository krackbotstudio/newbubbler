import { useQuery } from '@tanstack/react-query';
import { customerFlowApi } from '@/lib/customer-flow/api';

export interface ActiveSubscriptionSummary {
  id: string;
  planName: string;
  validityStartDate: string;
  validTill: string;
  remainingPickups: number;
  remainingKg: number | null;
  remainingItems: number | null;
  maxPickups: number;
  kgLimit: number | null;
  itemsLimit: number | null;
  hasActiveOrder?: boolean;
  addressId?: string | null;
  addressLabel?: string | null;
  branchId?: string | null;
}

export interface MeResponse {
  user: { id: string; phone: string | null; role: string; name: string | null; email: string | null };
  defaultAddress?: { id: string; pincode: string };
  activeSubscriptions: ActiveSubscriptionSummary[];
  activeSubscription?: ActiveSubscriptionSummary;
}

export function useCustomerFlowMe() {
  return useQuery({
    queryKey: ['customer-flow', 'me'],
    queryFn: async (): Promise<MeResponse> => {
      const { data } = await customerFlowApi.get<MeResponse>('/me');
      return data;
    },
  });
}
