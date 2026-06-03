import type { Config } from '@netlify/functions'
import { getCompanyId, getSupabaseAdmin, recordEvent } from './_shared/db'
import { normalizePhone, readBody, xml } from './_shared/domain'
import { sendSms, voiceForwardResponse } from './_shared/twilio'

function actionUrl(req: Request) {
  const url = new URL(req.url)
  return `${url.origin}/api/twilio/call-status`
}

export default async (req: Request) => {
  if (req.method !== 'POST') return xml('<Response><Say>Call endpoint expects POST.</Say></Response>', 405)

  const body = await readBody(req)
  await recordEvent({
    provider: 'twilio',
    eventType: 'inbound_call',
    payload: body,
  })

  return xml(voiceForwardResponse(actionUrl(req)))
}

export const config: Config = {
  path: '/api/twilio/inbound-call',
  method: 'POST',
}

export async function handleMissedCall(payload: Record<string, unknown>) {
  const from = normalizePhone(String(payload.From ?? ''))
  const callSid = String(payload.CallSid ?? '')
  const dialStatus = String(payload.DialCallStatus ?? payload.CallStatus ?? '')
  const missed = ['no-answer', 'busy', 'failed', 'canceled'].includes(dialStatus)
  if (!from || !missed) return { recovered: false, reason: 'not missed' }

  const companyId = getCompanyId()
  const supabase = getSupabaseAdmin()
  let leadId: string | undefined

  if (supabase) {
    const { data } = await supabase
      .from('leads')
      .insert({
        company_id: companyId,
        customer_phone: from,
        service_type: 'other',
        urgency: 'normal',
        status: 'captured',
        source: 'missed_call',
        call_sid: callSid,
        summary: 'Missed call recovered by SMS. Waiting for customer issue details.',
      })
      .select('id')
      .single()
    leadId = data?.id
  }

  const recoveryMessage =
    "Hi, this is Northline Door & Lock. Sorry we missed your call. Do you need garage door repair, installation, or emergency service?"
  const sms = await sendSms(from, recoveryMessage)

  await recordEvent({
    companyId,
    leadId,
    provider: 'twilio',
    eventType: 'missed_call_recovery',
    payload: { from, callSid, dialStatus, sms },
  })

  return { recovered: true, leadId, sms }
}
