import type { Config } from '@netlify/functions'
import { json, readBody } from './_shared/domain'
import { handleMissedCall } from './twilio-inbound-call'

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return json({})
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const payload = await readBody(req)
  const result = await handleMissedCall(payload)
  return json(result)
}

export const config: Config = {
  path: '/api/twilio/call-status',
  method: ['POST', 'OPTIONS'],
}
