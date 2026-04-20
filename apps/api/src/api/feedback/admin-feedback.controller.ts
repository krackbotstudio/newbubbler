import { Body, Controller, Get, Patch, Param, Query, Req, UseGuards } from '@nestjs/common';
import { Role } from '@shared/enums';
import { AGENT_ROLE } from '../common/agent-role';
import { JwtAuthGuard } from '../common/jwt-auth.guard';
import { Roles } from '../common/roles.decorator';
import { RolesGuard } from '../common/roles.guard';
import type { AuthUser } from '../common/roles.guard';
import { resolveScopedBranchId } from '../common/branch-scope.util';
import { FeedbackService } from './feedback.service';
import { AdminUpdateFeedbackDto } from './dto/admin-update-feedback.dto';
import type { FeedbackType } from '@shared/enums';
import type { FeedbackStatus } from '@shared/enums';

function parseOptionalInt(value?: string): number | undefined {
  if (value == null || value.trim() === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parseOptionalDate(value?: string): Date | undefined {
  if (value == null || value.trim() === '') return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

@Controller('admin/feedback')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.PARTIAL_ADMIN, Role.OPS, AGENT_ROLE)
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
    const effectiveBranchId = resolveScopedBranchId(user, branchId);
    const parsedLimit = parseOptionalInt(limit);
    const filters = {
      type: type as FeedbackType | undefined,
      status: status as FeedbackStatus | undefined,
      rating: parseOptionalInt(rating),
      branchId: effectiveBranchId,
      dateFrom: parseOptionalDate(dateFrom),
      dateTo: parseOptionalDate(dateTo),
      limit: parsedLimit != null ? Math.min(parsedLimit || 20, 100) : 20,
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
    const effectiveBranchId = resolveScopedBranchId(user, branchId);
    return this.feedbackService.adminRatingStats({
      type: type as FeedbackType | undefined,
      status: status as FeedbackStatus | undefined,
      branchId: effectiveBranchId,
      dateFrom: parseOptionalDate(dateFrom),
      dateTo: parseOptionalDate(dateTo),
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
