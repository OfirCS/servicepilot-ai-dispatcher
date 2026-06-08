import { useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  Boxes,
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  ExternalLink,
  Home,
  KeyRound,
  Loader2,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  Plus,
  Radar,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Wrench,
  X,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  agents,
  classifyIntake,
  demoActivity,
  demoApprovals,
  demoCompany,
  demoLeads,
  demoMetrics,
  money,
  type Agent,
  type AgentActivity,
  type Approval,
  type DashboardMetrics,
  type DemoLead,
  type LeadStatus,
  type LeadUrgency,
} from './lib/servicepilot'
import { findProspects, type Prospect } from './lib/leadfinder'
import './App.css'

type DrawerMode = 'demo' | 'finder' | 'job' | 'setup' | null

const agentIcon: Record<Agent['id'], LucideIcon> = {
  reception: PhoneCall,
  intake: MessageSquare,
  dispatch: Calendar,
  prospector: Radar,
  reviews: Star,
}

const agentStatusLabel: Record<Agent['status'], string> = {
  working: 'Working',
  idle: 'Ready',
  needs_you: 'Needs you',
}

const segmentIcon: Record<Prospect['segment'], LucideIcon> = {
  property_management: Building2,
  dealership: Car,
  storage: Boxes,
  hotel: Building2,
  realtor: Home,
  auto_repair: Wrench,
  commercial: Building2,
}

const urgencyTone: Record<LeadUrgency, 'good' | 'warn' | 'danger' | 'neutral'> = {
  emergency: 'danger',
  same_day: 'warn',
  normal: 'neutral',
  quote: 'neutral',
}

const setupSteps = [
  {
    title: 'Connect your phone number',
    detail: 'Point your business line at Keystone so Riley can text back every missed call.',
    env: 'Twilio',
  },
  {
    title: 'Turn on the database',
    detail: 'Jobs, customers, and messages save automatically once Supabase is connected.',
    env: 'Supabase',
  },
  {
    title: 'Add your review link',
    detail: 'Remy uses your Google review link to ask happy customers for a 5-star review.',
    env: 'Google',
  },
  {
    title: 'Set your service area',
    detail: 'Pia uses it to find new commercial accounts near you.',
    env: 'Service area',
  },
]

