import { Body, Controller, Get, Patch, Param, Query, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import { FeedbackService } from './feedback.service';
import { AdminUpdateFeedbackDto } from './dto/admin-update-feedback.dto';
import type { FeedbackType } from '@shared/enums';
import type { FeedbackStatus } from '@shared/enums';

@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPS)
export class AdminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  async list(
    @Query('type') type?: FeedbackType,
    @Query('status') status?: FeedbackStatus,
    @Query('rating') rating?: string,
    @Query('branchId') branchId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const filters = {
      type: type as FeedbackType | undefined,
      status: status as FeedbackStatus | undefined,
      rating: rating != null ? parseInt(rating, 10) : undefined,
      branchId: branchId || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit != null ? Math.min(parseInt(limit, 10) || 20, 100) : 20,
      cursor,
    };
    return this.feedbackService.adminList(filters);
  }

  @Get('stats')
  async stats(
    @Query('type') type?: FeedbackType,
    @Query('status') status?: FeedbackStatus,
    @Query('branchId') branchId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.feedbackService.adminRatingStats({
      type: type as FeedbackType | undefined,
      status: status as FeedbackStatus | undefined,
      branchId: branchId || undefined,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
    });
  }

  @Patch(':id')
  async updateStatus(@Param('id') id: string, @Body() dto: AdminUpdateFeedbackDto) {
    const feedback = await this.feedbackService.adminUpdateStatus(
      id,
      dto.status,
      dto.adminNotes,
    );
    return {
      id: feedback.id,
      status: feedback.status,
      adminNotes: feedback.adminNotes,
      updatedAt: feedback.updatedAt,
    };
  }
}
