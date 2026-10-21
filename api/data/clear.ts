import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireMethod, withAuth } from '../../server/http.ts'
import { clearAllRealDataForUser } from '../../server/repositories/backup.ts'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['POST'])) return
  await clearAllRealDataForUser(sql, user.id)
  res.status(204).end()
})
