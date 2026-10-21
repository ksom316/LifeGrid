import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthedContext } from '../http.js'
import { notFound, readJsonBody, requireMethod } from '../http.js'
import { asRecord, optionalBoolean, optionalString, optionalStringArray, optionalUuid, requireString } from '../validation.js'
import { createNote, getNote, listNotes, removeNote, updateNote } from '../repositories/notes.js'

/** Bodies moved verbatim out of the former api/notes/{index,[id]}.ts. */

export async function handleNotesIndex(req: VercelRequest, res: VercelResponse, { sql, user }: AuthedContext): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'POST'])) return

  if (req.method === 'GET') {
    res.status(200).json({ notes: await listNotes(sql, user.id) })
    return
  }

  const body = asRecord(readJsonBody(req), 'Request body')
  const note = await createNote(sql, user.id, {
    id: optionalUuid(body.id, 'id'),
    title: requireString(body.title, 'title', { maxLength: 300 }),
    content: optionalString(body.content, 'content', { maxLength: 200_000 }),
    tags: optionalStringArray(body.tags, 'tags'),
    projectId: optionalUuid(body.projectId, 'projectId'),
    pinned: optionalBoolean(body.pinned, 'pinned'),
  })
  res.status(201).json({ note })
}

export async function handleNoteById(
  req: VercelRequest,
  res: VercelResponse,
  { sql, user }: AuthedContext,
  id: string,
): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'PATCH', 'DELETE'])) return

  if (req.method === 'GET') {
    const note = await getNote(sql, user.id, id)
    if (!note) return notFound('Note not found.')
    res.status(200).json({ note })
    return
  }

  if (req.method === 'DELETE') {
    await removeNote(sql, user.id, id)
    res.status(204).end()
    return
  }

  const body = asRecord(readJsonBody(req), 'Request body')
  const note = await updateNote(sql, user.id, id, {
    title: optionalString(body.title, 'title', { maxLength: 300 }),
    content: optionalString(body.content, 'content', { maxLength: 200_000 }),
    tags: optionalStringArray(body.tags, 'tags'),
    projectId: body.projectId === null ? null : optionalUuid(body.projectId, 'projectId'),
    pinned: optionalBoolean(body.pinned, 'pinned'),
  })
  res.status(200).json({ note })
}
