import { Inject, Injectable } from '@nestjs/common';
import { AppError } from '../../application/errors';
import type { StorageAdapter } from '../../application/ports';
import { STORAGE_ADAPTER } from '../../infra/infra.module';
import type { Readable } from 'stream';
import * as fs from 'fs';
import * as path from 'path';
import { createReadStream } from 'fs';

/** Allow only safe filename characters (no path traversal). */
function safeFileName(fileName: string): boolean {
  return /^[a-zA-Z0-9._-]+$/.test(fileName) && !fileName.includes('..');
}

function resolveApiAssetsRoot(): string {
  const configuredRoot = process.env.LOCAL_STORAGE_ROOT?.trim();
  if (configuredRoot) {
    const root = path.resolve(configuredRoot);
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    return root;
  }
  const cwd = process.cwd();
  const monorepoApiRoot = path.resolve(cwd, 'apps', 'api');
  const apiRoot = fs.existsSync(path.join(monorepoApiRoot, 'src'))
    ? monorepoApiRoot
    : cwd;
  const assetsRoot = path.join(apiRoot, 'assets');
  if (!fs.existsSync(assetsRoot)) fs.mkdirSync(assetsRoot, { recursive: true });
  return assetsRoot;
}

function getLocalContentType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
  };
  return map[ext] ?? 'application/octet-stream';
}

@Injectable()
export class AssetsService {
  private readonly assetsRoot = resolveApiAssetsRoot();

  constructor(
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  private async getLocalStreamOrNull(relativePath: string): Promise<{ stream: Readable; contentType: string } | null> {
    const fullPath = path.join(this.assetsRoot, relativePath);
    try {
      await fs.promises.access(fullPath, fs.constants.R_OK);
      return { stream: createReadStream(fullPath), contentType: getLocalContentType(fullPath) };
    } catch {
      return null;
    }
  }

  async getBrandingStream(
    fileName: string,
  ): Promise<{ stream: Readable; contentType: string }> {
    if (!safeFileName(fileName)) {
      throw new AppError('ASSET_NOT_FOUND', 'Invalid asset name');
    }
    const local = await this.getLocalStreamOrNull(path.join('branding', fileName));
    if (local) return local;

    const pathKey = `branding/${fileName}`;
    const stream = await this.storageAdapter.getObjectStream(pathKey);
    if (!stream) {
      throw new AppError('ASSET_NOT_FOUND', 'Asset not found', { fileName });
    }
    const contentType =
      'getContentTypeForPath' in this.storageAdapter
        ? (this.storageAdapter as StorageAdapter & { getContentTypeForPath(p: string): string }).getContentTypeForPath(pathKey)
        : 'application/octet-stream';
    return { stream, contentType };
  }

  /** Carousel: pathKey = carousel/:fileName */
  async getCarouselStream(
    fileName: string,
  ): Promise<{ stream: Readable; contentType: string }> {
    if (!safeFileName(fileName)) {
      throw new AppError('ASSET_NOT_FOUND', 'Invalid asset name');
    }
    const local = await this.getLocalStreamOrNull(path.join('carousel', fileName));
    if (local) return local;

    const pathKey = `carousel/${fileName}`;
    const stream = await this.storageAdapter.getObjectStream(pathKey);
    if (!stream) {
      throw new AppError('ASSET_NOT_FOUND', 'Asset not found', { fileName });
    }
    const contentType =
      'getContentTypeForPath' in this.storageAdapter
        ? (this.storageAdapter as StorageAdapter & { getContentTypeForPath(p: string): string }).getContentTypeForPath(pathKey)
        : 'application/octet-stream';
    return { stream, contentType };
  }

  /** Branch logo/QR: pathKey = branding/branches/:fileName */
  async getBrandingBranchStream(
    fileName: string,
  ): Promise<{ stream: Readable; contentType: string }> {
    if (!safeFileName(fileName)) {
      throw new AppError('ASSET_NOT_FOUND', 'Invalid asset name');
    }
    const local = await this.getLocalStreamOrNull(path.join('branding', 'branches', fileName));
    if (local) return local;

    const pathKey = `branding/branches/${fileName}`;
    const stream = await this.storageAdapter.getObjectStream(pathKey);
    if (!stream) {
      throw new AppError('ASSET_NOT_FOUND', 'Asset not found', { fileName });
    }
    const contentType =
      'getContentTypeForPath' in this.storageAdapter
        ? (this.storageAdapter as StorageAdapter & { getContentTypeForPath(p: string): string }).getContentTypeForPath(pathKey)
        : 'application/octet-stream';
    return { stream, contentType };
  }

  /** Customer portal branding assets: pathKey = branding/portals/:fileName */
  async getBrandingPortalStream(
    fileName: string,
  ): Promise<{ stream: Readable; contentType: string }> {
    if (!safeFileName(fileName)) {
      throw new AppError('ASSET_NOT_FOUND', 'Invalid asset name');
    }
    const local = await this.getLocalStreamOrNull(path.join('branding', 'portals', fileName));
    if (local) return local;

    const pathKey = `branding/portals/${fileName}`;
    const stream = await this.storageAdapter.getObjectStream(pathKey);
    if (!stream) {
      throw new AppError('ASSET_NOT_FOUND', 'Asset not found', { fileName });
    }
    const contentType =
      'getContentTypeForPath' in this.storageAdapter
        ? (this.storageAdapter as StorageAdapter & { getContentTypeForPath(p: string): string }).getContentTypeForPath(pathKey)
        : 'application/octet-stream';
    return { stream, contentType };
  }

  /** Catalog item custom icons: pathKey = catalog-icons/:fileName */
  async getCatalogIconStream(
    fileName: string,
  ): Promise<{ stream: Readable; contentType: string }> {
    if (!safeFileName(fileName)) {
      throw new AppError('ASSET_NOT_FOUND', 'Invalid asset name');
    }
    const local = await this.getLocalStreamOrNull(path.join('catalog-icons', fileName));
    if (local) return local;

    const pathKey = `catalog-icons/${fileName}`;
    const stream = await this.storageAdapter.getObjectStream(pathKey);
    if (!stream) {
      throw new AppError('ASSET_NOT_FOUND', 'Asset not found', { fileName });
    }
    const contentType =
      'getContentTypeForPath' in this.storageAdapter
        ? (this.storageAdapter as StorageAdapter & { getContentTypeForPath(p: string): string }).getContentTypeForPath(pathKey)
        : 'application/octet-stream';
    return { stream, contentType };
  }
}
