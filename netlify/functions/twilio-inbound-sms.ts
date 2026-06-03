import type { Config } from '@netlify/functions'
import { getCompanyId, getSupabaseAdmin, recordEvent } from './_shared/db'
import { classifyIntake, normalizePhone, readBody, xml } from './_shared/domain'
import { messagingResponse, sendSms } from './_shared/twilio'

export default async (req: Request) => {
  if (req.method !== 'POST') return xml(messagingResponse('SMS endpoint expects POST.'), 405)

  const body = await readBody(req)
  const from = normalizePhone(String(body.From ?? body.customerPhone ?? ''))
  const message = String(body.Body ?? body.message ?? '')
  const companyId = getCompanyId()
  const intake = classifyIntake(message)
  const supabase = getSupabaseAdmin()
  let leadId: string | undefined

  if (supabase) {
    const { data: existing } = await supabase
      .from('leads')
      .select('id')
      .eq('company_id', companyId)
      .eq('customer_phone', from)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (existing?.id) {
      leadId = existing.id
      await supabase
        .from('leads')
        .update({
          service_type: intake.issueType,
          urgency: intake.urgency,
          status: intake.status,
          estimated_value: intake.estimatedValue,
          summary: intake.summary,
        })
        .eq('id', existing.id)
    } else {
      const { data } = await supabase
        .from('leads')
        .insert({
          company_id: companyId,
          customer_phone: from,
          service_type: intake.issueType,
          urgency: intake.urgency,
          status: intake.status,
          source: 'inbound_sms',
          estimated_value: intake.estimatedValue,
          summary: intake.summary,
        })
        .select('id')
        .single()
      leadId = data?.id
    }

    await supabase.from('messages').insert([
      {
        lead_id: leadId,
        company_id: companyId,
        direction: 'inbound',
        channel: 'sms',
        body: message,
        provider_message_id: body.MessageSid ?? null,
      },
      {
        lead_id: leadId,
        company_id: companyId,
        direction: 'outbound',
        channel: 'sms',
        body: intake.reply,
      },
    ])
  }

  await recordEvent({
    companyId,
    leadId,
    provider: 'twilio',
    eventType: 'inbound_sms',
    payload: { from, message, intake },
  })

  if (intake.status === 'qualified') {
    const ownerPhone = Netlify.env.get('OWNER_PHONE_NUMBER')
    if (ownerPhone) {
      await sendSms(ownerPhone, `New qualified garage door lead: ${intake.summary} Customer: ${from}`)
    }
  }

  return xml(messagingResponse(intake.reply))
}

export const config: Config = {
  path: '/api/twilio/inbound-sms',
  method: 'POST',
}
