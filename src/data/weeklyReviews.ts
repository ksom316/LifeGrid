import { createRepository, nowISO } from './repository'
import type { WeeklyReview } from '../types/domain'

const repo = createRepository<WeeklyReview>('weeklyReviews')

export interface WeeklyReviewFields {
  wins: string
  blockers: string
  lessons: string
  nextSteps: string
}

export const weeklyReviewsRepo = {
  list: repo.list,
  get: repo.get,

  /** Creates the review for `weekStart` if none exists yet, otherwise updates the existing one in place. */
  async upsert(weekStart: string, fields: WeeklyReviewFields): Promise<WeeklyReview> {
    const existing = await repo.get(weekStart)
    const timestamp = nowISO()
    const review: WeeklyReview = {
      id: weekStart,
      weekStart,
      wins: fields.wins.trim(),
      blockers: fields.blockers.trim(),
      lessons: fields.lessons.trim(),
      nextSteps: fields.nextSteps.trim(),
      createdAt: existing?.createdAt ?? timestamp,
      updatedAt: timestamp,
      isDemo: existing?.isDemo,
    }
    return repo.put(review)
  },
}
