import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import { getBranding } from '../../../application/branding/get-branding.use-case';
import { updateBranding } from '../../../application/branding/update-branding.use-case';
import type { BrandingUpsertData, BrandingRepo, StorageAdapter } from '../../../application/ports';
import { BRANDING_REPO, STORAGE_ADAPTER } from '../../../infra/infra.module';

interface UploadedImage {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
}

function extFromName(name: string | undefined): string {
  const ext = path.extname(name || 'file').toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
  return '.png';
}

@Injectable()
export class AdminBrandingService {
  constructor(
    @Inject(BRANDING_REPO) private readonly brandingRepo: BrandingRepo,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  private async uploadToAssets(
    storagePath: string,
    file: UploadedImage,
    localApiPath: string,
  ): Promise<string> {
    const remoteUrl = await this.storageAdapter.putObject(
      storagePath,
      file.buffer,
      file.mimetype || 'image/png',
    );
    return typeof remoteUrl === 'string' && remoteUrl.length > 0 ? remoteUrl : localApiPath;
  }

  async get() {
    return getBranding({ brandingRepo: this.brandingRepo });
  }

  async update(data: BrandingUpsertData) {
    return updateBranding(data, { brandingRepo: this.brandingRepo });
  }

  async uploadLogo(file: UploadedImage) {
    const ext = extFromName(file.originalname);
    const fileName = `logo-${randomUUID()}${ext}`;
    const storagePath = `branding/${fileName}`;
    const url = await this.uploadToAssets(storagePath, file, `/api/assets/branding/${fileName}`);
    await this.brandingRepo.setLogoUrl(url);
    return this.get();
  }

  async uploadUpiQr(file: UploadedImage) {
    const ext = extFromName(file.originalname);
    const fileName = `upi-qr-${randomUUID()}${ext}`;
    const storagePath = `branding/${fileName}`;
    const url = await this.uploadToAssets(storagePath, file, `/api/assets/branding/${fileName}`);
    await this.brandingRepo.setUpiQrUrl(url);
    return this.get();
  }

  async uploadWelcomeBackground(file: UploadedImage) {
    const ext = extFromName(file.originalname);
    const fileName = `welcome-bg-${randomUUID()}${ext}`;
    const storagePath = `branding/${fileName}`;
    const url = await this.uploadToAssets(storagePath, file, `/api/assets/branding/${fileName}`);
    await this.brandingRepo.setWelcomeBackgroundUrl(url);
    return this.get();
  }

  async uploadAppIcon(file: UploadedImage) {
    const ext = extFromName(file.originalname);
    const fileName = `app-icon-${randomUUID()}${ext}`;
    const storagePath = `branding/${fileName}`;
    const url = await this.uploadToAssets(storagePath, file, `/api/assets/branding/${fileName}`);
    await this.brandingRepo.setAppIconUrl(url);
    return this.get();
  }
}
