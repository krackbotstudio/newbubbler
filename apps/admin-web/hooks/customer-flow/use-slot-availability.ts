import { useQuery } from '@tanstack/react-query';
import { fetchSlotAvailability, type SlotAvailability } from '@/lib/customer-flow/slots';

export function useCustomerFlowSlotAvailability(
  pincode: string | null,
  date: string | null,
  branchId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['customer-flow', 'slots', pincode, date, branchId],
    queryFn: (): Promise<SlotAvailability> =>
      fetchSlotAvailability(pincode!, date!, branchId ?? undefined),
    enabled: enabled && !!pincode && pincode.replace(/\D/g, '').length >= 6 && !!date,
  });
}
