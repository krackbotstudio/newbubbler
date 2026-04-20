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
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../../common/jwt-auth.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { AdminCarouselService } from '../services/admin-carousel.service';

interface MulterUploadFile {
  buffer?: Buffer;
  originalname?: string;
  mimetype?: string;
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
  @UseInterceptors(FileInterceptor('file'))
  async upload(
    @UploadedFile() file: MulterUploadFile,
    @Query('position', new ParseIntPipe()) position: number,
  ) {
    if (position < 1 || position > 3) {
      throw new BadRequestException('position must be between 1 and 3');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    return this.adminCarouselService.upload(file as { buffer: Buffer; originalname?: string; mimetype?: string }, position);
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
