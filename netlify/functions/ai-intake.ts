import type { Config } from '@netlify/functions'
import { classifyIntake, json, readBody } from './_shared/domain'

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return json({})
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const body = await readBody(req)
  const message = String(body.message ?? body.Body ?? '')
  if (!message.trim()) {
    return json({ error: 'message is required' }, 400)
  }

  return json({
    intake: classifyIntake(message),
    model: Netlify.env.get('OPENAI_API_KEY') ? 'openai-ready' : 'deterministic-demo',
  })
}

export const config: Config = {
  path: '/api/ai/intake',
  method: ['POST', 'OPTIONS'],
}
