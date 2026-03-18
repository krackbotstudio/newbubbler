import type {
  FeedbackRepo,
  AdminFeedbackRatingStatsFilters,
  AdminFeedbackRatingStatsResult,
} from '../ports';

export interface AdminFeedbackRatingStatsDeps {
  feedbackRepo: FeedbackRepo;
}

export async function adminFeedbackRatingStats(
  filters: AdminFeedbackRatingStatsFilters,
  deps: AdminFeedbackRatingStatsDeps,
): Promise<AdminFeedbackRatingStatsResult> {
  return deps.feedbackRepo.getRatingStats(filters);
}

