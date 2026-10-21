import { screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import 'fake-indexeddb/auto'
import { dailyPlansRepo } from '../data/dailyPlans'
import { focusSessionsRepo } from '../data/focusSessions'
import { notesRepo } from '../data/notes'
import { projectsRepo } from '../data/projects'
import { tasksRepo } from '../data/tasks'
import { weeklyReviewsRepo } from '../data/weeklyReviews'
import { createRepository } from '../data/repository'
import { renderShellApp } from '../test/testUtils'
import type { DailyPlan, WeeklyReview } from '../types/domain'

const dailyPlanRawRepo = createRepository<DailyPlan>('dailyPlans')
const weeklyReviewRawRepo = createRepository<WeeklyReview>('weeklyReviews')

async function clearAllRecords() {
  const [projects, tasks, notes, sessions, plans, reviews] = await Promise.all([
    projectsRepo.list(),
    tasksRepo.list(),
    notesRepo.list(),
    focusSessionsRepo.list(),
    dailyPlansRepo.list(),
    weeklyReviewsRepo.list(),
  ])
  await Promise.all([
    projectsRepo.removeMany(projects.map((p) => p.id)),
    tasksRepo.removeMany(tasks.map((t) => t.id)),
    notesRepo.removeMany(notes.map((n) => n.id)),
    focusSessionsRepo.removeMany(sessions.map((s) => s.id)),
    dailyPlanRawRepo.removeMany(plans.map((p) => p.id)),
    weeklyReviewRawRepo.removeMany(reviews.map((r) => r.id)),
  ])
}

beforeEach(async () => {
  await clearAllRecords()
})

describe('DashboardPage — priorities and deadlines navigation', () => {
  it('links a high-priority task to its project and highlights it on arrival', async () => {
    const project = await projectsRepo.create({ name: 'Garden' })
    const task = await tasksRepo.create({ title: 'Prune the roses', projectId: project.id, priority: 'high' })

    renderShellApp('/')

    const link = await screen.findByRole('link', { name: 'Prune the roses' })
    expect(link).toHaveAttribute('href', `/projects/${project.id}?task=${task.id}`)
  })

  it('renders a priority task with no project as plain text rather than a dead link', async () => {
    await tasksRepo.create({ title: 'Freestanding priority', priority: 'high' })

    renderShellApp('/')

    expect(await screen.findByText('Freestanding priority')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Freestanding priority' })).not.toBeInTheDocument()
  })

  it('links an upcoming deadline to its project', async () => {
    const project = await projectsRepo.create({ name: 'Taxes' })
    const task = await tasksRepo.create({ title: 'File quarterly estimate', projectId: project.id, dueDate: '2099-01-01' })

    renderShellApp('/')

    const link = await screen.findByRole('link', { name: 'File quarterly estimate' })
    expect(link).toHaveAttribute('href', `/projects/${project.id}?task=${task.id}`)
  })

  it('links each project in Active projects to its own detail page', async () => {
    const garden = await projectsRepo.create({ name: 'Garden' })
    const taxes = await projectsRepo.create({ name: 'Taxes' })

    renderShellApp('/')

    const gardenLink = await screen.findByRole('link', { name: /Garden/ })
    const taxesLink = await screen.findByRole('link', { name: /Taxes/ })
    expect(gardenLink).toHaveAttribute('href', `/projects/${garden.id}`)
    expect(taxesLink).toHaveAttribute('href', `/projects/${taxes.id}`)
  })
})
