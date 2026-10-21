export type ID = string

export interface BaseRecord {
  id: ID
  createdAt: string
  updatedAt: string
  /** Marks a record as sample data so it can be identified and removed safely. */
  isDemo?: boolean
}

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived'
export type ProjectPriority = 'low' | 'medium' | 'high'

export interface Project extends BaseRecord {
  name: string
  description: string
  status: ProjectStatus
  /** Optional for records created before priority existed; treat missing as 'medium'. */
  priority?: ProjectPriority
  startDate?: string
  targetDate?: string
  color: ProjectColor
}

export type ProjectColor = 'violet' | 'teal' | 'amber' | 'rose' | 'slate'

export type TaskStatus = 'todo' | 'in-progress' | 'done'
export type TaskPriority = 'low' | 'medium' | 'high'

export type RecurrenceFrequency = 'daily' | 'weekly' | 'monthly'

/**
 * Recurrence rule for a task. Lives on the task record itself (not a
 * separate "series" entity) — each occurrence is its own independent Task,
 * and a new occurrence inherits whatever rule was in effect on the task it
 * was generated from. This gives "edit future occurrences" behavior for
 * free: editing the rule on the still-open occurrence changes what the
 * *next* occurrence will look like when this one is completed, while
 * already-completed occurrences keep the rule that was in effect when they
 * were created and are never retroactively touched.
 */
export interface TaskRecurrence {
  frequency: RecurrenceFrequency
  /** 'weekly' only: which weekdays (0=Sun..6=Sat) it recurs on. Falls back to the original due date's weekday if empty. */
  weekdays?: number[]
  /** 'monthly' only: day of month (1-31) it recurs on. Clamped to the last day of shorter months. */
  dayOfMonth?: number
  /** Optional local "YYYY-MM-DD"; no further occurrences are generated once the next date would fall after this. */
  endDate?: string
}

export interface Task extends BaseRecord {
  title: string
  notes: string
  projectId?: ID
  status: TaskStatus
  priority: TaskPriority
  dueDate?: string
  completedAt?: string
  /** Optional for records created before recurrence existed. Presence marks this task as part of a recurring series. */
  recurrence?: TaskRecurrence
  /** Links a generated occurrence back to the task it was produced from. Absent for non-recurring tasks and the first occurrence of a series. */
  recurrenceParentId?: ID
  /** Optional reminder timestamp (full ISO datetime, not date-only) for this specific occurrence. */
  reminderAt?: string
}

export interface Note extends BaseRecord {
  title: string
  content: string
  tags: string[]
  projectId?: ID
  /** Optional for records created before pinning existed; treat missing as false. */
  pinned?: boolean
}

export type FocusSessionType = 'focus' | 'short-break' | 'long-break'
export type FocusSessionStatus = 'active' | 'paused' | 'completed' | 'interrupted'

export interface FocusSession extends BaseRecord {
  startedAt: string
  endedAt?: string
  /** Actual elapsed minutes. 0 while the session is still active/paused; finalized on completion. */
  durationMinutes: number
  taskId?: ID
  projectId?: ID
  note: string
  /** Optional for records created before session typing existed; treat missing as 'focus'. */
  type?: FocusSessionType
  /** Optional for records created before status tracking existed; treat missing as 'completed' (legacy manually-logged sessions were already finished). */
  status?: FocusSessionStatus
  /** The configured target duration in minutes. Falls back to durationMinutes for legacy records. */
  plannedDurationMinutes?: number
  /** Timer bookkeeping: total milliseconds accumulated from completed active segments. Only meaningful while status is 'active' or 'paused'. */
  accumulatedMs?: number
  /** Timer bookkeeping: ISO timestamp of the most recent resume. Only set while status === 'active'. */
  resumedAt?: string
}

/**
 * One record per local calendar day (id === "YYYY-MM-DD"), holding the task
 * ids the user picked as that day's priorities. A new day gets a fresh,
 * empty list automatically since it's looked up by that day's own key —
 * nothing needs to be reset or rolled over, and a refresh on the same day
 * keeps the same selections because they're read back by the same key.
 */
export interface DailyPlan extends BaseRecord {
  taskIds: ID[]
}

/**
 * One record per local week (id === the Monday date key "YYYY-MM-DD" that
 * starts the reviewed week). Weeks are simple contiguous 7-day buckets
 * anchored on Monday, so year boundaries fall out naturally without needing
 * ISO week-number arithmetic. Saving a review for a week that already has
 * one updates it in place instead of creating a duplicate.
 */
export interface WeeklyReview extends BaseRecord {
  weekStart: string
  wins: string
  blockers: string
  lessons: string
  nextSteps: string
}
