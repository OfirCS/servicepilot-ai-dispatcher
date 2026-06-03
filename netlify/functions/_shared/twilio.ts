import twilio from 'twilio'
import { getEnv, isDemoMode } from './domain'

export type SmsResult = {
  ok: boolean
  demo: boolean
  sid?: string
  to: string
  body: string
  error?: string
}

export async function sendSms(to: string, body: string): Promise<SmsResult> {
  const accountSid = getEnv('TWILIO_ACCOUNT_SID')
  const authToken = getEnv('TWILIO_AUTH_TOKEN')
  const messagingServiceSid = getEnv('TWILIO_MESSAGING_SERVICE_SID')
  const from = getEnv('TWILIO_FROM_NUMBER')

  if (isDemoMode() || !accountSid || !authToken || (!messagingServiceSid && !from)) {
    console.log('[demo sms]', { to, body })
    return { ok: true, demo: true, sid: `DEMO_${Date.now()}`, to, body }
  }

  try {
    const client = twilio(accountSid, authToken)
    const message = await client.messages.create({
      to,
      body,
      ...(messagingServiceSid ? { messagingServiceSid } : { from }),
    })
    return { ok: true, demo: false, sid: message.sid, to, body }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown Twilio error'
    console.error('Twilio send failed', message)
    return { ok: false, demo: false, to, body, error: message }
  }
}

export function messagingResponse(message: string) {
  const response = new twilio.twiml.MessagingResponse()
  response.message(message)
  return response.toString()
}

export function voiceForwardResponse(actionUrl: string) {
  const ownerPhone = getEnv('FORWARD_TO_NUMBER') || getEnv('OWNER_PHONE_NUMBER')
  const response = new twilio.twiml.VoiceResponse()
  const dial = response.dial({
    action: actionUrl,
    method: 'POST',
    timeout: 18,
  })
  if (ownerPhone) {
    dial.number(ownerPhone)
  } else {
    response.say('The business is currently unavailable. Please send a text message and we will respond shortly.')
  }
  return response.toString()
}
