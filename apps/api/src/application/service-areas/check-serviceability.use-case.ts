import type { ServiceAreaRepo, BranchRepo } from '../ports';

export interface CheckServiceabilityDeps {
  serviceAreaRepo: ServiceAreaRepo;
  branchRepo?: BranchRepo;
  /** When set, serviceability is limited to this branch’s active pincodes (customer portal / branch context). */
  branchId?: string | null;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  message: string;
  /** Set when serviceable and branchRepo provided. */
  branchId?: string | null;
  /** Set when serviceable and branchRepo provided. */
  branchName?: string | null;
}

export async function checkServiceability(
  pincode: string,
  deps: CheckServiceabilityDeps,
): Promise<ServiceabilityResult> {
  const scopedBranchId = deps.branchId?.trim() || null;

  let serviceable: boolean;
  if (scopedBranchId) {
    serviceable = await deps.serviceAreaRepo.isPincodeActiveForBranch(pincode, scopedBranchId);
    if (serviceable && deps.branchRepo) {
      const scoped = await deps.branchRepo.getById(scopedBranchId);
      if (!scoped?.isActive) {
        serviceable = false;
      }
    }
  } else {
    serviceable = await deps.serviceAreaRepo.isServiceable(pincode);
  }

  const result: ServiceabilityResult = {
    serviceable,
    message: serviceable
      ? 'Pincode is serviceable'
      : scopedBranchId
        ? 'This branch does not serve this pincode yet.'
        : 'Sorry, we do not serve this pincode yet.',
  };

  if (serviceable && deps.branchRepo) {
    if (scopedBranchId) {
      const branch = await deps.branchRepo.getById(scopedBranchId);
      if (branch?.isActive) {
        result.branchId = branch.id;
        result.branchName = branch.name;
      }
    } else {
      const area = await deps.serviceAreaRepo.getByPincode(pincode);
      if (area?.branchId) {
        const branch = await deps.branchRepo.getById(area.branchId);
        if (branch?.isActive) {
          result.branchId = branch.id;
          result.branchName = branch.name;
        }
      }
    }
  }
  return result;
}
