import { Body, Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../common/agent-role';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import type { AuthUser } from '../common/roles.guard';
import { isBranchScopedStaffRole } from '../common/branch-scope.util';
import { FeedbackService } from './feedback.service';
import { AdminUpdateFeedbackDto } from './dto/admin-update-feedback.dto';
import type { FeedbackType } from '@shared/enums';
import type { FeedbackStatus } from '@shared/enums';

@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.OPS, AGENT_ROLE)
export class AdminFeedbackController {
  constructor(private readonly feedbackService: FeedbackService) {}

  @Get()
  async list(
    @Req() req: { user: AuthUser },
    @Query('type') type?: FeedbackType,
    @Query('status') status?: FeedbackStatus,
    @Query('rating') rating?: string,
    @Query('branchId') branchId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const user = req.user;
    const effectiveBranchId =
      isBranchScopedStaffRole(user.role) && user.branchId ? user.branchId : branchId || undefined;
    const filters = {
      type: type as FeedbackType | undefined,
      status: status as FeedbackStatus | undefined,
      rating: rating != null ? parseInt(rating, 10) : undefined,
      branchId: effectiveBranchId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      limit: limit != null ? Math.min(parseInt(limit, 10) || 20, 100) : 20,
      cursor,
    };
    return this.feedbackService.adminList(filters);
  }

  @Get('stats')
  async stats(
    @Req() req: { user: AuthUser },
    @Query('type') type?: FeedbackType,
    @Query('status') status?: FeedbackStatus,
    @Query('branchId') branchId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const user = req.user;
    const effectiveBranchId =
      isBranchScopedStaffRole(user.role) && user.branchId ? user.branchId : branchId || undefined;
    return this.feedbackService.adminRatingStats({
      type: type as FeedbackType | undefined,
      status: status as FeedbackStatus | undefined,
      branchId: effectiveBranchId,
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
