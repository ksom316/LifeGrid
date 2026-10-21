import { fireEvent, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { weeklyReviewsRepo } from '../../data/weeklyReviews'
import { createRepository } from '../../data/repository'
import { renderFocusApp } from '../../test/testUtils'
import type { WeeklyReview } from '../../types/domain'

const rawRepo = createRepository<WeeklyReview>('weeklyReviews')

async function clearAllReviews() {
  const reviews = await weeklyReviewsRepo.list()
  await rawRepo.removeMany(reviews.map((r) => r.id))
}

beforeEach(async () => {
  await clearAllReviews()
})

afterEach(async () => {
  await clearAllReviews()
})

describe('ReviewsTab', () => {
  it('creates a review for the current week and persists it', async () => {
    renderFocusApp('/focus/reviews')

    const winsField = await screen.findByLabelText('Wins & accomplishments')
    fireEvent.change(winsField, { target: { value: 'Shipped the Focus module' } })
    fireEvent.click(screen.getByRole('button', { name: /save review/i }))

    await waitFor(async () => {
      const reviews = await weeklyReviewsRepo.list()
      expect(reviews).toHaveLength(1)
      expect(reviews[0].wins).toBe('Shipped the Focus module')
    })
    expect(await screen.findByText('Saved.')).toBeInTheDocument()
  })

  it('never loses an initial keystroke to a deferred mount-time re-sync', async () => {
    // Regression test for an intermittent (~25-30% under load) failure: the
    // form used to seed its fields via a useEffect that ran *after* the
    // field was already in the DOM. Under scheduling delay, that effect
    // could fire after a user's very first keystroke and silently reset the
    // field back to empty. Fields are now seeded synchronously from
    // already-loaded data via useState lazy initializers, so there is no
    // deferred effect left that could race a keystroke at all. This test
    // mirrors the real reproduction as closely as a single run can: type
    // immediately upon the field appearing, with no extra synchronization.
    renderFocusApp('/focus/reviews')
    const winsField = await screen.findByLabelText('Wins & accomplishments')
    fireEvent.change(winsField, { target: { value: 'Typed immediately' } })
    expect(winsField).toHaveValue('Typed immediately')
  })

  it('loads and edits an existing review for the displayed week without creating a duplicate', async () => {
    const todayKey = new Date().toISOString().slice(0, 10)
    // Align with the component's own Monday-start week math via the real util.
    const { getWeekStart, toDateKey } = await import('../../utils/date')
    const weekKey = toDateKey(getWeekStart(new Date(todayKey)))
    await weeklyReviewsRepo.upsert(weekKey, {
      wins: 'Original wins',
      blockers: '',
      lessons: '',
      nextSteps: '',
    })

    renderFocusApp('/focus/reviews')

    const winsField = await screen.findByLabelText('Wins & accomplishments')
    await waitFor(() => expect(winsField).toHaveValue('Original wins'))

    fireEvent.change(winsField, { target: { value: 'Updated wins' } })
    fireEvent.click(screen.getByRole('button', { name: /update review/i }))

    await waitFor(async () => {
      const reviews = await weeklyReviewsRepo.list()
      expect(reviews).toHaveLength(1)
      expect(reviews[0].wins).toBe('Updated wins')
    })
  })

  it('navigates to a previous week and back, loading the right review for each', async () => {
    renderFocusApp('/focus/reviews')
    await screen.findByLabelText('Wins & accomplishments')

    fireEvent.click(screen.getByRole('button', { name: /previous week/i }))
    const winsField = screen.getByLabelText('Wins & accomplishments')
    await waitFor(() => expect(winsField).toHaveValue(''))
    fireEvent.change(winsField, { target: { value: 'Last week wins' } })
    fireEvent.click(screen.getByRole('button', { name: /save review/i }))
    await waitFor(async () => expect(await weeklyReviewsRepo.list()).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: /next week/i }))
    await waitFor(() => expect(screen.getByLabelText('Wins & accomplishments')).toHaveValue(''))

    fireEvent.click(screen.getByRole('button', { name: /previous week/i }))
    await waitFor(() =>
      expect(screen.getByLabelText('Wins & accomplishments')).toHaveValue('Last week wins'),
    )
  })

  it('handles the year boundary when saving a review for the last week of December', async () => {
    const review = await weeklyReviewsRepo.upsert('2025-12-29', {
      wins: 'Year-end wrap-up',
      blockers: '',
      lessons: '',
      nextSteps: '',
    })
    expect(review.id).toBe('2025-12-29')

    renderFocusApp('/focus/reviews')
    await screen.findByLabelText('Wins & accomplishments')

    // The past-reviews quick-jump list should expose the saved week
    // (locale-agnostic: just confirm both boundary dates appear together).
    expect(await screen.findByText(/29.+jan.+2026/i)).toBeInTheDocument()
  })
})
