import { Inject, Injectable } from '@nestjs/common';
import {
  ADDRESSES_REPO,
  BRANCH_REPO,
  CUSTOMERS_REPO,
  CUSTOMER_PORTALS_REPO,
  SERVICE_AREA_REPO,
} from '../../infra/infra.module';
import type {
  AddressesRepo,
  BranchRepo,
  CustomersRepo,
  CustomerPortalsRepo,
  ServiceAreaRepo,
} from '../../application/ports';
import { AppError } from '../../application/errors';
import type { AuthUser } from '../common/roles.guard';

export interface RegisterPushTokenResult {
  ok: boolean;
}

export interface MeResponse {
  user: { id: string; phone: string | null; role: string; name: string | null; email: string | null };
  defaultAddress?: { id: string; pincode: string };
}

export interface CustomerBranchOption {
  id: string;
  name: string;
  logoUrl: string | null;
  updatedAt: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
}

@Injectable()
export class MeService {
  constructor(
    @Inject(ADDRESSES_REPO) private readonly addressesRepo: AddressesRepo,
    @Inject(CUSTOMERS_REPO) private readonly customersRepo: CustomersRepo,
    @Inject(CUSTOMER_PORTALS_REPO) private readonly customerPortalsRepo: CustomerPortalsRepo,
    @Inject(SERVICE_AREA_REPO) private readonly serviceAreaRepo: ServiceAreaRepo,
    @Inject(BRANCH_REPO) private readonly branchRepo: BranchRepo,
  ) {}

  private async resolvePortalBranchScope(
    userId: string,
    rawHost?: string,
    slugHint?: string,
  ): Promise<string | null> {
    const hinted = (slugHint ?? '').trim().toLowerCase();
    const host = (rawHost ?? '').split(',')[0]?.trim().toLowerCase().split(':')[0] ?? '';
    const parts = host.split('.');
    const hostSlug =
      parts.length >= 4 && parts.slice(-3).join('.') === 'bubbler.krackbot.com'
        ? parts.slice(0, -3).join('.')
        : '';
    const slug = hinted || hostSlug;
    if (!slug) return null;
    const portal = await this.customerPortalsRepo.getByAccessKey(slug);
    if (!portal || !portal.isActive) throw new AppError('NOT_FOUND', 'Portal not found');
    const isMember = await this.customerPortalsRepo.isMember(portal.id, userId);
    if (!isMember) throw new AppError('FORBIDDEN', 'Join portal before continuing');
    return portal.branchId;
  }

  async getMe(user: AuthUser, rawHost?: string, slugHint?: string): Promise<MeResponse> {
    await this.resolvePortalBranchScope(user.id, rawHost, slugHint);
    const [customer, defaultAddress] = await Promise.all([
      this.customersRepo.getById(user.id),
      this.addressesRepo.findDefaultByUserId(user.id),
    ]);

    return {
      user: {
        id: user.id,
        phone: user.phone ?? null,
        role: user.role,
        name: customer?.name ?? null,
        email: customer?.email ?? null,
      },
      ...(defaultAddress && { defaultAddress: { id: defaultAddress.id, pincode: defaultAddress.pincode } }),
    };
  }

  async updateMe(user: AuthUser, patch: { name?: string | null; email?: string | null }) {
    return this.customersRepo.update(user.id, patch);
  }

  async registerPushToken(user: AuthUser, pushToken: string): Promise<RegisterPushTokenResult> {
    await this.customersRepo.update(user.id, { expoPushToken: pushToken });
    return { ok: true };
  }

  /** Branches the customer may choose (portal: single branch; app: union of branches serving saved-address pincodes). */
  async listAvailableBranches(
    user: AuthUser,
    rawHost?: string,
    slugHint?: string,
  ): Promise<{ branches: CustomerBranchOption[] }> {
    let portalBranchId: string | null = null;
    try {
      portalBranchId = await this.resolvePortalBranchScope(user.id, rawHost, slugHint);
    } catch {
      portalBranchId = null;
    }
    if (portalBranchId) {
      const b = await this.branchRepo.getById(portalBranchId);
      if (!b) return { branches: [] };
      return {
        branches: [
          {
            id: b.id,
            name: (b.name ?? '').trim() || b.id,
            logoUrl: b.logoUrl?.trim() ? b.logoUrl.trim() : null,
            updatedAt: b.updatedAt ? b.updatedAt.toISOString() : null,
            primaryColor: b.primaryColor?.trim() ? b.primaryColor.trim() : null,
            secondaryColor: b.secondaryColor?.trim() ? b.secondaryColor.trim() : null,
          },
        ],
      };
    }

    const addresses = await this.addressesRepo.listByUserId(user.id);
    const pincodes = [...new Set(addresses.map((a) => a.pincode.trim()).filter(Boolean))];
    const seen = new Set<string>();
    const branches: CustomerBranchOption[] = [];
    for (const pc of pincodes) {
      const areas = await this.serviceAreaRepo.listActiveByPincode(pc);
      for (const a of areas) {
        if (seen.has(a.branchId)) continue;
        seen.add(a.branchId);
        const b = await this.branchRepo.getById(a.branchId);
        if (!b) continue;
        branches.push({
          id: a.branchId,
          name: (b.name ?? '').trim() || a.branchId,
          logoUrl: b.logoUrl?.trim() ? b.logoUrl.trim() : null,
          updatedAt: b.updatedAt ? b.updatedAt.toISOString() : null,
          primaryColor: b.primaryColor?.trim() ? b.primaryColor.trim() : null,
          secondaryColor: b.secondaryColor?.trim() ? b.secondaryColor.trim() : null,
        });
      }
    }

    /**
     * New customers have no saved addresses yet, so the pincode union above is empty and they would
     * skip branch selection entirely. Fall back to every branch that has at least one active service
     * area (then all branches) so onboarding can show the same picker as existing users.
     */
    if (branches.length === 0) {
      const areas = await this.serviceAreaRepo.listAll();
      for (const a of areas) {
        if (!a.active) continue;
        if (seen.has(a.branchId)) continue;
        seen.add(a.branchId);
        const b = await this.branchRepo.getById(a.branchId);
        if (!b) continue;
        branches.push({
          id: a.branchId,
          name: (b.name ?? '').trim() || a.branchId,
          logoUrl: b.logoUrl?.trim() ? b.logoUrl.trim() : null,
          updatedAt: b.updatedAt ? b.updatedAt.toISOString() : null,
          primaryColor: b.primaryColor?.trim() ? b.primaryColor.trim() : null,
          secondaryColor: b.secondaryColor?.trim() ? b.secondaryColor.trim() : null,
        });
      }
    }
    if (branches.length === 0) {
      const all = await this.branchRepo.listAll();
      for (const b of all) {
        branches.push({
          id: b.id,
          name: (b.name ?? '').trim() || b.id,
          logoUrl: b.logoUrl?.trim() ? b.logoUrl.trim() : null,
          updatedAt: b.updatedAt ? b.updatedAt.toISOString() : null,
          primaryColor: b.primaryColor?.trim() ? b.primaryColor.trim() : null,
          secondaryColor: b.secondaryColor?.trim() ? b.secondaryColor.trim() : null,
        });
      }
    }

    branches.sort((a, b) => a.name.localeCompare(b.name));
    return { branches };
  }
}
