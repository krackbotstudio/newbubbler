import { useQuery } from '@tanstack/react-query';
import { customerFlowApi } from '@/lib/customer-flow/api';

export interface MeResponse {
  user: { id: string; phone: string | null; role: string; name: string | null; email: string | null };
  defaultAddress?: { id: string; pincode: string };
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
