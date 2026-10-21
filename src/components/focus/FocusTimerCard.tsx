import { useEffect, useRef, useState } from 'react'
import { useAppData } from '../../state/AppDataContext'
import type { FocusSession, FocusSessionType } from '../../types/domain'
import {
  DEFAULT_DURATIONS,
  SESSION_TYPE_LABEL,
  formatClock,
  hasReachedPlannedDuration,
  isActiveOrPaused,
  plannedDurationMs,
  remainingMs,
  sessionStatus,
  sessionType,
} from '../../utils/focusTimer'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { Field, inputClasses } from '../ui/Field'
import { IconPause, IconPlay, IconStop } from '../ui/icons'

const SESSION_TYPES: FocusSessionType[] = ['focus', 'short-break', 'long-break']

export function FocusTimerCard() {
  const {
    projects,
    tasks,
    focusSessions,
    startFocusSession,
    pauseFocusSession,
    resumeFocusSession,
    completeFocusSession,
    endFocusSessionEarly,
  } = useAppData()

  const activeSession = focusSessions.find(isActiveOrPaused)

  const [durations, setDurations] = useState<Record<FocusSessionType, number>>(DEFAULT_DURATIONS)
  const [selectedType, setSelectedType] = useState<FocusSessionType>('focus')
  const [projectId, setProjectId] = useState('')
  const [taskId, setTaskId] = useState('')
  const [justFinished, setJustFinished] = useState<FocusSession | null>(null)
  const [isEndConfirmOpen, setEndConfirmOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [starting, setStarting] = useState(false)

  const completingRef = useRef(false)
  const prevActiveIdRef = useRef<string | null>(null)

  // Drive the live countdown from persisted timestamps, not a decrementing
  // counter — the interval only triggers a re-render; the remaining time is
  // recomputed fresh from startedAt/accumulatedMs every tick (and on mount),
  // so a refresh or a throttled background tab can never desync the display.
  useEffect(() => {
    if (!activeSession || sessionStatus(activeSession) !== 'active') return

    const checkCompletion = () => {
      setNow(Date.now())
      if (hasReachedPlannedDuration(activeSession) && !completingRef.current) {
        completingRef.current = true
        completeFocusSession(activeSession.id).finally(() => {
          completingRef.current = false
        })
      }
    }

    // Check immediately — covers a session that already ran past its planned
    // duration while the tab was backgrounded/refreshed, without waiting a
    // full tick — then keep checking every second while it runs.
    checkCompletion()
    const interval = setInterval(checkCompletion, 1000)
    return () => clearInterval(interval)
  }, [activeSession?.id, activeSession?.status, activeSession?.resumedAt, completeFocusSession])

  // Detect the active session transitioning to a terminal state so we can
  // show a completion summary instead of silently reverting to the form.
  useEffect(() => {
    const currentId = activeSession?.id ?? null
    if (prevActiveIdRef.current && !currentId) {
      const finished = focusSessions.find((s) => s.id === prevActiveIdRef.current)
      if (finished) setJustFinished(finished)
    }
    prevActiveIdRef.current = currentId
  }, [activeSession?.id, focusSessions])

  const projectTasks = tasks.filter(
    (t) => t.status !== 'done' && (!projectId || t.projectId === projectId),
  )

  const handleStart = async () => {
    if (starting) return
    setStarting(true)
    try {
      setJustFinished(null)
      await startFocusSession({
        type: selectedType,
        plannedDurationMinutes: durations[selectedType],
        projectId: selectedType === 'focus' ? projectId || undefined : undefined,
        taskId: selectedType === 'focus' ? taskId || undefined : undefined,
      })
    } finally {
      setStarting(false)
    }
  }

  if (activeSession) {
    const status = sessionStatus(activeSession)
    const type = sessionType(activeSession)
    const remaining = remainingMs(activeSession, now)
    const total = plannedDurationMs(activeSession)
    const percent = total === 0 ? 0 : Math.min(100, Math.round(((total - remaining) / total) * 100))
    const project = projects.find((p) => p.id === activeSession.projectId)
    const task = tasks.find((t) => t.id === activeSession.taskId)

    return (
      <Card title="Focus timer">
        <div className="flex flex-col items-center gap-4 py-4">
          <Badge tone={type === 'focus' ? 'brand' : 'neutral'}>{SESSION_TYPE_LABEL[type]}</Badge>
          <p
            className="text-5xl font-semibold tabular-nums text-ink"
            role="timer"
            aria-live="polite"
            aria-label={`${status === 'paused' ? 'Paused at' : 'Time remaining'} ${formatClock(remaining)}`}
          >
            {formatClock(remaining)}
          </p>
          {status === 'paused' && <Badge tone="warning">Paused</Badge>}
          <div className="h-2 w-full max-w-xs rounded-full bg-canvas">
            <div
              className="h-2 rounded-full bg-brand transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          {(project || task) && (
            <p className="text-xs text-ink-soft">
              {project && <span>{project.name}</span>}
              {project && task && <span> · </span>}
              {task && <span>{task.title}</span>}
            </p>
          )}
          <div className="flex gap-2">
            {status === 'active' ? (
              <Button
                variant="secondary"
                icon={<IconPause width={16} height={16} />}
                onClick={() => pauseFocusSession(activeSession.id)}
              >
                Pause
              </Button>
            ) : (
              <Button
                variant="primary"
                icon={<IconPlay width={16} height={16} />}
                onClick={() => resumeFocusSession(activeSession.id)}
              >
                Resume
              </Button>
            )}
            <Button
              variant="danger"
              icon={<IconStop width={16} height={16} />}
              onClick={() => setEndConfirmOpen(true)}
            >
              End
            </Button>
          </div>
        </div>

        <ConfirmDialog
          isOpen={isEndConfirmOpen}
          title="End session early"
          message="Ending now will record this as an interrupted session with the time you've focused so far. This can't be undone."
          confirmLabel="End session"
          onCancel={() => setEndConfirmOpen(false)}
          onConfirm={async () => {
            await endFocusSessionEarly(activeSession.id)
            setEndConfirmOpen(false)
          }}
        />
      </Card>
    )
  }

  return (
    <Card title="Focus timer">
      {justFinished && (
        <div
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            sessionStatus(justFinished) === 'completed'
              ? 'border-success-soft bg-success-soft text-success'
              : 'border-warning-soft bg-warning-soft text-warning'
          }`}
        >
          {sessionStatus(justFinished) === 'completed' ? 'Session complete!' : 'Session ended early.'}{' '}
          You focused for {justFinished.durationMinutes} minute
          {justFinished.durationMinutes === 1 ? '' : 's'}.
        </div>
      )}

      <div className="mb-4 flex gap-1 rounded-lg border border-border bg-canvas p-1">
        {SESSION_TYPES.map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setSelectedType(type)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedType === type ? 'bg-surface-raised text-ink shadow-sm ring-1 ring-border-strong' : 'text-ink-soft hover:text-ink'
            }`}
            aria-pressed={selectedType === type}
          >
            {SESSION_TYPE_LABEL[type]}
          </button>
        ))}
      </div>

      <Field label={`${SESSION_TYPE_LABEL[selectedType]} duration (minutes)`}>
        <input
          type="number"
          min={1}
          className={inputClasses}
          value={durations[selectedType]}
          onChange={(e) =>
            setDurations((d) => ({ ...d, [selectedType]: Math.max(1, Number(e.target.value) || 1) }))
          }
        />
      </Field>

      {selectedType === 'focus' && (
        <>
          {projects.length > 0 && (
            <Field label="Project (optional)">
              <select
                className={inputClasses}
                value={projectId}
                onChange={(e) => {
                  setProjectId(e.target.value)
                  setTaskId('')
                }}
              >
                <option value="">No project</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {projectTasks.length > 0 && (
            <Field label="Task (optional)">
              <select
                className={inputClasses}
                value={taskId}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">No task</option>
                {projectTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </>
      )}

      <Button
        variant="primary"
        className="mt-2 w-full"
        icon={<IconPlay width={16} height={16} />}
        onClick={handleStart}
        disabled={starting}
      >
        Start {SESSION_TYPE_LABEL[selectedType].toLowerCase()}
      </Button>
    </Card>
  )
}