let idSeq = 0
function uid(prefix: string) {
  idSeq += 1
  return `${prefix}-${idSeq}`
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function statusLabel(status: LeadStatus) {
  return status.replace('_', ' ')
}

function App() {
  const [leads, setLeads] = useState<DemoLead[]>(demoLeads)
  const [selectedLeadId, setSelectedLeadId] = useState(demoLeads[0].id)
  const [metrics, setMetrics] = useState<DashboardMetrics>(demoMetrics)
  const [approvals, setApprovals] = useState<Approval[]>(demoApprovals)
  const [activity, setActivity] = useState<AgentActivity[]>(demoActivity)
  const [drawer, setDrawer] = useState<DrawerMode>(null)

  const [demoMessage, setDemoMessage] = useState(
    "I'm locked out of my car downtown and my keys are inside. Can someone come now?",
  )
  const [prospectArea, setProspectArea] = useState(demoCompany.serviceArea)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [prospectStatus, setProspectStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [prospectSource, setProspectSource] = useState<'openstreetmap' | 'demo' | null>(null)
  const [prospectNote, setProspectNote] = useState<string | null>(null)
  const [addedProspects, setAddedProspects] = useState<Record<string, true>>({})

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? leads[0]
  const handledToday = agents.reduce((sum, agent) => sum + agent.doneToday, 0)

  const greetLine = useMemo(
    () => `${greeting()}, ${demoCompany.ownerName}. Your AI front desk handled ${handledToday} things today.`,
    [handledToday],
  )

  function logActivity(agentId: Agent['id'], agent: string, text: string) {
    setActivity((current) => [{ id: uid('ev'), agentId, agent, text, time: 'just now' }, ...current].slice(0, 8))
  }

  function openJob(id: string) {
    setSelectedLeadId(id)
    setDrawer('job')
  }

  function runMissedCallDemo() {
    const intake = classifyIntake(demoMessage)
    const lead: DemoLead = {
      id: uid('LD'),
      customerName: 'New caller',
      customerPhone: '+1 512 555 0110',
      city: demoMessage.match(/downtown|austin|north|east|west|south/i)?.[0] ?? 'Nearby',
      issueType: intake.issueType,
      urgency: intake.urgency,
      status: intake.status,
      source: 'missed_call',
      estimatedValue: intake.estimatedValue,
      preferredTime: /today|now/i.test(demoMessage) ? 'Right now' : 'Flexible',
      summary: intake.summary,
      receivedAt: 'just now',
      lastMessage: intake.reply,
      timeline: [
        'Missed call detected by the Twilio webhook.',
        'Riley texted back instantly.',
        `Iris classified ${intake.issueType.toLowerCase()} (${intake.urgency.replace('_', ' ')}).`,
        intake.status === 'qualified' ? 'Job summary is ready for you.' : 'Iris is asking one more question.',
      ],
    }
    setLeads((current) => [lead, ...current])
    setSelectedLeadId(lead.id)
    setMetrics((current) => ({
      ...current,
      newLeads: current.newLeads + 1,
      missedCallsRecovered: current.missedCallsRecovered + 1,
      estimatedRevenue: current.estimatedRevenue + intake.estimatedValue,
    }))
    logActivity('reception', 'Riley', 'recovered a missed call and texted back in seconds.')
    logActivity('intake', 'Iris', `qualified a ${intake.issueType.toLowerCase()}.`)
    setDrawer('job')
  }

  function bookSelectedLead() {
    setLeads((current) =>
      current.map((lead) =>
        lead.id === selectedLead.id
          ? {
              ...lead,
              status: 'booked',
              preferredTime: lead.preferredTime === 'Flexible' ? 'Today 3:00–5:00' : lead.preferredTime,
              timeline: [...lead.timeline, 'Dex booked the job.'],
            }
          : lead,
      ),
    )
    setMetrics((current) => ({ ...current, jobsBooked: current.jobsBooked + 1 }))
    logActivity('dispatch', 'Dex', `booked ${selectedLead.customerName} and texted a confirmation.`)
  }

  function sendReviewRequest() {
    setMetrics((current) => ({ ...current, reviewsRequested: current.reviewsRequested + 1 }))
    setLeads((current) =>
      current.map((lead) =>
        lead.id === selectedLead.id
          ? { ...lead, status: 'completed', timeline: [...lead.timeline, 'Remy sent a review request.'] }
          : lead,
      ),
    )
    logActivity('reviews', 'Remy', `asked ${selectedLead.customerName} for a Google review.`)
  }

  function approve(approval: Approval) {
    setApprovals((current) => current.filter((item) => item.id !== approval.id))
    if (approval.agentId === 'dispatch') setMetrics((current) => ({ ...current, jobsBooked: current.jobsBooked + 1 }))
    if (approval.agentId === 'reviews') setMetrics((current) => ({ ...current, reviewsRequested: current.reviewsRequested + 1 }))
    logActivity(approval.agentId, approval.agent, `got your OK — ${approval.title.toLowerCase()}.`)
  }

  function dismiss(approval: Approval) {
    setApprovals((current) => current.filter((item) => item.id !== approval.id))
  }

  async function runProspectSearch() {
    setProspectStatus('loading')
    setProspectNote(null)
    const result = await findProspects(prospectArea)
    setProspects(result.prospects)
    setProspectSource(result.source)
    setProspectNote(result.note ?? null)
    setProspectStatus('done')
    logActivity('prospector', 'Pia', `found ${result.prospects.length} new accounts in ${prospectArea}.`)
  }

  function addProspectToPipeline(prospect: Prospect) {
    if (addedProspects[prospect.id]) return
    const lead: DemoLead = {
      id: uid('LD'),
      customerName: prospect.name,
      customerPhone: prospect.phone ?? 'No number — visit or email',
      city: prospect.city || prospectArea.split(',')[0] || prospectArea,
      issueType: prospect.category,
      urgency: 'quote',
      status: 'captured',
      source: 'outbound',
      estimatedValue: prospect.estimatedValue,
      preferredTime: 'Outbound — schedule intro call',
      summary: `${prospect.category}. ${prospect.signal}`,
      receivedAt: 'just now',
      lastMessage: prospect.outreach,
      timeline: [
        'Sourced by Pia, your prospecting agent.',
        `Fit score ${prospect.score}/100 · ${prospect.volumeEstimate}.`,
        'First message drafted and ready to send.',
      ],
    }
    setLeads((current) => [lead, ...current])
    setSelectedLeadId(lead.id)
    setAddedProspects((current) => ({ ...current, [prospect.id]: true }))
    setMetrics((current) => ({ ...current, newLeads: current.newLeads + 1 }))
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <KeyRound size={20} aria-hidden="true" />
          </span>
          <div className="brand-text">
            <strong>ServicePilot</strong>
            <span>{demoCompany.name}</span>
          </div>
        </div>

        <div className="top-actions">
          <span className="live-pill">
            <span className="dot" aria-hidden="true" />
            All agents live
          </span>
          <button type="button" className="ghost-button" onClick={() => setDrawer('finder')}>
            <Radar size={16} aria-hidden="true" />
            Find new accounts
          </button>
          <button type="button" className="primary-button" onClick={() => setDrawer('demo')}>
            <Phone size={16} aria-hidden="true" />
            Try a missed call
          </button>
          <button type="button" className="icon-button" onClick={() => setDrawer('setup')} aria-label="Setup">
            <Settings size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="board">
        <section className="hello">
          <div>
            <span className="eyeline">Today</span>
            <h1>{greetLine}</h1>
          </div>
          <div className="hello-metrics">
            <Metric label="Jobs booked" value={`${metrics.jobsBooked}`} />
            <Metric label="Calls recovered" value={`${metrics.missedCallsRecovered}`} />
            <Metric label="Revenue saved" value={money(metrics.estimatedRevenue)} />
            <Metric label="Reviews asked" value={`${metrics.reviewsRequested}`} />
          </div>
        </section>

        <div className="grid">
          <div className="col-main">
            <section className="card approvals">
              <div className="card-head">
                <div>
                  <h2>Needs your OK</h2>
                  <p>Your agents do the work and only stop here when a person should decide.</p>
                </div>
                <span className="count-pill">{approvals.length}</span>
              </div>

              {approvals.length === 0 ? (
                <div className="empty good">
                  <CheckCircle2 size={26} aria-hidden="true" />
                  <p>All clear. Nothing is waiting on you right now.</p>
                </div>
              ) : (
                <div className="approval-list">
                  {approvals.map((approval) => {
                    const Icon = agentIcon[approval.agentId]
                    return (
                      <article className="approval" key={approval.id}>
                        <div className="approval-agent">
                          <span className="avatar">
                            <Icon size={15} aria-hidden="true" />
                          </span>
                          <div>
                            <strong>{approval.agent}</strong>
                            <small>{approval.agentRole}</small>
                          </div>
                        </div>
                        <div className="approval-body">
                          <strong>{approval.title}</strong>
                          <p>{approval.detail}</p>
                        </div>
                        <div className="approval-actions">
                          <button type="button" className="primary-button" onClick={() => approve(approval)}>
                            <CheckCircle2 size={15} aria-hidden="true" />
                            {approval.action}
                          </button>
                          <button type="button" className="text-button" onClick={() => dismiss(approval)}>
                            Not now
                          </button>
                        </div>
                      </article>
                    )
                  })}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Today's jobs</h2>
                  <p>Every call and message your agents turned into a real job.</p>
                </div>
                <span className="count-pill subtle">{leads.length}</span>
              </div>
              <div className="job-list">
                {leads.map((lead) => (
                  <button type="button" className="job" key={lead.id} onClick={() => openJob(lead.id)}>
                    <div className="job-main">
                      <strong>{lead.customerName}</strong>
                      <span>{lead.issueType} · {lead.city}</span>
                    </div>
                    <div className="job-meta">
                      <StatusChip tone={urgencyTone[lead.urgency]}>{lead.urgency.replace('_', ' ')}</StatusChip>
                      <span className="job-value">{money(lead.estimatedValue)}</span>
                    </div>
                    <ArrowRight size={16} className="job-arrow" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </section>
          </div>

          <div className="col-side">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Your AI team</h2>
                  <p>Five agents that run your front desk.</p>
                </div>
              </div>
              <div className="agent-list">
                {agents.map((agent) => {
                  const Icon = agentIcon[agent.id]
                  return (
                    <div className="agent" key={agent.id}>
                      <span className="avatar">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <div className="agent-info">
                        <div className="agent-line">
                          <strong>{agent.name}</strong>
                          <span className={`agent-status ${agent.status}`}>
                            <span className="dot" aria-hidden="true" />
                            {agentStatusLabel[agent.status]}
                          </span>
                        </div>
                        <small>{agent.role}</small>
                        <p>{agent.activity}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Live activity</h2>
                  <p>What your agents did on their own.</p>
                </div>
                <span className="live-dot" aria-hidden="true" />
              </div>
              <div className="activity-list">
                <AnimatePresence initial={false}>
                  {activity.map((event) => {
                    const Icon = agentIcon[event.agentId]
                    return (
                      <motion.div
                        className="activity"
                        key={event.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className="avatar small">
                          <Icon size={13} aria-hidden="true" />
                        </span>
                        <p>
                          <b>{event.agent}</b> {event.text}
                        </p>
                        <time>{event.time}</time>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {drawer && (
          <Drawer onClose={() => setDrawer(null)}>
            {drawer === 'demo' && (
              <DemoPanel demoMessage={demoMessage} setDemoMessage={setDemoMessage} runMissedCallDemo={runMissedCallDemo} />
            )}
            {drawer === 'finder' && (
              <FinderPanel
                prospectArea={prospectArea}
                setProspectArea={setProspectArea}
                prospects={prospects}
                prospectStatus={prospectStatus}
                prospectSource={prospectSource}
                prospectNote={prospectNote}
                addedProspects={addedProspects}
                runProspectSearch={runProspectSearch}
                addProspectToPipeline={addProspectToPipeline}
              />
            )}
            {drawer === 'job' && (
              <JobPanel lead={selectedLead} bookSelectedLead={bookSelectedLead} sendReviewRequest={sendReviewRequest} />
            )}
            {drawer === 'setup' && <SetupPanel />}
          </Drawer>
        )}
      </AnimatePresence>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function StatusChip({ children, tone }: { children: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }) {
  return <span className={`chip ${tone}`}>{children}</span>
}

function Drawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        className="drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        {children}
      </motion.aside>
    </motion.div>
  )
}

function DemoPanel({
  demoMessage,
  setDemoMessage,
  runMissedCallDemo,
}: {
  demoMessage: string
  setDemoMessage: (value: string) => void
  runMissedCallDemo: () => void
}) {
  const intake = classifyIntake(demoMessage)
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="eyeline">See it work</span>
        <h2>A customer calls and you're on a job</h2>
        <p>Type what a customer might text back. Watch your agents read it and get it job-ready — no keys needed.</p>
      </div>

      <div className="phones">
        <div className="phone">
          <PhoneCall size={18} aria-hidden="true" />
          <strong>Missed call</strong>
          <span>+1 512 555 0110</span>
        </div>
        <div className="phone active">
          <MessageSquare size={18} aria-hidden="true" />
          <strong>Riley texts back</strong>
          <span>{intake.reply}</span>
        </div>
      </div>

      <label className="field">
        <span>Customer's reply</span>
        <textarea value={demoMessage} onChange={(event) => setDemoMessage(event.target.value)} rows={3} />
      </label>

      <div className="readout">
        <div>
          <span>Job type</span>
          <strong>{intake.issueType}</strong>
        </div>
        <div>
          <span>Urgency</span>
          <strong>{intake.urgency.replace('_', ' ')}</strong>
        </div>
        <div>
          <span>Status</span>
          <strong>{intake.status}</strong>
        </div>
        <div>
          <span>Worth about</span>
          <strong>{money(intake.estimatedValue)}</strong>
        </div>
      </div>

      <button type="button" className="primary-button wide" onClick={runMissedCallDemo}>
        <Zap size={16} aria-hidden="true" />
        Turn this into a job
      </button>
    </div>
  )
}

function FinderPanel({
  prospectArea,
  setProspectArea,
  prospects,
  prospectStatus,
  prospectSource,
  prospectNote,
  addedProspects,
  runProspectSearch,
  addProspectToPipeline,
}: {
  prospectArea: string
  setProspectArea: (value: string) => void
  prospects: Prospect[]
  prospectStatus: 'idle' | 'loading' | 'done'
  prospectSource: 'openstreetmap' | 'demo' | null
  prospectNote: string | null
  addedProspects: Record<string, true>
  runProspectSearch: () => void
  addProspectToPipeline: (prospect: Prospect) => void
}) {
  const loading = prospectStatus === 'loading'
  const pipelineValue = prospects.reduce((sum, p) => sum + p.estimatedValue, 0)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!loading) runProspectSearch()
  }

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="eyeline">Pia · your prospecting agent</span>
        <h2>Find new commercial accounts</h2>
        <p>
          Pia scans your area for the businesses that need a locksmith on call — property managers, dealerships, storage,
          hotels — and drafts the first message.
        </p>
      </div>

      <form className="finder-form" onSubmit={submit}>
        <span className="finder-input">
          <MapPin size={16} aria-hidden="true" />
          <input
            value={prospectArea}
            onChange={(event) => setProspectArea(event.target.value)}
            placeholder="Your area, e.g. Austin, TX"
            aria-label="Service area"
          />
        </span>
        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
          {loading ? 'Scanning…' : 'Find accounts'}
        </button>
      </form>

      {prospectStatus === 'done' && (
        <div className="finder-summary">
          <div>
            <strong>{prospects.length}</strong>
            <span>accounts</span>
          </div>
          <div>
            <strong>{money(pipelineValue)}</strong>
            <span>per year potential</span>
          </div>
          <div>
            <strong>{prospectSource === 'openstreetmap' ? 'Live map' : 'Sample'}</strong>
            <span>source</span>
          </div>
        </div>
      )}

      {prospectNote && <p className="note">{prospectNote}</p>}

      {prospectStatus === 'idle' && (
        <div className="empty">
          <Radar size={26} aria-hidden="true" />
          <p>Enter your area and Pia will surface real commercial accounts near you.</p>
        </div>
      )}

      {loading && (
        <div className="empty">
          <Loader2 size={26} className="spin" aria-hidden="true" />
          <p>Scanning {prospectArea} for accounts that need a locksmith on call…</p>
        </div>
      )}

      {prospectStatus === 'done' && prospects.length === 0 && (
        <div className="empty">
          <Search size={26} aria-hidden="true" />
          <p>No commercial accounts found here. Try a larger city nearby.</p>
        </div>
      )}

      {prospectStatus === 'done' && prospects.length > 0 && (
        <div className="prospect-list">
          {prospects.map((prospect) => {
            const Icon = segmentIcon[prospect.segment] ?? Building2
            const added = Boolean(addedProspects[prospect.id])
            return (
              <article className="prospect" key={prospect.id}>
                <div className="prospect-head">
                  <span className="avatar">
                    <Icon size={16} aria-hidden="true" />
                  </span>
                  <div className="prospect-id">
                    <strong>{prospect.name}</strong>
                    <small>
                      {prospect.category}
                      {prospect.address ? ` · ${prospect.address}` : ''}
                    </small>
                  </div>
                  <span className="score" aria-label={`Fit score ${prospect.score} of 100`}>
                    <TrendingUp size={12} aria-hidden="true" />
                    {prospect.score}
                  </span>
                </div>
                <div className="prospect-meta">
                  <span>{prospect.volumeEstimate}</span>
                  <span>{money(prospect.estimatedValue)}/yr</span>
                </div>
                <div className="draft">
                  <span className="eyeline">Drafted message</span>
                  <p>{prospect.outreach}</p>
                </div>
                <div className="prospect-actions">
                  <button
                    type="button"
                    className={added ? 'ghost-button' : 'primary-button'}
                    onClick={() => addProspectToPipeline(prospect)}
                    disabled={added}
                  >
                    {added ? <CheckCircle2 size={15} aria-hidden="true" /> : <Plus size={15} aria-hidden="true" />}
                    {added ? 'Added' : 'Add to jobs'}
                  </button>
                  {prospect.website && (
                    <a className="text-button" href={prospect.website} target="_blank" rel="noreferrer">
                      <ExternalLink size={14} aria-hidden="true" />
                      Site
                    </a>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}
    </div>
  )
}

function JobPanel({
  lead,
  bookSelectedLead,
  sendReviewRequest,
}: {
  lead: DemoLead
  bookSelectedLead: () => void
  sendReviewRequest: () => void
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="eyeline">
          {lead.id} · {lead.source.replace('_', ' ')}
        </span>
        <div className="job-title">
          <h2>{lead.customerName}</h2>
          <StatusChip tone={lead.status === 'booked' ? 'good' : lead.status === 'qualified' ? 'warn' : 'neutral'}>
            {statusLabel(lead.status)}
          </StatusChip>
        </div>
        <p>{lead.summary}</p>
      </div>

      <div className="info-grid">
        <Info icon={Phone} label="Phone" value={lead.customerPhone} />
        <Info icon={MapPin} label="Where" value={lead.address ? `${lead.address}, ${lead.city}` : lead.city} />
        <Info icon={Wrench} label="Job" value={lead.issueType} />
        <Info icon={Clock} label="When" value={lead.preferredTime} />
      </div>

      <div className="quote-box">
        <span className="eyeline">Last message</span>
        <p>{lead.lastMessage}</p>
      </div>

      <div className="job-actions">
        <button type="button" className="primary-button" onClick={bookSelectedLead}>
          <Calendar size={16} aria-hidden="true" />
          Book the job
        </button>
        <button type="button" className="ghost-button" onClick={sendReviewRequest}>
          <Star size={16} aria-hidden="true" />
          Ask for a review
        </button>
      </div>

      <div className="timeline">
        {lead.timeline.map((event, index) => (
          <div className="timeline-row" key={`${event}-${index}`}>
            <span />
            <p>{event}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

function Info({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="info">
      <Icon size={15} aria-hidden="true" />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function SetupPanel() {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="eyeline">Setup</span>
        <h2>Go live in four steps</h2>
        <p>You're in demo mode with sample data. Connect these and your agents start working real calls.</p>
      </div>

      <div className="setup-list">
        {setupSteps.map((step, index) => (
          <div className="setup-step" key={step.title}>
            <span className="step-num">{index + 1}</span>
            <div>
              <div className="step-line">
                <strong>{step.title}</strong>
                <span className="step-tag">{step.env}</span>
              </div>
              <p>{step.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="guarantee">
        <ShieldCheck size={18} aria-hidden="true" />
        <div>
          <strong>You stay in control</strong>
          <p>Agents never send a customer message or book a job without the rules you set — and they ask first when it matters.</p>
        </div>
      </div>

      <div className="setup-foot">
        <Sparkles size={15} aria-hidden="true" />
        <span>Most locksmiths are live the same day. We help you connect your number.</span>
      </div>

      <a className="primary-button wide" href="mailto:hello@servicepilot.ai?subject=Set%20up%20my%20locksmith%20front%20desk">
        <Send size={16} aria-hidden="true" />
        Get set up
      </a>
    </div>
  )
}

export default App
