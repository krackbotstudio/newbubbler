import { Inject, Injectable } from '@nestjs/common';
import { FeedbackType } from '@shared/enums';
import { createGeneralFeedback } from '../../application/feedback/create-general-feedback.use-case';
import { listCustomerFeedback } from '../../application/feedback/list-customer-feedback.use-case';
import { adminListFeedback } from '../../application/feedback/admin-list-feedback.use-case';
import { adminUpdateFeedbackStatus } from '../../application/feedback/admin-update-feedback-status.use-case';
import { adminFeedbackRatingStats } from '../../application/feedback/admin-feedback-rating-stats.use-case';
import type { FeedbackRepo, AdminFeedbackFilters, FeedbackRecord } from '../../application/ports';
import type { FeedbackStatus } from '@shared/enums';
import { FEEDBACK_REPO } from '../../infra/infra.module';
import type { AuthUser } from '../common/roles.guard';
import type { AdminFeedbackRatingStatsFilters, AdminFeedbackRatingStatsResult } from '../../application/ports';

@Injectable()
export class FeedbackService {
  constructor(
    @Inject(FEEDBACK_REPO) private readonly feedbackRepo: FeedbackRepo,
  ) {}

  async createAreaRequest(body: {
    pincode: string;
    addressLine: string;
    customerName?: string;
    customerPhone?: string;
    customerEmail?: string;
  }): Promise<FeedbackRecord> {
    const message = JSON.stringify({
      pincode: body.pincode,
      addressLine: body.addressLine,
      customerName: body.customerName ?? null,
      customerPhone: body.customerPhone ?? null,
      customerEmail: body.customerEmail ?? null,
    });
    return this.feedbackRepo.create({
      userId: null,
      orderId: null,
      type: FeedbackType.GENERAL,
      tags: ['area_request'],
      message,
    });
  }

  async createGeneral(user: AuthUser, body: { rating?: number; tags?: string[]; message?: string }) {
    return createGeneralFeedback(
      {
        userId: user.id,
        rating: body.rating,
        tags: body.tags,
        message: body.message,
      },
      { feedbackRepo: this.feedbackRepo },
    );
  }

  async listForCustomer(user: AuthUser) {
    return listCustomerFeedback(user.id, { feedbackRepo: this.feedbackRepo });
  }

  async adminList(filters: AdminFeedbackFilters) {
    return adminListFeedback(filters, { feedbackRepo: this.feedbackRepo });
  }

  async adminRatingStats(filters: AdminFeedbackRatingStatsFilters): Promise<AdminFeedbackRatingStatsResult> {
    return adminFeedbackRatingStats(filters, { feedbackRepo: this.feedbackRepo });
  }

  async adminUpdateStatus(id: string, status: FeedbackStatus, adminNotes?: string | null) {
    return adminUpdateFeedbackStatus(id, status, adminNotes, {
      feedbackRepo: this.feedbackRepo,
    });
  }
}
