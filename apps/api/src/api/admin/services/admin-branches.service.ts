import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { Role } from '@shared/enums';
import type { BranchRepo, OperatingHoursRepo, StorageAdapter } from '../../../application/ports';
import { BRANCH_REPO, OPERATING_HOURS_REPO, STORAGE_ADAPTER } from '../../../infra/infra.module';
import type { AuthUser } from '../../common/roles.guard';

/** Default daily window for new branches (matches schedule UI placeholders). */
const DEFAULT_OPERATING_START = '09:00';
const DEFAULT_OPERATING_END = '18:00';

export interface BranchFieldUniquenessSlot {
  available: boolean;
  takenByBranchName?: string;
}

export interface BranchFieldUniquenessResult {
  name: BranchFieldUniquenessSlot;
  invoicePrefix: BranchFieldUniquenessSlot;
  itemTagBrandName: BranchFieldUniquenessSlot;
}

function optionalTrimmed(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  return t.length ? t : null;
}

function normName(s: string): string {
  return s.trim().toLowerCase();
}

function normToken(s: string): string {
  return s.trim().toLowerCase();
}

function normalizeHexColor(s: string | null | undefined): string | null {
  const t = (s ?? '').trim();
  if (!t) return null;
  const withHash = t.startsWith('#') ? t : `#${t}`;
  if (!/^#[0-9A-Fa-f]{6}$/.test(withHash)) return null;
  return withHash.toUpperCase();
}

@Injectable()
export class AdminBranchesService {
  constructor(
    @Inject(BRANCH_REPO) private readonly branchRepo: BranchRepo,
    @Inject(OPERATING_HOURS_REPO) private readonly operatingHoursRepo: OperatingHoursRepo,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  private extFromName(name: string | undefined): string {
    const ext = path.extname(name || 'file').toLowerCase();
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
    return '.png';
  }

  private assertOpsOwnBranch(actor: AuthUser | undefined, branchId: string): void {
    if (actor?.role === Role.OPS) {
      if (!actor.branchId || actor.branchId !== branchId) {
        throw new ForbiddenException('You can only manage your own branch');
      }
    }
    if (actor?.role === Role.PARTIAL_ADMIN) {
      const allowed = new Set((actor.branchIds ?? []).filter(Boolean));
      if (!allowed.has(branchId)) {
        throw new ForbiddenException('You can only manage your assigned branches');
      }
    }
  }

  async list(actor?: AuthUser) {
    const all = await this.branchRepo.listAll();
    if (actor?.role === Role.OPS && actor.branchId) {
      return all.filter((b) => b.id === actor.branchId);
    }
    if (actor?.role === Role.PARTIAL_ADMIN) {
      const allowed = new Set((actor.branchIds ?? []).filter(Boolean));
      return all.filter((b) => allowed.has(b.id));
    }
    return all;
  }

  async getById(id: string, actor?: AuthUser) {
    const branch = await this.branchRepo.getById(id);
    if (!branch) throw new NotFoundException('Branch not found');
    this.assertOpsOwnBranch(actor, id);
    return branch;
  }

  /** Case-insensitive uniqueness of branch name, invoice prefix, and item-tag short brand across all branches. */
  async checkFieldUniqueness(
    input: {
      excludeBranchId?: string | null;
      name?: string | null;
      invoicePrefix?: string | null;
      itemTagBrandName?: string | null;
    },
    _actor?: AuthUser,
  ): Promise<BranchFieldUniquenessResult> {
    const all = await this.branchRepo.listAll();
    const exclude = optionalTrimmed(input.excludeBranchId ?? undefined);
    const others = exclude ? all.filter((b) => b.id !== exclude) : all;

    const nameRaw = optionalTrimmed(input.name ?? undefined);
    const nameKey = nameRaw ? normName(nameRaw) : null;
    const prefixRaw = optionalTrimmed(input.invoicePrefix ?? undefined);
    const prefixKey = prefixRaw ? normToken(prefixRaw) : null;
    const tagRaw = optionalTrimmed(input.itemTagBrandName ?? undefined);
    const tagKey = tagRaw ? normToken(tagRaw) : null;

    let name: BranchFieldUniquenessSlot = { available: true };
    if (nameKey) {
      const hit = others.find((b) => normName(b.name) === nameKey);
      name = hit ? { available: false, takenByBranchName: hit.name } : { available: true };
    }

    let invoicePrefix: BranchFieldUniquenessSlot = { available: true };
    if (prefixKey) {
      const hit = others.find((b) => {
        const p = optionalTrimmed(b.invoicePrefix ?? undefined);
        return p != null && normToken(p) === prefixKey;
      });
      invoicePrefix = hit ? { available: false, takenByBranchName: hit.name } : { available: true };
    }

    let itemTagBrandName: BranchFieldUniquenessSlot = { available: true };
    if (tagKey) {
      const hit = others.find((b) => {
        const t = optionalTrimmed(b.itemTagBrandName ?? undefined);
        return t != null && normToken(t) === tagKey;
      });
      itemTagBrandName = hit ? { available: false, takenByBranchName: hit.name } : { available: true };
    }

    return { name, invoicePrefix, itemTagBrandName };
  }

  private async assertUniqueBranchFields(
    excludeBranchId: string | undefined,
    name: string,
    invoicePrefix: string | null | undefined,
    itemTagBrandName: string | null | undefined,
  ): Promise<void> {
    const r = await this.checkFieldUniqueness({
      excludeBranchId: excludeBranchId ?? undefined,
      name,
      invoicePrefix: invoicePrefix ?? null,
      itemTagBrandName: itemTagBrandName ?? null,
    });
    const parts: string[] = [];
    if (!r.name.available) {
      parts.push(`Branch name is already used by "${r.name.takenByBranchName}".`);
    }
    if (!r.invoicePrefix.available) {
      parts.push(
        `Invoice prefix is already used by "${r.invoicePrefix.takenByBranchName}". Use a unique prefix per branch.`,
      );
    }
    if (!r.itemTagBrandName.available) {
      parts.push(
        `Short brand on item tag is already used by "${r.itemTagBrandName.takenByBranchName}". Use a unique tag line per branch.`,
      );
    }
    if (parts.length) {
      throw new BadRequestException(parts.join(' '));
    }
  }

  async create(data: Parameters<BranchRepo['create']>[0]) {
    const normalized = {
      ...data,
      primaryColor: normalizeHexColor(data.primaryColor),
      secondaryColor: normalizeHexColor(data.secondaryColor),
    };
    await this.assertUniqueBranchFields(undefined, normalized.name, normalized.invoicePrefix ?? null, normalized.itemTagBrandName ?? null);
    const branch = await this.branchRepo.create(normalized);
    await this.operatingHoursRepo.set(branch.id, DEFAULT_OPERATING_START, DEFAULT_OPERATING_END);
    if (data.isDefault === true) {
      await this.branchRepo.clearOtherDefaults(branch.id);
      return this.branchRepo.getById(branch.id) ?? branch;
    }
    return branch;
  }

  async update(id: string, data: Parameters<BranchRepo['update']>[1], actor?: AuthUser) {
    const normalized = {
      ...data,
      ...(data.primaryColor !== undefined && { primaryColor: normalizeHexColor(data.primaryColor) }),
      ...(data.secondaryColor !== undefined && { secondaryColor: normalizeHexColor(data.secondaryColor) }),
    };
    const existing = await this.getById(id, actor);
    const mergedName = normalized.name !== undefined ? normalized.name : existing.name;
    const mergedPrefix = normalized.invoicePrefix !== undefined ? normalized.invoicePrefix : existing.invoicePrefix;
    const mergedTag = normalized.itemTagBrandName !== undefined ? normalized.itemTagBrandName : existing.itemTagBrandName;
    await this.assertUniqueBranchFields(id, mergedName, mergedPrefix, mergedTag);
    if (actor?.role === Role.OPS && normalized.isDefault === true) {
      throw new ForbiddenException('Branch heads cannot change the default branch flag');
    }
    if (normalized.isDefault === true) {
      await this.branchRepo.clearOtherDefaults(id);
    }
    return this.branchRepo.update(id, normalized);
  }

  async delete(id: string) {
    await this.getById(id);
    return this.branchRepo.delete(id);
  }

  async uploadLogo(
    branchId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
    actor?: AuthUser,
  ) {
    await this.getById(branchId, actor);
    const ext = this.extFromName(file.originalname);
    const fileName = `branch-${branchId}-logo-${randomUUID()}${ext}`;
    const key = `branding/branches/${fileName}`;
    const uploaded = await this.storageAdapter.putObject(key, file.buffer, file.mimetype || 'image/png');
    const url =
      typeof uploaded === 'string' && uploaded.length > 0
        ? uploaded
        : `/api/assets/branding/branches/${fileName}`;
    await this.branchRepo.setLogoUrl(branchId, url);
    return this.getById(branchId, actor);
  }

  async uploadUpiQr(
    branchId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
    actor?: AuthUser,
  ) {
    await this.getById(branchId, actor);
    const ext = this.extFromName(file.originalname);
    const fileName = `branch-${branchId}-upi-qr-${randomUUID()}${ext}`;
    const key = `branding/branches/${fileName}`;
    const uploaded = await this.storageAdapter.putObject(key, file.buffer, file.mimetype || 'image/png');
    const url =
      typeof uploaded === 'string' && uploaded.length > 0
        ? uploaded
        : `/api/assets/branding/branches/${fileName}`;
    await this.branchRepo.setUpiQrUrl(branchId, url);
    return this.getById(branchId, actor);
  }
}
