import type { VercelRequest, VercelResponse } from '@vercel/node'
import type { AuthedContext } from '../http.js'
import { asRecord, requireEnum, requireString } from '../validation.js'
import { requireMethod, readJsonBody } from '../http.js'
import { listTagColors, removeTagColor, setTagColor } from '../repositories/tagColors.js'
import { PALETTE_COLORS } from '../../src/utils/colors.js'

export async function handleTagColors(req: VercelRequest, res: VercelResponse, { sql, user }: AuthedContext): Promise<void> {
  if (!requireMethod(req, res, ['GET', 'PUT', 'DELETE'])) return

  if (req.method === 'GET') {
    res.status(200).json({ tagColors: await listTagColors(sql, user.id) })
    return
  }

  const body = asRecord(readJsonBody(req), 'Request body')
  const tag = requireString(body.tag, 'tag', { maxLength: 100 }).toLowerCase()

  if (req.method === 'PUT') {
    const color = requireEnum(body.color, 'color', PALETTE_COLORS)
    res.status(200).json({ tagColor: await setTagColor(sql, user.id, tag, color) })
    return
  }

  await removeTagColor(sql, user.id, tag)
  res.status(204).end()
}
