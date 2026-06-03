export type LeadUrgency = 'emergency' | 'same_day' | 'normal' | 'quote'
export type LeadStatus = 'captured' | 'qualifying' | 'qualified' | 'booked' | 'completed' | 'lost'

export type IntakeResult = {
  reply: string
  summary: string
  urgency: LeadUrgency
  issueType: string
  status: LeadStatus
  estimatedValue: number
  missingFields: string[]
}

export const demoCompanyId = '00000000-0000-4000-8000-000000000001'

export function getEnv(name: string) {
  return Netlify.env.get(name) ?? ''
}

export function isDemoMode() {
  return getEnv('SERVICEPILOT_DEMO_MODE') !== 'false'
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    },
  })
}

export function xml(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: {
      'Content-Type': 'text/xml',
    },
  })
}

export async function readBody(req: Request) {
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    return req.json()
  }

  const text = await req.text()
  const params = new URLSearchParams(text)
  return Object.fromEntries(params.entries())
}

export function normalizePhone(phone: string) {
  return phone.replace(/[^\d+]/g, '')
}

export function classifyIntake(body: string): IntakeResult {
  const text = body.toLowerCase()
  const carTrapped = /car|vehicle|truck/.test(text) && /inside|trapped|stuck/.test(text)
  const stuckClosed = /stuck closed|won't open|wont open|will not open|cannot open|can't open|closed/.test(text)
  const brokenSpring = /spring|torsion/.test(text)
  const opener = /opener|remote|motor|sensor/.test(text)
  const emergency = carTrapped || /emergency|urgent|asap|today|now/.test(text)
  const hasAddress = /\d{2,}/.test(text) || /street|st|ave|road|rd|drive|dr|blvd|north york|toronto|vaughan/.test(text)
  const issueType = brokenSpring
    ? 'broken_spring'
    : stuckClosed
      ? 'stuck_closed'
      : opener
        ? 'opener_issue'
        : 'other'
  const urgency: LeadUrgency = emergency ? 'emergency' : /quote|estimate/.test(text) ? 'quote' : 'normal'
  const missingFields = [
    !hasAddress ? 'address or nearest intersection' : '',
    !/morning|afternoon|today|tomorrow|pm|am|\d/.test(text) ? 'preferred service time' : '',
    !/(photo|picture|video|image)/.test(text) ? 'photo if useful' : '',
  ].filter(Boolean)
  const enoughInfo = missingFields.length <= 1 && issueType !== 'other'
  const status: LeadStatus = enoughInfo ? 'qualified' : 'qualifying'
  const estimatedValue = issueType === 'broken_spring' || issueType === 'stuck_closed' ? 475 : opener ? 225 : 185
  const reply = enoughInfo
    ? 'Thanks. I have enough to send this to the owner. If you can, send a photo of the door so the technician can prepare.'
    : `Got it. What is the ${missingFields[0] ?? 'best service address'}?`

  return {
    reply,
    summary: `${issueType.replace('_', ' ')} lead. ${carTrapped ? 'Car appears trapped. ' : ''}${
      emergency ? 'Treat as urgent.' : 'Normal priority.'
    }`,
    urgency,
    issueType,
    status,
    estimatedValue,
    missingFields,
  }
}
