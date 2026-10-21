import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readJsonBody, requireMethod, withAuth } from '../../server/http.js'
import { asRecord, optionalBoolean, optionalString, optionalStringArray, optionalUuid, requireString } from '../../server/validation.js'
import { createNote, listNotes } from '../../server/repositories/notes.js'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
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
})
