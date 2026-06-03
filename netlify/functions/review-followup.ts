import type { Config } from '@netlify/functions'
import { getSupabaseAdmin } from './_shared/db'
import { json, readBody } from './_shared/domain'
import { sendSms } from './_shared/twilio'

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return json({})
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const body = await readBody(req)
  const leadId = String(body.leadId ?? '')
  const customerPhone = String(body.customerPhone ?? '')
  const customerName = String(body.customerName ?? 'there')
  const reviewLink = String(body.reviewLink ?? 'https://g.page/r/demo-review-link')

  if (!customerPhone) return json({ error: 'customerPhone is required' }, 400)

  const message = `Hi ${customerName}, thanks for choosing Northline Door & Lock. If you were happy with the service, could you leave us a quick Google review? ${reviewLink}`
  const sms = await sendSms(customerPhone, message)
  const supabase = getSupabaseAdmin()

  if (supabase && leadId) {
    await supabase.from('followups').insert({
      lead_id: leadId,
      type: 'review_request',
      scheduled_for: new Date().toISOString(),
      sent_at: new Date().toISOString(),
      status: sms.ok ? 'sent' : 'failed',
    })
  }

  return json({ sms, message })
}

export const config: Config = {
  path: '/api/followups/review',
  method: ['POST', 'OPTIONS'],
}
