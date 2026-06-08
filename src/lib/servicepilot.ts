export type LeadUrgency = 'emergency' | 'same_day' | 'normal' | 'quote'
export type LeadStatus = 'captured' | 'qualifying' | 'qualified' | 'booked' | 'completed' | 'lost'
export type LeadSource = 'missed_call' | 'inbound_sms' | 'website' | 'manual' | 'outbound'

export type JobKind =
  | 'car_lockout'
  | 'house_lockout'
  | 'rekey'
  | 'lock_change'
  | 'car_key'
  | 'commercial'
  | 'safe'
  | 'other'

export type DemoLead = {
  id: string
  customerName: string
  customerPhone: string
  city: string
  address?: string
  issueType: string
  urgency: LeadUrgency
  status: LeadStatus
  source: LeadSource
  estimatedValue: number
  preferredTime: string
  summary: string
  receivedAt: string
  lastMessage: string
  timeline: string[]
}

export type DashboardMetrics = {
  newLeads: number
  missedCallsRecovered: number
  jobsBooked: number
  estimatedRevenue: number
  reviewsRequested: number
  closeRate: number
  responseTimeSeconds: number
}

export type IntakeResult = {
  reply: string
  summary: string
  urgency: LeadUrgency
  issueType: string
  kind: JobKind
  status: LeadStatus
  estimatedValue: number
  missingFields: string[]
}

export const demoCompany = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Keystone Lock & Key',
  ownerName: 'Sam',
  serviceArea: 'Austin, TX',
  reviewLink: 'https://g.page/r/demo-review-link',
}

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

export function jobLabel(kind: JobKind) {
  return jobLabels[kind]
}

export const demoLeads: DemoLead[] = [
  {
    id: 'LD-2051',
    customerName: 'Maria Lopez',
    customerPhone: '+1 512 555 0184',
    city: 'Downtown Austin',
    address: '600 Congress Ave',
    issueType: 'Car lockout',
    urgency: 'emergency',
    status: 'qualified',
    source: 'missed_call',
    estimatedValue: 89,
    preferredTime: 'Right now',
    summary: 'Keys locked inside the car outside her office downtown. Wants someone as soon as possible.',
    receivedAt: '2 min ago',
    lastMessage:
      "Hi Maria, sorry we missed your call. Are you locked out of a car or a building, and what's the address you're at right now?",
    timeline: [
      'Missed call detected from the Twilio voice webhook.',
      'Riley texted back in 38 seconds.',
      'Iris classified an emergency car lockout downtown.',
      'Owner summary is ready for Sam to approve.',
    ],
  },
  {
    id: 'LD-2052',
    customerName: 'Daniel Reed',
    customerPhone: '+1 512 555 0185',
    city: 'East Austin',
    address: '84 Willowbend Ave',
    issueType: 'Rekey · 4 locks',
    urgency: 'same_day',
    status: 'booked',
    source: 'inbound_sms',
    estimatedValue: 220,
    preferredTime: '12:30–2:00',
    summary: 'Just moved in, wants every lock rekeyed to one new key. Booked a same-day window.',
    receivedAt: '18 min ago',
    lastMessage: 'Daniel, you are booked for 12:30–2:00. We will text you when the locksmith is on the way.',
    timeline: [
      'Inbound SMS created the lead.',
      'Iris collected the address, lock count, and preferred time.',
      'Dex booked the same-day window.',
      'Review request scheduled for after the job.',
    ],
  },
  {
    id: 'LD-2053',
    customerName: 'Priya Nair',
    customerPhone: '+1 737 555 0198',
    city: 'North Austin',
    issueType: 'Car key / fob',
    urgency: 'normal',
    status: 'captured',
    source: 'website',
    estimatedValue: 260,
    preferredTime: 'Tomorrow morning',
    summary: 'Lost the only key fob for a 2019 Honda. Needs a replacement cut and programmed.',
    receivedAt: '34 min ago',
    lastMessage: 'Can you send the car year, make, and model so we bring the right blank and programmer?',
    timeline: ['Website form received.', 'Iris asked for the vehicle details and best service time.'],
  },
]

export const demoMetrics: DashboardMetrics = {
  newLeads: 9,
  missedCallsRecovered: 5,
  jobsBooked: 4,
  estimatedRevenue: 940,
  reviewsRequested: 3,
  closeRate: 44,
  responseTimeSeconds: 38,
}

export type AgentStatus = 'working' | 'idle' | 'needs_you'

export type Agent = {
  id: 'reception' | 'intake' | 'dispatch' | 'prospector' | 'reviews'
  name: string
  role: string
  status: AgentStatus
  activity: string
  doneToday: number
  doneLabel: string
}

export type Approval = {
  id: string
  agent: string
  agentRole: string
  agentId: Agent['id']
  title: string
  detail: string
  action: string
}

export type AgentActivity = {
  id: string
  agent: string
  agentId: Agent['id']
  text: string
  time: string
}

