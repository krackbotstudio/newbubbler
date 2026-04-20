import { useQuery } from '@tanstack/react-query';
import { customerFlowApi } from '@/lib/customer-flow/api';

export interface PriceListItemLine {
  segment: string;
  service: string;
  priceRupees: number;
}

export interface PriceListItem {
  itemId: string;
  name: string;
  icon: string | null;
  lines: PriceListItemLine[];
}

export function useCustomerFlowPriceList() {
  return useQuery({
    queryKey: ['customer-flow', 'price-list'],
    queryFn: async (): Promise<PriceListItem[]> => {
      const { data } = await customerFlowApi.get<PriceListItem[]>('/items/price-list');
      return data;
    },
  });
}
