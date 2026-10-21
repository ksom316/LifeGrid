import type { Sql } from './db.ts'
import { badRequest } from './http.ts'

/**
 * `tasks.project_id`, `notes.project_id`, `focus_sessions.project_id`, and
 * `focus_sessions.task_id` are plain foreign keys — satisfied by *any* row
 * with that id, not just one the authenticated user owns. Left
 * unvalidated, a user could set e.g. a task's `projectId` to another
 * account's project id (guessed or otherwise) and it would insert
 * successfully, since the FK only requires the row to exist somewhere.
 * That doesn't expose the other account's data (every read stays scoped by
 * `user_id` regardless), but it is an unvalidated cross-tenant reference
 * the API shouldn't accept — found in the V1.1 security audit.
 */
export async function assertOwnsProject(sql: Sql, userId: string, projectId: string): Promise<void> {
  const { rows } = await sql.query('select 1 from projects where id = $1 and user_id = $2', [projectId, userId])
  if (rows.length === 0) badRequest('"projectId" does not refer to one of your projects.')
}

export async function assertOwnsTask(sql: Sql, userId: string, taskId: string): Promise<void> {
  const { rows } = await sql.query('select 1 from tasks where id = $1 and user_id = $2', [taskId, userId])
  if (rows.length === 0) badRequest('"taskId" does not refer to one of your tasks.')
}
