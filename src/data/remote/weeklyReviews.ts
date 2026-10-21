import { api } from '../../lib/apiClient'
import type { WeeklyReview } from '../../types/domain'
import type { WeeklyReviewFields } from '../weeklyReviews'

export const remoteWeeklyReviewsRepo = {
  async list(): Promise<WeeklyReview[]> {
    return (await api.get<{ weeklyReviews: WeeklyReview[] }>('/api/weekly-reviews')).weeklyReviews
  },
  async upsert(weekStart: string, fields: WeeklyReviewFields): Promise<WeeklyReview> {
    return (await api.put<{ weeklyReview: WeeklyReview }>(`/api/weekly-reviews/${weekStart}`, fields)).weeklyReview
  },
}
