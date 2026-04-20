import { useMutation, useQueryClient } from '@tanstack/react-query';
import { customerFlowApi, getCustomerFlowApiError } from '@/lib/customer-flow/api';
import { toast } from 'sonner';

export interface SubmitOrderFeedbackInput {
  orderId: string;
  rating: number;
  tags?: string[];
  message?: string;
}

export function useSubmitCustomerFlowOrderFeedback() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ orderId, rating, tags, message }: SubmitOrderFeedbackInput) => {
      const { data } = await customerFlowApi.post(`/orders/${orderId}/feedback`, {
        rating,
        tags,
        message,
      });
      return data;
    },
    onSuccess: (_, { orderId }) => {
      queryClient.invalidateQueries({ queryKey: ['customer-flow', 'orders', orderId, 'feedback-eligibility'] });
      queryClient.invalidateQueries({ queryKey: ['customer-flow', 'orders', orderId] });
      toast.success('Feedback submitted');
    },
    onError: (err) => {
      toast.error(getCustomerFlowApiError(err).message);
    },
  });
}
