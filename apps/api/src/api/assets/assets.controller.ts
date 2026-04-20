import { Controller, Get, Param, Res, Header } from '@nestjs/common';
import { Response } from 'express';
import { AssetsService } from './assets.service';

/**
 * Branding assets (logo, UPI QR). Public.
 */
@Controller('assets/branding')
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get('branches/:fileName')
  @Header('Cache-Control', 'public, max-age=3600')
  async getBranchAsset(
    @Param('fileName') fileName: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { stream, contentType } = await this.assetsService.getBrandingBranchStream(fileName);
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);
  }

  @Get('portals/:fileName')
  @Header('Cache-Control', 'public, max-age=3600')
  async getPortalAsset(
    @Param('fileName') fileName: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { stream, contentType } = await this.assetsService.getBrandingPortalStream(fileName);
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);
  }

  @Get(':fileName')
  @Header('Cache-Control', 'public, max-age=3600')
  async getBrandingAsset(
    @Param('fileName') fileName: string,
    @Res({ passthrough: false }) res: Response,
  ) {
    const { stream, contentType } = await this.assetsService.getBrandingStream(fileName);
    res.setHeader('Content-Type', contentType);
    stream.pipe(res);
  }
}
