import { useQuery } from '@tanstack/react-query';
import { customerFlowApi } from '@/lib/customer-flow/api';

export interface FeedbackEligibility {
  eligible: boolean;
  reason?: string;
  alreadySubmitted: boolean;
}

export function useCustomerFlowFeedbackEligibility(orderId: string | null) {
  return useQuery({
    queryKey: ['customer-flow', 'orders', orderId, 'feedback-eligibility'],
    queryFn: async (): Promise<FeedbackEligibility> => {
      if (!orderId) throw new Error('No order id');
      const { data } = await customerFlowApi.get<FeedbackEligibility>(
        `/orders/${orderId}/feedback/eligibility`,
      );
      return data;
    },
    enabled: !!orderId,
  });
}
