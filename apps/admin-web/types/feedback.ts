export type FeedbackType = 'ORDER' | 'GENERAL';
export type FeedbackStatus = 'NEW' | 'REVIEWED' | 'RESOLVED';

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
  createdAt: string;
  updatedAt: string;
}

export interface AdminFeedbackResponse {
  data: FeedbackRecord[];
  nextCursor: string | null;
}

export interface AdminFeedbackRatingStatsResponse {
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
