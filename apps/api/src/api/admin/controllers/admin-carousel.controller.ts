import {
  Controller,
  Get,
  Post,
  Delete,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Param,
  Query,
  BadRequestException,
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as fs from 'fs';
import * as path from 'path';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminCarouselService } from '../services/admin-carousel.service';

interface MulterUploadFile {
  filename?: string;
  originalname?: string;
}

function sanitizeOriginalName(name: string): string {
  return (name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100) || 'file';
}

function extFromName(name: string): string {
  const clean = sanitizeOriginalName(name);
  const ext = path.extname(clean).toLowerCase();
  if (ext === '.png' || ext === '.jpg' || ext === '.jpeg' || ext === '.webp') return ext;
  return '.png';
}

function resolveApiAssetsRoot(): string {
  const configuredRoot = process.env.LOCAL_STORAGE_ROOT?.trim();
  if (configuredRoot) {
    const root = path.resolve(configuredRoot);
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    return root;
  }
  // Vercel serverless: /var/task is read-only; /tmp is the only writable dir.
  if (process.env.VERCEL || process.env.VERCEL_ENV) {
    const tmp = path.join('/tmp', 'api-assets');
    if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
    return tmp;
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

function carouselMulterOptions() {
  const destination = path.join(resolveApiAssetsRoot(), 'carousel');
  if (!fs.existsSync(destination)) fs.mkdirSync(destination, { recursive: true });
  return {
    storage: diskStorage({
      destination: (_req, _file, cb) => cb(null, destination),
      filename: (req, file, cb) => {
        const rawPos = String(req.query?.position ?? '');
        const pos = Number(rawPos);
        const slot = [1, 2, 3].includes(pos) ? pos : 1;
        const base = `carousel-${slot}`;
        const ext = extFromName(file.originalname);
        const finalName = `${base}${ext}`;
        try {
          for (const existing of fs.readdirSync(destination)) {
            if (existing.startsWith(base) && existing !== finalName) {
              fs.unlinkSync(path.join(destination, existing));
            }
          }
        } catch {
          // best-effort cleanup only
        }
        cb(null, finalName);
      },
    }),
  };
}

@Controller('admin/carousel')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.BILLING, Role.OPS)
export class AdminCarouselController {
  constructor(private readonly adminCarouselService: AdminCarouselService) {}

  @Get()
  async list() {
    return this.adminCarouselService.list();
  }

  @Post('upload')
  @Roles(Role.ADMIN, Role.BILLING)
  @UseInterceptors(FileInterceptor('file', carouselMulterOptions()))
  async upload(
    @UploadedFile() file: MulterUploadFile,
    @Query('position', new ParseIntPipe()) position: number,
  ) {
    if (position < 1 || position > 3) {
      throw new BadRequestException('position must be between 1 and 3');
    }
    if (!file?.filename) {
      throw new BadRequestException('File is required');
    }
    return this.adminCarouselService.upload(
      file.filename,
      position,
    );
  }

  @Delete(':position')
  @Roles(Role.ADMIN, Role.BILLING)
  async remove(
    @Param('position', new ParseIntPipe()) position: number,
  ) {
    if (position < 1 || position > 3) {
      throw new BadRequestException('position must be between 1 and 3');
    }
    return this.adminCarouselService.remove(position);
  }
}
