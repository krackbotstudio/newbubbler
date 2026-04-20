import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { Role } from '@shared/enums';
import type { CustomerPortalsRepo, StorageAdapter } from '../../../application/ports';
import { AppError } from '../../../application/errors';
import { CUSTOMER_PORTALS_REPO, STORAGE_ADAPTER } from '../../../infra/infra.module';
import type { AuthUser } from '../../common/roles.guard';

function sanitizeSlug(raw: string): string {
  return raw.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
}

@Injectable()
export class AdminCustomerPortalsService {
  constructor(
    @Inject(CUSTOMER_PORTALS_REPO)
    private readonly portalsRepo: CustomerPortalsRepo,
    @Inject(STORAGE_ADAPTER)
    private readonly storageAdapter: StorageAdapter,
  ) {}

  private extFromName(name: string | undefined): string {
    const ext = path.extname(name || 'file').toLowerCase();
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
    return '.png';
  }

  private assertStaff(actor: AuthUser | undefined) {
    if (!actor || (actor.role !== Role.ADMIN && actor.role !== Role.PARTIAL_ADMIN && actor.role !== Role.OPS)) {
      throw new AppError('FORBIDDEN', 'Only staff can manage branch customer portals');
    }
  }

  private assertCanManageBranch(actor: AuthUser, branchId: string): void {
    if (actor.role === Role.ADMIN) return;
    if (actor.role === Role.OPS) {
      if (!actor.branchId || actor.branchId !== branchId) {
        throw new AppError('FORBIDDEN', 'You can only manage your own branch portal');
      }
      return;
    }
    if (actor.role === Role.PARTIAL_ADMIN) {
      const allowed = new Set((actor.branchIds ?? []).filter(Boolean));
      if (allowed.size > 0 && !allowed.has(branchId)) {
        throw new AppError('FORBIDDEN', 'You can only manage assigned branch portals');
      }
      return;
    }
    throw new AppError('FORBIDDEN', 'Not allowed');
  }

  private portalUrl(slug: string): string {
    return `https://${slug}.bubbler.krackbot.com`;
  }

  async getPortalForBranch(actor: AuthUser, branchId: string) {
    this.assertStaff(actor);
    this.assertCanManageBranch(actor, branchId);
    const portal = await this.portalsRepo.getByBranchId(branchId);
    if (!portal) return null;
    return { ...portal, shareableUrl: this.portalUrl(portal.slug) };
  }

  async upsertPortalForBranch(
    actor: AuthUser,
    branchId: string,
    input: { brandName: string; slug: string; termsAndConditions?: string; isActive?: boolean },
  ) {
    this.assertStaff(actor);
    this.assertCanManageBranch(actor, branchId);
    const slug = sanitizeSlug(input.slug);
    if (!slug || slug.length < 3 || slug.length > 40) {
      throw new BadRequestException('Invalid slug');
    }
    const existing = await this.portalsRepo.getByBranchId(branchId);
    const portal = existing
      ? await this.portalsRepo.update(existing.id, {
          brandName: input.brandName.trim(),
          slug,
          termsAndConditions: input.termsAndConditions?.trim() || null,
          ...(input.isActive !== undefined && { isActive: input.isActive }),
        })
      : await this.portalsRepo.create({
          ownerUserId: actor.id,
          branchId,
          brandName: input.brandName.trim(),
          slug,
          termsAndConditions: input.termsAndConditions?.trim() || null,
        });

    return { ...portal, shareableUrl: this.portalUrl(portal.slug) };
  }

  async uploadLogo(
    actor: AuthUser,
    branchId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
  ) {
    this.assertStaff(actor);
    this.assertCanManageBranch(actor, branchId);
    const portal = await this.portalsRepo.getByBranchId(branchId);
    if (!portal) throw new BadRequestException('Save portal details first, then upload assets');
    const ext = this.extFromName(file.originalname);
    const fileName = `portal-logo-${branchId}-${randomUUID()}${ext}`;
    const key = `branding/portals/${fileName}`;
    const uploaded = await this.storageAdapter.putObject(key, file.buffer, file.mimetype || 'image/png');
    const url =
      typeof uploaded === 'string' && uploaded.length > 0
        ? uploaded
        : `/api/assets/branding/portals/${fileName}`;
    const updated = await this.portalsRepo.update(portal.id, { logoUrl: url });
    return { ...updated, shareableUrl: this.portalUrl(updated.slug) };
  }

  async uploadAppIcon(
    actor: AuthUser,
    branchId: string,
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
  ) {
    this.assertStaff(actor);
    this.assertCanManageBranch(actor, branchId);
    const portal = await this.portalsRepo.getByBranchId(branchId);
    if (!portal) throw new BadRequestException('Save portal details first, then upload assets');
    const ext = this.extFromName(file.originalname);
    const fileName = `portal-icon-${branchId}-${randomUUID()}${ext}`;
    const key = `branding/portals/${fileName}`;
    const uploaded = await this.storageAdapter.putObject(key, file.buffer, file.mimetype || 'image/png');
    const url =
      typeof uploaded === 'string' && uploaded.length > 0
        ? uploaded
        : `/api/assets/branding/portals/${fileName}`;
    const updated = await this.portalsRepo.update(portal.id, { appIconUrl: url });
    return { ...updated, shareableUrl: this.portalUrl(updated.slug) };
  }

  async setCarouselImage(
    actor: AuthUser,
    branchId: string,
    position: number,
    file: { buffer: Buffer; originalname?: string; mimetype?: string },
  ) {
    this.assertStaff(actor);
    this.assertCanManageBranch(actor, branchId);
    const portal = await this.portalsRepo.getByBranchId(branchId);
    if (!portal) throw new BadRequestException('Save portal details first, then upload assets');
    const ext = this.extFromName(file.originalname);
    const fileName = `portal-carousel-${branchId}-${position}-${randomUUID()}${ext}`;
    const key = `branding/portals/${fileName}`;
    const uploaded = await this.storageAdapter.putObject(key, file.buffer, file.mimetype || 'image/png');
    const url =
      typeof uploaded === 'string' && uploaded.length > 0
        ? uploaded
        : `/api/assets/branding/portals/${fileName}`;
    await this.portalsRepo.setCarouselImage(portal.id, position, url);
    const refreshed = await this.portalsRepo.getByBranchId(branchId);
    return refreshed ? { ...refreshed, shareableUrl: this.portalUrl(refreshed.slug) } : null;
  }
}

