export type LeadUrgency = 'emergency' | 'same_day' | 'normal' | 'quote'
export type LeadStatus = 'captured' | 'qualifying' | 'qualified' | 'booked' | 'completed' | 'lost'
export type LeadSource = 'missed_call' | 'inbound_sms' | 'website' | 'manual' | 'outbound'

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
  carTrapped: boolean
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
  status: LeadStatus
  estimatedValue: number
  missingFields: string[]
}

export type DemoEvent = {
  id: string
  title: string
  detail: string
  channel: 'voice' | 'sms' | 'ai' | 'owner' | 'review'
  complete: boolean
}

export const demoCompany = {
  id: '00000000-0000-4000-8000-000000000001',
  name: 'Northline Door & Lock',
  ownerName: 'Mike',
  serviceArea: 'North York, Toronto, Vaughan',
  reviewLink: 'https://g.page/r/demo-review-link',
}

export const demoLeads: DemoLead[] = [
  {
    id: 'LD-2051',
    customerName: 'David',
    customerPhone: '+1 416 555 0184',
    city: 'North York',
    issueType: 'Garage door stuck closed',
    urgency: 'emergency',
    status: 'qualified',
    source: 'missed_call',
    estimatedValue: 475,
    carTrapped: true,
    preferredTime: 'Today',
    summary: 'Customer says the door is stuck closed and the car is inside. Needs same-day dispatch.',
    receivedAt: '2 min ago',
    lastMessage:
      "Hi David, sorry we missed your call. Is the garage door stuck open or closed, and is a car trapped inside?",
    timeline: [
      'Missed call detected from Twilio voice webhook.',
      'Recovery SMS sent in demo mode.',
      'AI classified emergency: stuck closed, car trapped.',
      'Owner summary queued for technician dispatch.',
    ],
  },
  {
    id: 'LD-2052',
    customerName: 'Rachel Kim',
    customerPhone: '+1 416 555 0185',
    city: 'Toronto',
    address: '84 Willowbend Ave',
    issueType: 'Broken torsion spring',
    urgency: 'same_day',
    status: 'booked',
    source: 'inbound_sms',
    estimatedValue: 650,
    carTrapped: false,
    preferredTime: '12:30-2:00',
    summary: 'Broken torsion spring. Quote accepted and technician window booked.',
    receivedAt: '18 min ago',
    lastMessage: 'Rachel, you are booked for 12:30-2:00. We will text when the technician is on the way.',
    timeline: [
      'Inbound SMS created the lead.',
      'AI collected address, issue type, and preferred time.',
      'Owner approved booking.',
      'Review request scheduled after completion.',
    ],
  },
  {
    id: 'LD-2053',
    customerName: 'Omar Haddad',
    customerPhone: '+1 647 555 0198',
    city: 'Vaughan',
    issueType: 'Opener not responding',
    urgency: 'normal',
    status: 'captured',
    source: 'website',
    estimatedValue: 225,
    carTrapped: false,
    preferredTime: 'Tomorrow morning',
    summary: 'Needs opener diagnosis. Waiting for model photo and exact address.',
    receivedAt: '34 min ago',
    lastMessage: 'Can you send the opener model photo and the best service address?',
    timeline: ['Website form received.', 'AI requested opener photo and address.'],
  },
]

export const demoMetrics: DashboardMetrics = {
  newLeads: 7,
  missedCallsRecovered: 4,
  jobsBooked: 3,
  estimatedRevenue: 1250,
  reviewsRequested: 2,
  closeRate: 43,
  responseTimeSeconds: 45,
}

export const demoEvents: DemoEvent[] = [
  {
    id: 'call',
    title: 'Customer calls',
    detail: 'Twilio receives a missed call from a garage door customer.',
    channel: 'voice',
    complete: true,
  },
  {
    id: 'sms',
    title: 'Recovery SMS',
    detail: 'The agent texts back in under a minute and asks one short intake question.',
    channel: 'sms',
    complete: true,
  },
  {
    id: 'ai',
    title: 'AI qualifies',
    detail: 'Issue, urgency, city, car trapped, preferred time, and summary are extracted.',
    channel: 'ai',
    complete: true,
  },
  {
    id: 'owner',
    title: 'Owner notified',
    detail: 'A clean job summary is sent to the owner with book, text, and review actions.',
    channel: 'owner',
    complete: true,
  },
  {
    id: 'review',
    title: 'Review loop',
    detail: 'After completion, the customer receives a Google review request automatically.',
    channel: 'review',
    complete: false,
  },
]

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

// The AI workforce. Each agent runs one part of the front desk autonomously
// and only hands work back to a human when something needs approval.
export const agents: Agent[] = [
  {
    id: 'reception',
    name: 'Riley',
    role: 'Reception agent',
    status: 'working',
    activity: 'Recovering a missed call from a North York customer.',
    doneToday: 6,
    doneLabel: 'calls recovered',
  },
  {
    id: 'intake',
    name: 'Iris',
    role: 'Intake agent',
    status: 'needs_you',
    activity: 'Qualified a stuck-door emergency — owner summary is ready for you.',
    doneToday: 9,
    doneLabel: 'leads qualified',
  },
  {
    id: 'dispatch',
    name: 'Dex',
    role: 'Dispatch agent',
    status: 'working',
    activity: 'Booking a same-day window for a broken torsion spring.',
    doneToday: 3,
    doneLabel: 'jobs booked',
  },
  {
    id: 'prospector',
    name: 'Pia',
    role: 'Prospecting agent',
    status: 'idle',
    activity: 'Ready to scan a new area for commercial door accounts.',
    doneToday: 14,
    doneLabel: 'accounts found',
  },
  {
    id: 'reviews',
    name: 'Remy',
    role: 'Reviews agent',
    status: 'working',
    activity: 'Following up on a completed job for a Google review.',
    doneToday: 5,
    doneLabel: 'reviews requested',
  },
]

export const demoApprovals: Approval[] = [
  {
    id: 'ap-1',
    agent: 'Iris',
    agentRole: 'Intake agent',
    agentId: 'intake',
    title: 'Send owner summary for David',
    detail: 'Emergency — garage door stuck closed, car trapped in North York. $475 estimated.',
    action: 'Approve & send',
  },
  {
    id: 'ap-2',
    agent: 'Dex',
    agentRole: 'Dispatch agent',
    agentId: 'dispatch',
    title: 'Book Rachel Kim for 12:30–2:00',
    detail: 'Broken torsion spring, quote accepted. Confirm the technician window.',
    action: 'Approve booking',
  },
  {
    id: 'ap-3',
    agent: 'Pia',
    agentRole: 'Prospecting agent',
    agentId: 'prospector',
    title: 'Add 6 new commercial accounts',
    detail: 'High-fit storage and auto-shop door accounts found near Vaughan.',
    action: 'Approve & add',
  },
]

export const demoActivity: AgentActivity[] = [
  { id: 'ev-1', agent: 'Riley', agentId: 'reception', text: 'Texted back a missed call in 38 seconds.', time: 'just now' },
  { id: 'ev-2', agent: 'Iris', agentId: 'intake', text: 'Classified an opener issue as normal priority.', time: '2m ago' },
  { id: 'ev-3', agent: 'Dex', agentId: 'dispatch', text: 'Booked a same-day job and texted the customer.', time: '14m ago' },
  { id: 'ev-4', agent: 'Pia', agentId: 'prospector', text: 'Found 12 commercial door accounts in North York.', time: '31m ago' },
  { id: 'ev-5', agent: 'Remy', agentId: 'reviews', text: 'Sent a Google review request to a finished job.', time: '1h ago' },
]

export function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value)
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