// The AI workforce. Each agent runs one part of the front desk on its own and
// only hands work back to a person when something genuinely needs approval.
export const agents: Agent[] = [
  {
    id: 'reception',
    name: 'Riley',
    role: 'Answers the phone',
    status: 'working',
    activity: 'Texting back a missed call from a downtown lockout.',
    doneToday: 6,
    doneLabel: 'calls recovered',
  },
  {
    id: 'intake',
    name: 'Iris',
    role: 'Qualifies the job',
    status: 'needs_you',
    activity: 'Qualified an emergency car lockout — the summary is ready for you.',
    doneToday: 9,
    doneLabel: 'jobs qualified',
  },
  {
    id: 'dispatch',
    name: 'Dex',
    role: 'Books & schedules',
    status: 'working',
    activity: 'Booking a same-day rekey for an East Austin move-in.',
    doneToday: 4,
    doneLabel: 'jobs booked',
  },
  {
    id: 'prospector',
    name: 'Pia',
    role: 'Finds new accounts',
    status: 'idle',
    activity: 'Ready to scan a new area for property managers and dealerships.',
    doneToday: 12,
    doneLabel: 'accounts found',
  },
  {
    id: 'reviews',
    name: 'Remy',
    role: 'Earns 5-star reviews',
    status: 'working',
    activity: 'Following up on a finished job for a Google review.',
    doneToday: 5,
    doneLabel: 'reviews requested',
  },
]

export const demoApprovals: Approval[] = [
  {
    id: 'ap-1',
    agent: 'Iris',
    agentRole: 'Qualifies the job',
    agentId: 'intake',
    title: 'Send the job summary for Maria',
    detail: 'Emergency car lockout at 600 Congress Ave, downtown. About $89. Reply ready to go to your phone.',
    action: 'Approve & send',
  },
  {
    id: 'ap-2',
    agent: 'Dex',
    agentRole: 'Books & schedules',
    agentId: 'dispatch',
    title: 'Book Daniel for 12:30–2:00',
    detail: 'Rekey of 4 locks after a move-in, East Austin. Confirm the same-day window.',
    action: 'Approve booking',
  },
  {
    id: 'ap-3',
    agent: 'Pia',
    agentRole: 'Finds new accounts',
    agentId: 'prospector',
    title: 'Add 6 new commercial accounts',
    detail: 'High-fit property managers and a dealership near downtown that need recurring lock work.',
    action: 'Approve & add',
  },
]

export const demoActivity: AgentActivity[] = [
  { id: 'ev-1', agent: 'Riley', agentId: 'reception', text: 'texted back a missed call in 38 seconds.', time: 'just now' },
  { id: 'ev-2', agent: 'Iris', agentId: 'intake', text: 'classified a car lockout as an emergency.', time: '2m ago' },
  { id: 'ev-3', agent: 'Dex', agentId: 'dispatch', text: 'booked a same-day rekey and texted the customer.', time: '14m ago' },
  { id: 'ev-4', agent: 'Pia', agentId: 'prospector', text: 'found 12 commercial accounts near downtown.', time: '31m ago' },
  { id: 'ev-5', agent: 'Remy', agentId: 'reviews', text: 'sent a Google review request to a finished job.', time: '1h ago' },
]

export function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
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

// Lightweight, deterministic intake classifier used in demo mode. It reads a
// customer's plain-English message and decides what kind of locksmith job it is,
// how urgent it is, and what one thing it still needs to ask for.
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

  const highRisk = /child|kid|baby|toddler|pet|\bdog\b|\bcat\b|night|dark|alone|cold|freezing|disabled|elderly/.test(text)

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
    /street|\bst\b|ave|avenue|road|\brd\b|drive|\bdr\b|blvd|lane|\bln\b|downtown|austin|congress|corner of|cross/.test(
      text,
    )
  const hasTime = /morning|afternoon|evening|tonight|today|tomorrow|pm|am|\d\s?(am|pm)|noon/.test(text)

  // For an emergency we only really need to know where they are. For planned
  // work we also want a time window.
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
    reply = `Got it — ${jobLabels[kind].toLowerCase()}. What's the ${missingFields[0]}?`
  } else if (isLockout) {
    reply = "Got it, hang tight — a locksmith can be there fast. I'm sending this to Sam now and you'll get an ETA by text."
  } else {
    reply = "Perfect, I have what I need. I'll pass this to Sam and we'll text you a time window shortly."
  }

  const summary = `${jobLabels[kind]}${
    isLockout && highRisk ? ' (someone vulnerable on site)' : ''
  }. ${urgency === 'emergency' ? 'Treat as urgent.' : urgency === 'same_day' ? 'Wants it today.' : 'Standard scheduling.'}`

  return { reply, summary, urgency, issueType: jobLabels[kind], kind, status, estimatedValue, missingFields }
}
