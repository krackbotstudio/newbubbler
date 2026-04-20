import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

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
  /** True when this subscription has an order not yet delivered/cancelled. */
  hasActiveOrder?: boolean;
}

export interface MeResponse {
  user: { id: string; phone: string | null; role: string; name: string | null; email: string | null };
  defaultAddress?: { id: string; pincode: string };
  /** All active subscriptions (customer picks one when booking). */
  activeSubscriptions: ActiveSubscriptionSummary[];
  /** First active subscription (backward compat). */
  activeSubscription?: ActiveSubscriptionSummary;
}

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async (): Promise<MeResponse> => {
      const { data } = await api.get<MeResponse>('/me');
      return data;
    },
  });
}
