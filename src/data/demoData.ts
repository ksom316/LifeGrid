import { focusSessionsRepo } from './focusSessions'
import { notesRepo } from './notes'
import { projectsRepo } from './projects'
import { tasksRepo } from './tasks'

/**
 * Creates a small set of sample records so a first-time user can see the
 * app populated. Every record is tagged isDemo so it can be identified and
 * removed without touching real user data.
 */
export async function seedDemoData(): Promise<void> {
  const project = await projectsRepo.create({
    name: 'Life Grid Launch',
    description: 'Ship the V1 foundation: shell, dashboard, and data layer.',
    status: 'active',
    color: 'violet',
    isDemo: true,
  })

  await tasksRepo.create({
    title: 'Sketch the dashboard layout',
    status: 'done',
    priority: 'medium',
    projectId: project.id,
    isDemo: true,
  })
  await tasksRepo.create({
    title: 'Wire up the IndexedDB repository layer',
    status: 'in-progress',
    priority: 'high',
    projectId: project.id,
    dueDate: new Date().toISOString().slice(0, 10),
    isDemo: true,
  })
  await tasksRepo.create({
    title: 'Plan the Knowledge Vault module',
    status: 'todo',
    priority: 'low',
    dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 5).toISOString().slice(0, 10),
    isDemo: true,
  })

  await notesRepo.create({
    title: 'Design principles for Life Grid',
    content: 'Calm, restrained colour. Clear hierarchy. No decorative noise.',
    tags: ['design'],
    projectId: project.id,
    isDemo: true,
  })

  await focusSessionsRepo.create({
    durationMinutes: 50,
    projectId: project.id,
    note: 'Deep work on the dashboard shell',
    isDemo: true,
  })
}

export async function clearDemoData(): Promise<void> {
  const [projects, tasks, notes, sessions] = await Promise.all([
    projectsRepo.list(),
    tasksRepo.list(),
    notesRepo.list(),
    focusSessionsRepo.list(),
  ])

  await Promise.all([
    projectsRepo.removeMany(projects.filter((p) => p.isDemo).map((p) => p.id)),
    tasksRepo.removeMany(tasks.filter((t) => t.isDemo).map((t) => t.id)),
    notesRepo.removeMany(notes.filter((n) => n.isDemo).map((n) => n.id)),
    focusSessionsRepo.removeMany(sessions.filter((s) => s.isDemo).map((s) => s.id)),
  ])
}
