import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerFlowApi } from '@/lib/customer-flow/api';

export interface AddressItem {
  id: string;
  userId: string;
  label: string;
  addressLine: string;
  pincode: string;
  isDefault: boolean;
  googleMapUrl?: string | null;
  houseNo?: string | null;
  streetArea?: string | null;
  city?: string | null;
}

export const ADDRESS_LABELS = [
  { value: 'Home', label: 'Home' },
  { value: 'Office', label: 'Office' },
  { value: 'Other', label: 'Other' },
  { value: 'Friends Place', label: 'Friends Place' },
] as const;

function fetchAddresses(): Promise<AddressItem[]> {
  return customerFlowApi.get<AddressItem[]>('/addresses').then((r) => r.data);
}

export function useCustomerFlowAddresses() {
  return useQuery({
    queryKey: ['customer-flow', 'addresses'],
    queryFn: fetchAddresses,
  });
}

export function useCreateCustomerFlowAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      label: string;
      addressLine: string;
      pincode: string;
      isDefault?: boolean;
      googleMapUrl?: string | null;
      houseNo?: string | null;
      streetArea?: string | null;
      city?: string | null;
    }) =>
      customerFlowApi.post<{ id: string; pincode: string }>('/addresses', body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-flow', 'addresses'] });
      qc.invalidateQueries({ queryKey: ['customer-flow', 'me'] });
    },
  });
}

export function useUpdateCustomerFlowAddress(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      label?: string;
      addressLine?: string;
      pincode?: string;
      isDefault?: boolean;
      googleMapUrl?: string | null;
      houseNo?: string | null;
      streetArea?: string | null;
      city?: string | null;
    }) =>
      customerFlowApi.patch<AddressItem>(`/addresses/${id}`, body).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-flow', 'addresses'] });
      qc.invalidateQueries({ queryKey: ['customer-flow', 'me'] });
    },
  });
}

export function useDeleteCustomerFlowAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      customerFlowApi.delete<{ ok: boolean }>(`/addresses/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customer-flow', 'addresses'] });
      qc.invalidateQueries({ queryKey: ['customer-flow', 'me'] });
    },
  });
}
