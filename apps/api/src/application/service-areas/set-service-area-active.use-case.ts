import type { ServiceAreaRepo, ServiceAreaRecord } from '../ports';

export interface SetServiceAreaActiveDeps {
  serviceAreaRepo: ServiceAreaRepo;
}

export async function setServiceAreaActive(
  id: string,
  active: boolean,
  deps: SetServiceAreaActiveDeps,
): Promise<ServiceAreaRecord> {
  return deps.serviceAreaRepo.setActive(id, active);
}
