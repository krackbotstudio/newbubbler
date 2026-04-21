import { Controller, Get, Query } from '@nestjs/common';
import { CarouselPublicService } from './carousel-public.service';

/** Public carousel images for mobile app home. No auth. */
@Controller('carousel')
export class CarouselPublicController {
  constructor(private readonly carouselPublicService: CarouselPublicService) {}

  /** Optional `branchId`: use that branch's customer-portal carousel when configured; else global. */
  @Get('public')
  async getPublic(@Query('branchId') branchId?: string) {
    return this.carouselPublicService.getPublic(branchId ?? null);
  }
}
