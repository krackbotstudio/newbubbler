import type { CustomersRepo, CustomerRecord } from '../ports';

export interface SearchCustomersByPhoneDeps {
  customersRepo: CustomersRepo;
}

export async function searchCustomersByPhone(
  phoneLike: string,
  deps: SearchCustomersByPhoneDeps,
  branchId?: string | null,
): Promise<CustomerRecord[]> {
  return deps.customersRepo.findByPhone(phoneLike, branchId);
}
