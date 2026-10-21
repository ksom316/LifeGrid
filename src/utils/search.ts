import type { Note, Project, Task } from '../types/domain'

export type SearchResultType = 'project' | 'task' | 'note'

export interface SearchResult {
  type: SearchResultType
  id: string
  title: string
  snippet?: string
  context: string[]
  isDemo: boolean
  projectId?: string
  score: number
}

interface MatchWeights {
  exact: number
  prefix: number
  phrase: number
  allWords: number
}

const TITLE_WEIGHTS: MatchWeights = { exact: 100, prefix: 80, phrase: 65, allWords: 45 }
const SECONDARY_WEIGHTS: MatchWeights = { exact: 48, prefix: 42, phrase: 36, allWords: 20 }
const TAG_EXACT_SCORE = 70
const COMBINED_FALLBACK_SCORE = 15
const DEMO_PENALTY = 8
const MAX_RESULTS = 40
const SNIPPET_RADIUS = 48

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** Scores a single field against the query using exact > prefix > phrase > all-words-present tiers. */
function scoreField(text: string, query: string, words: string[], weights: MatchWeights): number {
  const normalized = normalize(text)
  if (!normalized || !query) return 0
  if (normalized === query) return weights.exact
  if (normalized.startsWith(query)) return weights.prefix
  if (normalized.includes(query)) return weights.phrase
  if (words.length > 1 && words.every((word) => normalized.includes(word))) return weights.allWords
  return 0
}

/** Builds a short, plain-text snippet centered on the first query-word match. */
function buildSnippet(text: string, words: string[]): string | undefined {
  const trimmed = text.trim().replace(/\s+/g, ' ')
  if (!trimmed) return undefined
  const lower = trimmed.toLowerCase()
  const matchIndex = words.reduce<number>((found, word) => {
    if (found >= 0) return found
    const idx = lower.indexOf(word)
    return idx
  }, -1)

  if (matchIndex < 0) {
    return trimmed.length > SNIPPET_RADIUS * 2 ? `${trimmed.slice(0, SNIPPET_RADIUS * 2)}…` : trimmed
  }

  const start = Math.max(0, matchIndex - SNIPPET_RADIUS)
  const end = Math.min(trimmed.length, matchIndex + SNIPPET_RADIUS)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < trimmed.length ? '…' : ''
  return `${prefix}${trimmed.slice(start, end)}${suffix}`
}

interface SearchContext {
  projects: Project[]
  tasks: Task[]
  notes: Note[]
}

function projectById(projects: Project[], id: string | undefined): Project | undefined {
  return id ? projects.find((p) => p.id === id) : undefined
}

/**
 * Searches projects (name, description), tasks (title, notes — including
 * project context), and notes (title, content, tags — including project
 * context) for the given query. Case-insensitive, whitespace-trimmed,
 * partial-word matches; multiple query words match if every word appears
 * somewhere relevant. Demo-tagged records are never excluded, but rank
 * slightly below equally-relevant real records so they don't dominate.
 */
export function searchAll(data: SearchContext, rawQuery: string): SearchResult[] {
  const query = normalize(rawQuery)
  if (!query) return []
  const words = query.split(' ').filter(Boolean)

  const results: SearchResult[] = []

  for (const project of data.projects) {
    const titleScore = scoreField(project.name, query, words, TITLE_WEIGHTS)
    const descScore = scoreField(project.description, query, words, SECONDARY_WEIGHTS)
    const combined = `${project.name} ${project.description}`
    const fallback =
      titleScore === 0 && descScore === 0 && words.length > 1 && words.every((w) => normalize(combined).includes(w))
        ? COMBINED_FALLBACK_SCORE
        : 0
    let score = Math.max(titleScore, descScore, fallback)
    if (score === 0) continue
    if (project.isDemo) score -= DEMO_PENALTY

    results.push({
      type: 'project',
      id: project.id,
      title: project.name,
      snippet: titleScore === 0 && descScore > 0 ? buildSnippet(project.description, words) : undefined,
      context: [project.status],
      isDemo: Boolean(project.isDemo),
      score,
    })
  }

  for (const task of data.tasks) {
    const project = projectById(data.projects, task.projectId)
    const titleScore = scoreField(task.title, query, words, TITLE_WEIGHTS)
    const notesScore = scoreField(task.notes, query, words, SECONDARY_WEIGHTS)
    const combined = `${task.title} ${task.notes} ${project?.name ?? ''}`
    const fallback =
      titleScore === 0 && notesScore === 0 && words.length > 1 && words.every((w) => normalize(combined).includes(w))
        ? COMBINED_FALLBACK_SCORE
        : 0
    let score = Math.max(titleScore, notesScore, fallback)
    if (score === 0) continue
    if (task.isDemo) score -= DEMO_PENALTY

    const context: string[] = [task.status, task.priority]
    if (project) context.push(project.name)

    results.push({
      type: 'task',
      id: task.id,
      title: task.title,
      snippet: titleScore === 0 && notesScore > 0 ? buildSnippet(task.notes, words) : undefined,
      context,
      isDemo: Boolean(task.isDemo),
      projectId: task.projectId,
      score,
    })
  }

  for (const note of data.notes) {
    const project = projectById(data.projects, note.projectId)
    const titleScore = scoreField(note.title, query, words, TITLE_WEIGHTS)
    const contentScore = scoreField(note.content, query, words, SECONDARY_WEIGHTS)
    const tagExact = note.tags.some((tag) => normalize(tag) === query) ? TAG_EXACT_SCORE : 0
    const combined = `${note.title} ${note.content} ${note.tags.join(' ')} ${project?.name ?? ''}`
    const fallback =
      titleScore === 0 && contentScore === 0 && tagExact === 0 && words.length > 1 &&
      words.every((w) => normalize(combined).includes(w))
        ? COMBINED_FALLBACK_SCORE
        : 0
    let score = Math.max(titleScore, contentScore, tagExact, fallback)
    if (score === 0) continue
    if (note.isDemo) score -= DEMO_PENALTY

    const context = [...note.tags]
    if (project) context.push(project.name)

    results.push({
      type: 'note',
      id: note.id,
      title: note.title,
      snippet: titleScore === 0 && contentScore > 0 ? buildSnippet(note.content, words) : undefined,
      context,
      isDemo: Boolean(note.isDemo),
      projectId: note.projectId,
      score,
    })
  }

  return results
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, MAX_RESULTS)
}
