import type { FeedbackType } from '@shared/enums';
import type { FeedbackStatus } from '@shared/enums';

export interface FeedbackRecord {
  id: string;
  userId: string | null;
  orderId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  type: FeedbackType;
  rating: number | null;
  tags: string[];
  message: string | null;
  status: FeedbackStatus;
  adminNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFeedbackInput {
  userId: string | null;
  orderId: string | null;
  type: FeedbackType;
  rating?: number | null;
  tags?: string[];
  message?: string | null;
  status?: FeedbackStatus;
}

export interface AdminFeedbackFilters {
  type?: FeedbackType;
  status?: FeedbackStatus;
  rating?: number;
  dateFrom?: Date;
  dateTo?: Date;
  /** Filter by order's branchId (used for ORDER feedback). */
  branchId?: string;
  limit: number;
  cursor?: string;
}

export interface AdminFeedbackResult {
  data: FeedbackRecord[];
  nextCursor: string | null;
}

export interface AdminFeedbackRatingStatsFilters {
  type?: FeedbackType;
  status?: FeedbackStatus;
  dateFrom?: Date;
  dateTo?: Date;
  branchId?: string;
}

export interface AdminFeedbackRatingStatsResult {
  avgRating: number | null;
  totalRated: number;
  ratingCounts: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
}

export interface FeedbackRepo {
  create(input: CreateFeedbackInput): Promise<FeedbackRecord>;
  getById(id: string): Promise<FeedbackRecord | null>;
  getByOrderId(orderId: string): Promise<FeedbackRecord | null>;
  listAdmin(filters: AdminFeedbackFilters): Promise<AdminFeedbackResult>;
  getRatingStats(filters: AdminFeedbackRatingStatsFilters): Promise<AdminFeedbackRatingStatsResult>;
  updateStatus(id: string, status: FeedbackStatus, adminNotes?: string | null): Promise<FeedbackRecord>;
  listForCustomer(userId: string): Promise<FeedbackRecord[]>;
}
