import type { VercelRequest, VercelResponse } from '@vercel/node'
import { notFound, readJsonBody, requireMethod, withAuth } from '../../server/http.js'
import { asRecord, optionalBoolean, optionalString, optionalStringArray, optionalUuid } from '../../server/validation.js'
import { getNote, removeNote, updateNote } from '../../server/repositories/notes.js'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET', 'PATCH', 'DELETE'])) return
  const id = req.query.id
  if (typeof id !== 'string') return notFound('Note not found.')

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
})
