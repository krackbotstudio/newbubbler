import { AppError } from '../errors';
import type { ServiceCategoryRepo, ServiceCategoryRecord } from '../ports';

export interface CreateServiceCategoryInput {
  branchId: string;
  code: string;
  label: string;
  isActive?: boolean;
}

export interface CreateServiceCategoryDeps {
  serviceCategoryRepo: ServiceCategoryRepo;
}

const CODE_REGEX = /^[A-Z][A-Z0-9_]*$/;

export async function createServiceCategory(
  input: CreateServiceCategoryInput,
  deps: CreateServiceCategoryDeps,
): Promise<ServiceCategoryRecord> {
  const code = input.code.trim().toUpperCase().replace(/\s+/g, '_');
  if (!CODE_REGEX.test(code)) {
    throw new AppError('INVALID_CODE', 'Service category code must be uppercase letters, numbers, and underscores');
  }
  const branchId = input.branchId.trim();
  if (!branchId) {
    throw new AppError('BRANCH_REQUIRED', 'branchId is required');
  }
  const existing = await deps.serviceCategoryRepo.getByBranchIdAndCode(branchId, code);
  if (existing) {
    throw new AppError('SERVICE_CATEGORY_EXISTS', 'A service category with this code already exists for this branch', {
      code,
      branchId,
    });
  }
  return deps.serviceCategoryRepo.create(branchId, code, input.label.trim() || code, input.isActive ?? true);
}
