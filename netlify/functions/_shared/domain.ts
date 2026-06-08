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

type JobKind =
  | 'car_lockout'
  | 'house_lockout'
  | 'rekey'
  | 'lock_change'
  | 'car_key'
  | 'commercial'
  | 'safe'
  | 'other'

const jobLabels: Record<JobKind, string> = {
  car_lockout: 'Car lockout',
  house_lockout: 'House lockout',
  rekey: 'Rekey',
  lock_change: 'Lock change',
  car_key: 'Car key / fob',
  commercial: 'Commercial lock work',
  safe: 'Safe',
  other: 'Locksmith job',
}

const estimates: Record<JobKind, number> = {
  car_lockout: 89,
  house_lockout: 135,
  rekey: 180,
  lock_change: 240,
  car_key: 260,
  commercial: 600,
  safe: 220,
  other: 95,
}

// Deterministic locksmith intake classifier. Reads a customer's plain-English
// message and decides the job kind, urgency, and the one field still missing.
export function classifyIntake(body: string): IntakeResult {
  const text = body.toLowerCase()

  const lockedOut = /lock(ed)?\s?out|locked myself out|keys?\s+(are\s+)?(locked\s+)?(in|inside)|can'?t get (in|into)|shut out|stuck outside/.test(
    text,
  )
  const carContext = /\bcar\b|vehicle|truck|\bvan\b|\bsuv\b|trunk|ignition|honda|toyota|ford|sedan/.test(text)
  const houseContext = /house|home|apartment|condo|front door|back door|my place|my door/.test(text)
  const carKey = /car key|key fob|\bfob\b|transponder|spare key|lost (my |the )?keys?|program(ming)?|smart key|push.?to.?start|cut a key/.test(
    text,
  )
  const rekey = /re-?key/.test(text)
  const lockChange = /change (the )?locks?|new locks?|install (a )?lock|replace (the )?lock|broken lock|lock is broken|deadbolt|door knob/.test(
    text,
  )
  const commercial = /office|store|business|commercial|tenant|master key|panic bar|exit device|property manager|building/.test(
    text,
  )
  const safe = /\bsafe\b|vault|combination/.test(text)

  let kind: JobKind = 'other'
  if (lockedOut && carContext) kind = 'car_lockout'
  else if (lockedOut && houseContext) kind = 'house_lockout'
  else if (lockedOut) kind = 'house_lockout'
  else if (safe) kind = 'safe'
  else if (rekey) kind = 'rekey'
  else if (carKey) kind = 'car_key'
  else if (lockChange) kind = 'lock_change'
  else if (commercial) kind = 'commercial'

  const isLockout = kind === 'car_lockout' || kind === 'house_lockout'
  const wantsQuote = /quote|estimate|how much|price/.test(text)

  const urgency: LeadUrgency = isLockout
    ? 'emergency'
    : /emergency|urgent|asap|right now|today/.test(text)
      ? 'same_day'
      : wantsQuote
        ? 'quote'
        : 'normal'

  const hasLocation =
    /\d{2,}/.test(text) ||
    /street|\bst\b|ave|avenue|road|\brd\b|drive|\bdr\b|blvd|lane|\bln\b|downtown|corner of|cross/.test(text)
  const hasTime = /morning|afternoon|evening|tonight|today|tomorrow|pm|am|\d\s?(am|pm)|noon/.test(text)

  const missingFields = [
    !hasLocation ? (isLockout ? 'address or where you are right now' : 'service address') : '',
    !isLockout && !hasTime ? 'best time today or tomorrow' : '',
  ].filter(Boolean)

  const enoughInfo = kind !== 'other' && missingFields.length === 0
  const status: LeadStatus = enoughInfo ? 'qualified' : 'qualifying'
  const estimatedValue = estimates[kind]

  let reply: string
  if (kind === 'other') {
    reply = 'Happy to help. Are you locked out, or do you need a rekey, a new lock, or a car key? And where are you?'
  } else if (missingFields.length > 0) {
    reply = `Got it — ${jobLabels[kind].toLowerCase()}. What is the ${missingFields[0]}?`
  } else if (isLockout) {
    reply = 'Got it, hang tight — a locksmith can be there fast. Sending this to the owner now and you will get an ETA by text.'
  } else {
    reply = 'Perfect, I have what I need. Passing this to the owner and we will text you a time window shortly.'
  }

  return {
    reply,
    summary: `${jobLabels[kind]}. ${
      urgency === 'emergency' ? 'Treat as urgent.' : urgency === 'same_day' ? 'Wants it today.' : 'Standard scheduling.'
    }`,
    urgency,
    issueType: kind,
    status,
    estimatedValue,
    missingFields,
  }
}
