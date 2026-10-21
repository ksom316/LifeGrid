import type { VercelRequest, VercelResponse } from '@vercel/node'
import { requireMethod, withAuth } from '../../server/http.js'
import { exportBackup } from '../../server/repositories/backup.js'

export default withAuth(async (req: VercelRequest, res: VercelResponse, { sql, user }) => {
  if (!requireMethod(req, res, ['GET'])) return
  const includeDemoData = req.query.includeDemoData === 'true'
  const backup = await exportBackup(sql, user.id, includeDemoData)
  res.status(200).json(backup)
})
