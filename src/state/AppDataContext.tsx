import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { clearAllRealData, restoreBackup } from '../data/backup'
import { dailyPlansRepo } from '../data/dailyPlans'
import { clearDemoData, seedDemoData } from '../data/demoData'
import {
  type CreateFocusSessionInput,
  type StartFocusSessionInput,
  focusSessionsRepo,
} from '../data/focusSessions'
import { type CreateNoteInput, notesRepo } from '../data/notes'
import { type CreateProjectInput, projectsRepo } from '../data/projects'
import { type CompleteTaskResult, type CreateTaskInput, tasksRepo } from '../data/tasks'
import { type WeeklyReviewFields, weeklyReviewsRepo } from '../data/weeklyReviews'
import { remoteBackupRepo } from '../data/remote/backup'
import { remoteDailyPlansRepo } from '../data/remote/dailyPlans'
import { remoteFocusSessionsRepo } from '../data/remote/focusSessions'
import { remoteNotesRepo } from '../data/remote/notes'
import { remoteProjectsRepo } from '../data/remote/projects'
import { remoteTasksRepo } from '../data/remote/tasks'
import { remoteWeeklyReviewsRepo } from '../data/remote/weeklyReviews'
import { useAuth } from './AuthContext'
import type { LifeGridBackup, RestoreResult, RestoreStrategy } from '../types/backup'
import type {
  DailyPlan,
  FocusSession,
  Note,
  Project,
  Task,
  WeeklyReview,
} from '../types/domain'

type LoadStatus = 'loading' | 'ready' | 'error'

