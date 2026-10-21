import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { weeklyReviewsRepo } from './weeklyReviews'
import { createRepository } from './repository'
import type { WeeklyReview } from '../types/domain'

const rawRepo = createRepository<WeeklyReview>('weeklyReviews')

async function clearAllReviews() {
  const reviews = await weeklyReviewsRepo.list()
  await rawRepo.removeMany(reviews.map((r) => r.id))
}

beforeEach(async () => {
  await clearAllReviews()
})

describe('weeklyReviewsRepo', () => {
  it('creates a new review for a week that has none yet', async () => {
    const review = await weeklyReviewsRepo.upsert('2026-01-05', {
      wins: 'Shipped the feature',
      blockers: 'Flaky CI',
      lessons: 'Write tests earlier',
      nextSteps: 'Start the next module',
    })
    expect(review.id).toBe('2026-01-05')
    expect(review.weekStart).toBe('2026-01-05')
    expect(review.wins).toBe('Shipped the feature')
  })

  it('updates the existing review instead of creating a duplicate for the same week', async () => {
    await weeklyReviewsRepo.upsert('2026-01-05', {
      wins: 'First draft',
      blockers: '',
      lessons: '',
      nextSteps: '',
    })
    const updated = await weeklyReviewsRepo.upsert('2026-01-05', {
      wins: 'Revised draft',
      blockers: '',
      lessons: '',
      nextSteps: '',
    })

    const all = await weeklyReviewsRepo.list()
    expect(all).toHaveLength(1)
    expect(all[0].wins).toBe('Revised draft')
    expect(updated.id).toBe('2026-01-05')
  })

  it('keeps createdAt stable across updates but bumps updatedAt', async () => {
    const created = await weeklyReviewsRepo.upsert('2026-01-05', {
      wins: 'a',
      blockers: '',
      lessons: '',
      nextSteps: '',
    })
    const updated = await weeklyReviewsRepo.upsert('2026-01-05', {
      wins: 'b',
      blockers: '',
      lessons: '',
      nextSteps: '',
    })
    expect(updated.createdAt).toBe(created.createdAt)
  })

  it('keeps reviews for different weeks independent, including across a year boundary', async () => {
    await weeklyReviewsRepo.upsert('2025-12-29', {
      wins: 'Year-end wrap-up',
      blockers: '',
      lessons: '',
      nextSteps: '',
    })
    await weeklyReviewsRepo.upsert('2026-01-05', {
      wins: 'New year kickoff',
      blockers: '',
      lessons: '',
      nextSteps: '',
    })

    const all = await weeklyReviewsRepo.list()
    expect(all).toHaveLength(2)
    expect(all.map((r) => r.wins).sort()).toEqual(['New year kickoff', 'Year-end wrap-up'])
  })

  it('trims whitespace from each field', async () => {
    const review = await weeklyReviewsRepo.upsert('2026-01-05', {
      wins: '  padded  ',
      blockers: '',
      lessons: '',
      nextSteps: '',
    })
    expect(review.wins).toBe('padded')
  })
})
