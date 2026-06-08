// ServicePilot — autonomous commercial lead engine for multi-location locksmith
// companies. These types describe real accounts discovered from live map data,
// the pipeline they move through, and the agents that work them.

export type Segment =
  | 'property_management'
  | 'apartments'
  | 'hotel'
  | 'hospital'
  | 'university'
  | 'school'
  | 'government'
  | 'dealership'
  | 'storage'
  | 'mall_retail'
  | 'bank'
  | 'warehouse'
  | 'gym'
  | 'office'
  | 'commercial'

export type Tier = 'A' | 'B' | 'C'

// Where an account is in the funnel. Everything is derived from real work the
// agents do — nothing is pre-seeded.
export type Stage = 'discovered' | 'qualified' | 'ready' | 'contacted' | 'won' | 'passed'

export type RawAccount = {
  id: string
  name: string
  segment: Segment
  category: string
  address: string
  city: string
  lat?: number
  lon?: number
  phone?: string
  website?: string
  sizeLabel: string
  sizeScore: number // 0..1 strength of "this is a big account" signal
}

export type Account = RawAccount & {
  stage: Stage
  tier: Tier
  score: number // 0..100 fit score
  acv: number // estimated annual contract value (USD)
  need: string // what locksmith work they need
  reasons: string[] // why the qualifier scored it this way
  outreach?: string // drafted first-touch message
  insight?: string // optional LLM angle
  territory: string
  discoveredAt: number
  draftedByLLM?: boolean
}

export type AgentId = 'scout' | 'qualifier' | 'writer' | 'closer' | 'analyst'

export type AgentStatus = 'idle' | 'working' | 'blocked'

export type Agent = {
  id: AgentId
  name: string
  role: string
  status: AgentStatus
  task: string
  done: number
  doneLabel: string
}

export type ActivityEvent = {
  id: string
  agentId: AgentId
  text: string
  at: number
  accountId?: string
}

export type Approval = {
  id: string
  agentId: AgentId
  accountId: string
  title: string
  detail: string
  action: string
}

export type Territory = {
  name: string
  status: 'pending' | 'scanning' | 'covered' | 'error'
  found: number
}

export type Autonomy = 'ask' | 'auto'

export type Settings = {
  companyName: string
  leaderName: string
  autonomy: Autonomy
  llmEnabled: boolean
  apiKey: string
  model: string
}

export type EngineState = {
  running: boolean
  territories: Territory[]
  accounts: Account[]
  activity: ActivityEvent[]
  approvals: Approval[]
  agents: Record<AgentId, Agent>
  settings: Settings
  lastError: string | null
}