interface AppDataState {
  status: LoadStatus
  error: string | null
  projects: Project[]
  tasks: Task[]
  notes: Note[]
  focusSessions: FocusSession[]
  dailyPlans: DailyPlan[]
  weeklyReviews: WeeklyReview[]
  hasDemoData: boolean
  isEmpty: boolean
  refresh: () => Promise<void>
  addProject: (input: CreateProjectInput) => Promise<Project>
  updateProject: (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  addTask: (input: CreateTaskInput) => Promise<Task>
  updateTask: (id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>) => Promise<Task>
  deleteTask: (id: string) => Promise<void>
  toggleTaskDone: (id: string) => Promise<void>
  completeTask: (id: string) => Promise<CompleteTaskResult>
  addNote: (input: CreateNoteInput) => Promise<Note>
  updateNote: (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => Promise<Note>
  deleteNote: (id: string) => Promise<void>
  toggleNotePin: (id: string) => Promise<void>
  addFocusSession: (input: CreateFocusSessionInput) => Promise<FocusSession>
  startFocusSession: (input: StartFocusSessionInput) => Promise<FocusSession>
  pauseFocusSession: (id: string) => Promise<void>
  resumeFocusSession: (id: string) => Promise<void>
  completeFocusSession: (id: string) => Promise<void>
  endFocusSessionEarly: (id: string) => Promise<void>
  addDailyPriority: (date: string, taskId: string) => Promise<void>
  removeDailyPriority: (date: string, taskId: string) => Promise<void>
  upsertWeeklyReview: (weekStart: string, fields: WeeklyReviewFields) => Promise<WeeklyReview>
  loadSampleData: () => Promise<void>
  removeSampleData: () => Promise<void>
  restoreFromBackup: (backup: LifeGridBackup, strategy: RestoreStrategy) => Promise<RestoreResult>
  clearRealData: () => Promise<void>
  /** 'hosted' once signed in (every read/write goes through the Neon-backed API); 'local' otherwise (IndexedDB only, as before sign-in existed). */
  dataSource: 'local' | 'hosted'
}

const AppDataContext = createContext<AppDataState | null>(null)

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth()
  const isHosted = authStatus === 'signed-in'
  const dataSource: 'local' | 'hosted' = isHosted ? 'hosted' : 'local'

  // Selecting which backend each entity talks to in one place means every
  // mutation wrapper below stays identical whether the user is signed in or
  // not — "online-first once signed in, local-first otherwise," with no
  // dual-write sync engine and no per-call-site branching.
  const repos = useMemo(
    () => ({
      projects: isHosted ? remoteProjectsRepo : projectsRepo,
      tasks: isHosted ? remoteTasksRepo : tasksRepo,
      notes: isHosted ? remoteNotesRepo : notesRepo,
      focusSessions: isHosted ? remoteFocusSessionsRepo : focusSessionsRepo,
      dailyPlans: isHosted ? remoteDailyPlansRepo : dailyPlansRepo,
      weeklyReviews: isHosted ? remoteWeeklyReviewsRepo : weeklyReviewsRepo,
    }),
    [isHosted],
  )

  const [status, setStatus] = useState<LoadStatus>('loading')
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [focusSessions, setFocusSessions] = useState<FocusSession[]>([])
  const [dailyPlans, setDailyPlans] = useState<DailyPlan[]>([])
  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([])

  const refresh = useCallback(async () => {
    try {
      const [p, t, n, f, dp, wr] = await Promise.all([
        repos.projects.list(),
        repos.tasks.list(),
        repos.notes.list(),
        repos.focusSessions.list(),
        repos.dailyPlans.list(),
        repos.weeklyReviews.list(),
      ])
      setProjects(p)
      setTasks(t)
      setNotes(n)
      setFocusSessions(f)
      setDailyPlans(dp)
      setWeeklyReviews(wr)
      setStatus('ready')
      setError(null)
    } catch (err) {
      console.error('Life Grid: failed to load data', err)
      setError(
        err instanceof Error
          ? err.message
          : 'Something went wrong while loading your data.',
      )
      setStatus('error')
    }
  }, [repos])

  useEffect(() => {
    // Loads immediately with whatever `repos` currently resolves to
    // (local, since sign-in status starts 'checking' and `isHosted` is
    // false until it resolves to 'signed-in') rather than waiting for the
    // auth check to settle first. If the auth check then resolves to
    // 'signed-in', `repos` changes identity and this effect re-runs,
    // replacing the local snapshot with the hosted one — one possible
    // redundant local fetch is a cheap trade for not serializing every
    // page load behind an extra network round trip.
    setStatus('loading')
    refresh()
  }, [refresh])

  const addProject = useCallback(async (input: CreateProjectInput) => {
    const project = await repos.projects.create(input)
    await refresh()
    return project
  }, [repos, refresh])

  const updateProject = useCallback(
    async (id: string, patch: Partial<Omit<Project, 'id' | 'createdAt'>>) => {
      const project = await repos.projects.update(id, patch)
      await refresh()
      return project
    },
    [repos, refresh],
  )

  const deleteProject = useCallback(async (id: string) => {
    await repos.projects.deletePreservingRecords(id)
    await refresh()
  }, [repos, refresh])

  const addTask = useCallback(async (input: CreateTaskInput) => {
    const task = await repos.tasks.create(input)
    await refresh()
    return task
  }, [repos, refresh])

  const updateTask = useCallback(
    async (id: string, patch: Partial<Omit<Task, 'id' | 'createdAt'>>) => {
      const task = await repos.tasks.update(id, patch)
      await refresh()
      return task
    },
    [repos, refresh],
  )

  const deleteTask = useCallback(async (id: string) => {
    await repos.tasks.remove(id)
    await refresh()
  }, [repos, refresh])

  const toggleTaskDone = useCallback(async (id: string) => {
    await repos.tasks.toggleDone(id)
    await refresh()
  }, [repos, refresh])

  const completeTask = useCallback(async (id: string) => {
    const result = await repos.tasks.completeTask(id)
    await refresh()
    return result
  }, [repos, refresh])

  const addNote = useCallback(async (input: CreateNoteInput) => {
    const note = await repos.notes.create(input)
    await refresh()
    return note
  }, [repos, refresh])

  const updateNote = useCallback(
    async (id: string, patch: Partial<Omit<Note, 'id' | 'createdAt'>>) => {
      const note = await repos.notes.update(id, patch)
      await refresh()
      return note
    },
    [repos, refresh],
  )

  const deleteNote = useCallback(async (id: string) => {
    await repos.notes.remove(id)
    await refresh()
  }, [repos, refresh])

  const toggleNotePin = useCallback(async (id: string) => {
    await repos.notes.togglePin(id)
    await refresh()
  }, [repos, refresh])

  const addFocusSession = useCallback(async (input: CreateFocusSessionInput) => {
    const session = await repos.focusSessions.create(input)
    await refresh()
    return session
  }, [repos, refresh])

  const startFocusSession = useCallback(async (input: StartFocusSessionInput) => {
    const session = await repos.focusSessions.start(input)
    await refresh()
    return session
  }, [repos, refresh])

  const pauseFocusSession = useCallback(async (id: string) => {
    await repos.focusSessions.pause(id)
    await refresh()
  }, [repos, refresh])

  const resumeFocusSession = useCallback(async (id: string) => {
    await repos.focusSessions.resume(id)
    await refresh()
  }, [repos, refresh])

  const completeFocusSession = useCallback(async (id: string) => {
    await repos.focusSessions.complete(id)
    await refresh()
  }, [repos, refresh])

  const endFocusSessionEarly = useCallback(async (id: string) => {
    await repos.focusSessions.endEarly(id)
    await refresh()
  }, [repos, refresh])

  const addDailyPriority = useCallback(async (date: string, taskId: string) => {
    await repos.dailyPlans.addTask(date, taskId)
    await refresh()
  }, [repos, refresh])

  const removeDailyPriority = useCallback(async (date: string, taskId: string) => {
    await repos.dailyPlans.removeTask(date, taskId)
    await refresh()
  }, [repos, refresh])

  const upsertWeeklyReview = useCallback(
    async (weekStart: string, fields: WeeklyReviewFields) => {
      const review = await repos.weeklyReviews.upsert(weekStart, fields)
      await refresh()
      return review
    },
    [repos, refresh],
  )

  // Sample/demo data is always a local-only, IndexedDB concept — seeding or
  // clearing it never touches the hosted account, so these two intentionally
  // do NOT go through `repos`. The Settings/Dashboard UI only offers them
  // while in local mode (dataSource === 'local') to avoid a confusing
  // "I loaded sample data but it's not in the account I'm signed into."
  const loadSampleData = useCallback(async () => {
    await seedDemoData()
    await refresh()
  }, [refresh])

  const removeSampleData = useCallback(async () => {
    await clearDemoData()
    await refresh()
  }, [refresh])

  const restoreFromBackup = useCallback(
    async (backup: LifeGridBackup, strategy: RestoreStrategy) => {
      const result = isHosted ? await remoteBackupRepo.restore(backup, strategy) : await restoreBackup(backup, strategy)
      await refresh()
      return result
    },
    [isHosted, refresh],
  )

  const clearRealData = useCallback(async () => {
    if (isHosted) await remoteBackupRepo.clearRealData()
    else await clearAllRealData()
    await refresh()
  }, [isHosted, refresh])

  const hasDemoData = useMemo(
    () => [...projects, ...tasks, ...notes, ...focusSessions].some((r) => r.isDemo),
    [projects, tasks, notes, focusSessions],
  )

  const isEmpty = projects.length === 0 && tasks.length === 0 && notes.length === 0 && focusSessions.length === 0

  const value: AppDataState = {
    status,
    error,
    projects,
    tasks,
    notes,
    focusSessions,
    dailyPlans,
    weeklyReviews,
    hasDemoData,
    isEmpty,
    refresh,
    addProject,
    updateProject,
    deleteProject,
    addTask,
    updateTask,
    deleteTask,
    toggleTaskDone,
    completeTask,
    addNote,
    updateNote,
    deleteNote,
    toggleNotePin,
    addFocusSession,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    completeFocusSession,
    endFocusSessionEarly,
    addDailyPriority,
    removeDailyPriority,
    upsertWeeklyReview,
    loadSampleData,
    removeSampleData,
    restoreFromBackup,
    clearRealData,
    dataSource,
  }

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>
}

export function useAppData(): AppDataState {
  const ctx = useContext(AppDataContext)
  if (!ctx) throw new Error('useAppData must be used within an AppDataProvider')
  return ctx
}
