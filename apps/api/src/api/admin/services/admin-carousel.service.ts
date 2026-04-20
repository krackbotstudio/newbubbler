import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as path from 'path';
import type { CarouselRepo, StorageAdapter } from '../../../application/ports';
import { CAROUSEL_REPO, STORAGE_ADAPTER } from '../../../infra/infra.module';

const MAX_IMAGES = 3;
const POSITIONS = [1, 2, 3] as const;

@Injectable()
export class AdminCarouselService {
  constructor(
    @Inject(CAROUSEL_REPO) private readonly carouselRepo: CarouselRepo,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  private extFromName(name: string | undefined): string {
    const ext = path.extname(name || 'file').toLowerCase();
    if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
    return '.png';
  }

  async list() {
    const images = await this.carouselRepo.list();
    const byPosition: Record<number, { id: string; imageUrl: string; createdAt: string; updatedAt: string } | null> = {
      1: null,
      2: null,
      3: null,
    };
    for (const img of images) {
      if (img.position >= 1 && img.position <= MAX_IMAGES) {
        byPosition[img.position] = {
          id: img.id,
          imageUrl: img.imageUrl,
          createdAt: img.createdAt.toISOString(),
          updatedAt: img.updatedAt.toISOString(),
        };
      }
    }
    return { slots: [byPosition[1], byPosition[2], byPosition[3]] };
  }

  async upload(file: { buffer: Buffer; originalname?: string; mimetype?: string }, position: number) {
    if (!POSITIONS.includes(position as 1 | 2 | 3)) {
      throw new BadRequestException('Position must be 1, 2, or 3');
    }
    const ext = this.extFromName(file.originalname);
    const fileName = `carousel-${position}-${randomUUID()}${ext}`;
    const key = `carousel/${fileName}`;
    const uploaded = await this.storageAdapter.putObject(key, file.buffer, file.mimetype || 'image/png');
    const imageUrl =
      typeof uploaded === 'string' && uploaded.length > 0 ? uploaded : `/api/assets/carousel/${fileName}`;
    const record = await this.carouselRepo.setImage(position, imageUrl);
    return {
      position: record.position,
      imageUrl: record.imageUrl,
      id: record.id,
    };
  }

  async remove(position: number) {
    if (!POSITIONS.includes(position as 1 | 2 | 3)) {
      throw new BadRequestException('Position must be 1, 2, or 3');
    }
    await this.carouselRepo.removeImage(position);
    return { removed: position };
  }
}
