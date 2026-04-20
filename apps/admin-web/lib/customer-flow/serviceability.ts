import { customerFlowApi } from './api';

export interface ServiceabilityResult {
  pincode: string;
  serviceable: boolean;
  message?: string;
  branchId?: string | null;
  branchName?: string | null;
}

export async function checkPincodeServiceability(pincode: string): Promise<ServiceabilityResult> {
  const pc = pincode.trim();
  const { data } = await customerFlowApi.get<ServiceabilityResult>('/serviceability', {
    params: { pincode: pc },
  });
  return {
    pincode: pc,
    serviceable: !!data.serviceable,
    message: data.message,
    branchId: data.branchId ?? null,
    branchName: data.branchName ?? null,
  };
}

export async function submitAreaRequest(body: {
  pincode: string;
  addressLine: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
}): Promise<{ id: string; status: string; createdAt?: string }> {
  const { data } = await customerFlowApi.post<{ id: string; status: string; createdAt?: string }>(
    '/feedback/area-request',
    body,
  );
  return data;
}

