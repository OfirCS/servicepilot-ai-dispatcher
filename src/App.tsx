import { useMemo, useState, type FormEvent } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Bot,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Database,
  ExternalLink,
  FileText,
  Gauge,
  Headphones,
  Inbox,
  KeyRound,
  Loader2,
  MapPin,
  MessageSquare,
  PhoneCall,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  Truck,
  Users,
  Webhook,
  Zap,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import servicepilotMark from './assets/servicepilot-mark.png'
import {
  agents,
  classifyIntake,
  demoActivity,
  demoApprovals,
  demoCompany,
  demoEvents,
  demoLeads,
  demoMetrics,
  money,
  type Agent,
  type Approval,
  type DashboardMetrics,
  type DemoLead,
  type LeadStatus,
} from './lib/servicepilot'
import { findProspects, type Prospect } from './lib/leadfinder'
import './App.css'

type ViewKey = 'Agents' | 'Command' | 'Demo' | 'Marketing' | 'Automations' | 'YC' | 'Settings'

type ApiLog = {
  id: string
  method: string
  path: string
  status: string
  detail: string
}

type Integration = {
  id: string
  name: string
  purpose: string
  env: string[]
  icon: LucideIcon
}

const navItems: { id: ViewKey; label: string; icon: LucideIcon }[] = [
  { id: 'Agents', label: 'AI workforce', icon: Users },
  { id: 'Command', label: 'Lead queue', icon: Gauge },
  { id: 'Demo', label: 'Live demo', icon: Play },
  { id: 'Marketing', label: 'Lead finder', icon: Radar },
  { id: 'Automations', label: 'Automations', icon: Bot },
  { id: 'YC', label: 'YC proof', icon: Sparkles },
  { id: 'Settings', label: 'Setup', icon: Settings },
]

const agentIcon: Record<Agent['id'], LucideIcon> = {
  reception: PhoneCall,
  intake: MessageSquare,
  dispatch: Calendar,
  prospector: Radar,
  reviews: Star,
}

const agentStatusLabel: Record<Agent['status'], string> = {
  working: 'Working',
  idle: 'Idle',
  needs_you: 'Needs you',
}

const integrations: Integration[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    purpose: 'Stores companies, leads, messages, jobs, followups, and integration events.',
    env: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY'],
    icon: Database,
  },
  {
    id: 'twilio',
    name: 'Twilio',
    purpose: 'Receives missed calls, replies to inbound SMS, sends owner/customer texts.',
    env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_MESSAGING_SERVICE_SID', 'TWILIO_FROM_NUMBER'],
    icon: MessageSquare,
  },
  {
    id: 'openai',
    name: 'OpenAI',
    purpose: 'Optional live intake reasoning. Deterministic classifier is used in demo mode.',
    env: ['OPENAI_API_KEY'],
    icon: Sparkles,
  },
  {
    id: 'calendar',
    name: 'Calendar',
    purpose: 'Books appointments through the booking endpoint, Google Calendar can be added behind it.',
    env: ['GOOGLE_CALENDAR_ID'],
    icon: Calendar,
  },
]

const endpointRows = [
  ['POST', '/api/twilio/inbound-call', 'Forward call to owner and attach no-answer callback'],
  ['POST', '/api/twilio/call-status', 'Recover no-answer/busy/failed calls by SMS'],
  ['POST', '/api/twilio/inbound-sms', 'Qualify inbound SMS and return Twilio XML'],
  ['POST', '/api/ai/intake', 'Classify issue, urgency, missing fields, and reply'],
  ['POST', '/api/marketing/prospect', 'Find local commercial door accounts as outbound leads'],
  ['POST', '/api/calendar/book', 'Create scheduled job from qualified lead'],
  ['POST', '/api/followups/review', 'Send Google review request after completion'],
  ['GET', '/api/dashboard/metrics', 'Return launch metrics for dashboard'],
]

const initialLogs: ApiLog[] = [
  {
    id: 'log-1',
    method: 'POST',
    path: '/api/twilio/inbound-call',
    status: '200 XML',
    detail: 'Call forwarding TwiML ready',
  },
  {
    id: 'log-2',
    method: 'GET',
    path: '/api/dashboard/metrics',
    status: '200 JSON',
    detail: 'Demo metrics loaded',
  },
]

const automations = [
  {
    title: 'Missed-call recovery',
    trigger: 'No answer, busy, failed, or canceled call',
    output:
      'Hi, this is Northline Door & Lock. Sorry we missed your call. Do you need garage door repair, installation, or emergency service?',
    endpoint: '/api/twilio/call-status',
    enabled: true,
  },
  {
    title: 'SMS intake qualification',
    trigger: 'Customer replies to recovery SMS',
    output: 'Collect issue, urgency, city/address, car trapped, preferred time, and photo.',
    endpoint: '/api/twilio/inbound-sms',
    enabled: true,
  },
  {
    title: 'Owner summary',
    trigger: 'Lead is qualified',
    output: 'New qualified garage door lead: issue, urgency, phone, city, and suggested next step.',
    endpoint: '/api/twilio/inbound-sms',
    enabled: true,
  },
  {
    title: 'Review request',
    trigger: 'Job marked complete',
    output: 'Thanks for choosing us. If you were happy with the service, could you leave a quick Google review?',
    endpoint: '/api/followups/review',
    enabled: true,
  },
]

function statusLabel(status: LeadStatus) {
  return status.replace('_', ' ')
}

function App() {
  const [activeView, setActiveView] = useState<ViewKey>('Agents')
  const [leads, setLeads] = useState<DemoLead[]>(demoLeads)
  const [selectedLeadId, setSelectedLeadId] = useState(demoLeads[0].id)
  const [metrics, setMetrics] = useState<DashboardMetrics>(demoMetrics)
  const [apiLogs, setApiLogs] = useState<ApiLog[]>(initialLogs)
  const [demoMessage, setDemoMessage] = useState(
    'My garage door is stuck closed in North York and my car is inside. I need help today.',
  )
  const [demoStep, setDemoStep] = useState(2)
  const [integrationKeys, setIntegrationKeys] = useState<Record<string, string>>({})
  const [prospectArea, setProspectArea] = useState(demoCompany.serviceArea)
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [prospectStatus, setProspectStatus] = useState<'idle' | 'loading' | 'done'>('idle')
  const [prospectSource, setProspectSource] = useState<'openstreetmap' | 'demo' | null>(null)
  const [prospectNote, setProspectNote] = useState<string | null>(null)
  const [addedProspects, setAddedProspects] = useState<Record<string, true>>({})
  const [approvals, setApprovals] = useState<Approval[]>(demoApprovals)

  const selectedLead = leads.find((lead) => lead.id === selectedLeadId) ?? leads[0]
  const recoveredRevenue = leads
    .filter((lead) => lead.source === 'missed_call' || lead.source === 'inbound_sms')
    .reduce((sum, lead) => sum + lead.estimatedValue, 0)
  const readyIntegrations = integrations.filter((integration) =>
    integration.env.some((key) => integrationKeys[key]?.trim()),
  ).length

  const conversionCopy = useMemo(() => {
    return `${metrics.missedCallsRecovered}/${metrics.newLeads} missed calls recovered into ${metrics.jobsBooked} booked jobs`
  }, [metrics])

  function addLog(method: string, path: string, status: string, detail: string) {
    const id = `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    setApiLogs((current) => [{ id, method, path, status, detail }, ...current].slice(0, 7))
  }

  function runMissedCallDemo() {
    const intake = classifyIntake(demoMessage)
    const demoLead: DemoLead = {
      id: `LD-${Math.floor(3000 + Math.random() * 6999)}`,
      customerName: 'Demo Caller',
      customerPhone: '+1 416 555 0110',
      city: demoMessage.match(/north york|toronto|vaughan/i)?.[0] ?? 'Unknown',
      issueType: intake.issueType.replace('_', ' '),
      urgency: intake.urgency,
      status: intake.status,
      source: 'missed_call',
      estimatedValue: intake.estimatedValue,
      carTrapped: /car|vehicle/.test(demoMessage.toLowerCase()),
      preferredTime: /today/i.test(demoMessage) ? 'Today' : 'Needs time',
      summary: intake.summary,
      receivedAt: 'just now',
      lastMessage: intake.reply,
      timeline: [
        'Missed call detected by Twilio webhook.',
        'Recovery SMS generated.',
        `AI classified ${intake.issueType} with ${intake.urgency} urgency.`,
        intake.status === 'qualified' ? 'Owner summary is ready to send.' : 'Agent needs one more field.',
      ],
    }

    setLeads((current) => [demoLead, ...current])
    setSelectedLeadId(demoLead.id)
    setMetrics((current) => ({
      ...current,
      newLeads: current.newLeads + 1,
      missedCallsRecovered: current.missedCallsRecovered + 1,
      estimatedRevenue: current.estimatedRevenue + intake.estimatedValue,
      closeRate: Math.round(((current.jobsBooked + (intake.status === 'qualified' ? 1 : 0)) / (current.newLeads + 1)) * 100),
    }))
    setDemoStep(3)
    addLog('POST', '/api/twilio/call-status', '200 JSON', 'Missed-call recovery created a qualified demo lead')
    addLog('POST', '/api/ai/intake', '200 JSON', `${intake.issueType} / ${intake.urgency}`)
    setActiveView('Command')
  }

  function bookSelectedLead() {
    setLeads((current) =>
      current.map((lead) =>
        lead.id === selectedLead.id
          ? {
              ...lead,
              status: 'booked',
              preferredTime: lead.preferredTime === 'Needs time' ? 'Today 3:00-5:00' : lead.preferredTime,
              timeline: [...lead.timeline, 'Job booked from command center.'],
            }
          : lead,
      ),
    )
    setMetrics((current) => ({ ...current, jobsBooked: current.jobsBooked + 1 }))
    addLog('POST', '/api/calendar/book', '201 JSON', `${selectedLead.customerName} booked`)
  }

  function sendReviewRequest() {
    setMetrics((current) => ({ ...current, reviewsRequested: current.reviewsRequested + 1 }))
    setLeads((current) =>
      current.map((lead) =>
        lead.id === selectedLead.id
          ? { ...lead, status: 'completed', timeline: [...lead.timeline, 'Review request sent.'] }
          : lead,
      ),
    )
    addLog('POST', '/api/followups/review', '200 JSON', `Review request queued for ${selectedLead.customerName}`)
  }

  async function runProspectSearch() {
    setProspectStatus('loading')
    setProspectNote(null)
    addLog('POST', '/api/marketing/prospect', '200 JSON', `Scanning ${prospectArea} for door accounts`)
    const result = await findProspects(prospectArea)
    setProspects(result.prospects)
    setProspectSource(result.source)
    setProspectNote(result.note ?? null)
    setProspectStatus('done')
    addLog(
      'POST',
      '/api/marketing/prospect',
      '200 JSON',
      `${result.prospects.length} prospects from ${result.source === 'openstreetmap' ? 'OpenStreetMap' : 'sample set'}`,
    )
  }

  function addProspectToPipeline(prospect: Prospect) {
    if (addedProspects[prospect.id]) return
    const lead: DemoLead = {
      id: `LD-${Math.floor(4000 + Math.random() * 5999)}`,
      customerName: prospect.name,
      customerPhone: prospect.phone ?? 'No number — visit/email',
      city: prospect.city || prospectArea.split(',')[0] || prospectArea,
      issueType: prospect.category,
      urgency: 'quote',
      status: 'captured',
      source: 'outbound',
      estimatedValue: prospect.estimatedValue,
      carTrapped: false,
      preferredTime: 'Outbound — schedule intro call',
      summary: `${prospect.category}. ${prospect.signal}`,
      receivedAt: 'just now',
      lastMessage: prospect.outreach,
      timeline: [
        'Sourced by ServicePilot lead finder.',
        `Fit score ${prospect.score}/100 · ${prospect.doorEstimate}.`,
        'Outreach drafted and ready to send.',
      ],
    }
    setLeads((current) => [lead, ...current])
    setSelectedLeadId(lead.id)
    setAddedProspects((current) => ({ ...current, [prospect.id]: true }))
    setMetrics((current) => ({ ...current, newLeads: current.newLeads + 1 }))
    addLog('POST', '/api/leads', '201 JSON', `${prospect.name} added to pipeline (${money(prospect.estimatedValue)})`)
  }

  function approveException(approval: Approval) {
    setApprovals((current) => current.filter((item) => item.id !== approval.id))
    if (approval.agentId === 'dispatch') {
      setMetrics((current) => ({ ...current, jobsBooked: current.jobsBooked + 1 }))
    }
    if (approval.agentId === 'reviews') {
      setMetrics((current) => ({ ...current, reviewsRequested: current.reviewsRequested + 1 }))
    }
    addLog('POST', '/api/agents/approve', '200 JSON', `${approval.agent}: ${approval.title}`)
  }

  function renderView() {
    switch (activeView) {
      case 'Agents':
        return (
          <AgentsView
            approvals={approvals}
            approveException={approveException}
            goToDemo={() => setActiveView('Demo')}
            goToMarketing={() => setActiveView('Marketing')}
          />
        )
      case 'Demo':
        return (
          <DemoView
            demoMessage={demoMessage}
            setDemoMessage={setDemoMessage}
            runMissedCallDemo={runMissedCallDemo}
            demoStep={demoStep}
          />
        )
      case 'Marketing':
        return (
          <MarketingView
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
        )
      case 'Automations':
        return <AutomationsView />
      case 'YC':
        return (
          <YCView
            metrics={metrics}
            conversionCopy={conversionCopy}
            recoveredRevenue={recoveredRevenue}
            logs={apiLogs}
          />
        )
      case 'Settings':
        return (
          <SettingsView
            integrationKeys={integrationKeys}
            setIntegrationKeys={setIntegrationKeys}
            readyIntegrations={readyIntegrations}
          />
        )
      default:
        return (
          <CommandView
            leads={leads}
            selectedLead={selectedLead}
            metrics={metrics}
            logs={apiLogs}
            setSelectedLeadId={setSelectedLeadId}
            runMissedCallDemo={runMissedCallDemo}
            bookSelectedLead={bookSelectedLead}
            sendReviewRequest={sendReviewRequest}
            recoveredRevenue={recoveredRevenue}
          />
        )
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary navigation">
        <div className="brand">
          <img src={servicepilotMark} alt="" />
          <div>
            <strong>ServicePilot</strong>
            <span>AI growth dispatcher</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                className={activeView === item.id ? 'nav-item active' : 'nav-item'}
                onClick={() => setActiveView(item.id)}
              >
                <Icon size={17} aria-hidden="true" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="side-proof">
          <span className="eyeline">Your AI workforce</span>
          <strong>Five agents run the front desk so your crew stays on the tools.</strong>
          <div className="meter">
            <span style={{ width: `${Math.min(metrics.closeRate, 100)}%` }} />
          </div>
          <p>{conversionCopy}</p>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <span className="eyeline">{demoCompany.name} · AI front desk</span>
            <h1>The AI that runs your front desk</h1>
            <p className="hero-sub">
              ServicePilot answers missed calls, qualifies customers, books jobs, finds new accounts, and chases
              reviews — autonomously. Your team stays in control and only steps in when an agent asks.
            </p>
          </div>
          <div className="top-actions">
            <button type="button" className="ghost-button" onClick={() => setActiveView('Settings')}>
              <Webhook size={16} aria-hidden="true" />
              {readyIntegrations ? `${readyIntegrations} connected` : 'Demo mode'}
            </button>
            <button type="button" className="primary-button" onClick={() => setActiveView('Demo')}>
              <Play size={16} aria-hidden="true" />
              Watch agents work
            </button>
          </div>
        </header>

        <section className="metrics-strip" aria-label="Today metrics">
          <Metric icon={Headphones} label="Missed calls recovered" value={`${metrics.missedCallsRecovered}`} />
          <Metric icon={Truck} label="Jobs booked" value={`${metrics.jobsBooked}`} />
          <Metric icon={Database} label="Recovered revenue" value={money(metrics.estimatedRevenue)} />
          <Metric icon={Star} label="Reviews requested" value={`${metrics.reviewsRequested}`} />
        </section>

        {renderView()}
      </div>
    </div>
  )
}

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="metric">
      <Icon size={17} aria-hidden="true" />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function PanelTitle({ icon: Icon, title, action }: { icon: LucideIcon; title: string; action?: string }) {
  return (
    <div className="panel-title">
      <div>
        <Icon size={17} aria-hidden="true" />
        <h2>{title}</h2>
      </div>
      {action ? <span>{action}</span> : null}
    </div>
  )
}

function StatusChip({ children, tone }: { children: string; tone: 'good' | 'warn' | 'danger' | 'neutral' }) {
  return <span className={`status-chip ${tone}`}>{children}</span>
}

function AgentsView({
  approvals,
  approveException,
  goToDemo,
  goToMarketing,
}: {
  approvals: Approval[]
  approveException: (approval: Approval) => void
  goToDemo: () => void
  goToMarketing: () => void
}) {
  const activeCount = agents.filter((agent) => agent.status !== 'idle').length
  const handledToday = agents.reduce((sum, agent) => sum + agent.doneToday, 0)

  return (
    <motion.main
      className="agents-surface"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <section className="panel workforce">
        <div className="section-head">
          <div>
            <span className="eyeline">Always on · {handledToday} tasks handled today</span>
            <h2>Your AI workforce</h2>
          </div>
          <StatusChip tone="good">{`${activeCount} active now`}</StatusChip>
        </div>

        <div className="agent-grid">
          {agents.map((agent) => {
            const Icon = agentIcon[agent.id]
            return (
              <article className="agent-card" key={agent.id}>
                <div className="agent-card-head">
                  <div className="agent-identity">
                    <div className="agent-avatar">
                      <Icon size={18} aria-hidden="true" />
                    </div>
                    <div>
                      <strong>{agent.name}</strong>
                      <small>{agent.role}</small>
                    </div>
                  </div>
                  <span className={`agent-pill ${agent.status}`}>
                    <span className="dot" aria-hidden="true" />
                    {agentStatusLabel[agent.status]}
                  </span>
                </div>
                <p className="agent-activity">{agent.activity}</p>
                <div className="agent-foot">
                  <CheckCircle2 size={14} aria-hidden="true" />
                  <span>
                    <strong>{agent.doneToday}</strong> {agent.doneLabel} today
                  </span>
                </div>
              </article>
            )
          })}
        </div>

        <div className="agent-cta">
          <button type="button" className="primary-button" onClick={goToDemo}>
            <Play size={16} aria-hidden="true" />
            Watch an agent work
          </button>
          <button type="button" className="ghost-button" onClick={goToMarketing}>
            <Radar size={16} aria-hidden="true" />
            Send the prospector out
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </section>

      <div className="agents-aside">
        <section className="panel">
          <PanelTitle icon={Inbox} title="Needs your approval" action={`${approvals.length} waiting`} />
          {approvals.length === 0 ? (
            <div className="approval-empty">
              <CheckCircle2 size={26} aria-hidden="true" />
              <p>All clear. Your agents have nothing waiting on you right now.</p>
            </div>
          ) : (
            <div className="approval-list">
              {approvals.map((approval) => {
                const Icon = agentIcon[approval.agentId]
                return (
                  <div className="approval-row" key={approval.id}>
                    <div className="approval-top">
                      <div className="agent-avatar">
                        <Icon size={15} aria-hidden="true" />
                      </div>
                      <div className="approval-who">
                        <strong>{approval.agent}</strong>
                        <small>{approval.agentRole}</small>
                      </div>
                    </div>
                    <div>
                      <strong className="approval-title">{approval.title}</strong>
                      <p>{approval.detail}</p>
                    </div>
                    <div className="approval-actions">
                      <button type="button" className="primary-button" onClick={() => approveException(approval)}>
                        <CheckCircle2 size={14} aria-hidden="true" />
                        {approval.action}
                      </button>
                      <button type="button" className="ghost-button" onClick={() => approveException(approval)}>
                        Dismiss
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        <section className="panel">
          <PanelTitle icon={Activity} title="Autonomous activity" action="live" />
          <div className="activity-list">
            {demoActivity.map((event) => {
              const Icon = agentIcon[event.agentId]
              return (
                <div className="activity-row" key={event.id}>
                  <div className="agent-avatar">
                    <Icon size={14} aria-hidden="true" />
                  </div>
                  <p>
                    <b>{event.agent}</b> {event.text}
                  </p>
                  <time>{event.time}</time>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </motion.main>
  )
}

function CommandView({
  leads,
  selectedLead,
  metrics,
  logs,
  setSelectedLeadId,
  runMissedCallDemo,
  bookSelectedLead,
  sendReviewRequest,
  recoveredRevenue,
}: {
  leads: DemoLead[]
  selectedLead: DemoLead
  metrics: DashboardMetrics
  logs: ApiLog[]
  setSelectedLeadId: (id: string) => void
  runMissedCallDemo: () => void
  bookSelectedLead: () => void
  sendReviewRequest: () => void
  recoveredRevenue: number
}) {
  return (
    <motion.main
      className="workspace"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      <section className="lead-queue panel">
        <PanelTitle icon={ClipboardList} title="Recovered lead queue" action={`${leads.length} leads`} />
        <div className="lead-list">
          {leads.map((lead) => (
            <button
              type="button"
              key={lead.id}
              className={lead.id === selectedLead.id ? 'lead-row selected' : 'lead-row'}
              onClick={() => setSelectedLeadId(lead.id)}
            >
              <div>
                <strong>{lead.customerName}</strong>
                <span>{lead.issueType}</span>
              </div>
              <div>
                <StatusChip tone={lead.urgency === 'emergency' ? 'danger' : lead.urgency === 'same_day' ? 'warn' : 'neutral'}>
                  {lead.urgency.replace('_', ' ')}
                </StatusChip>
                <small>{lead.receivedAt}</small>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="intake panel">
        <div className="section-head">
          <div>
            <span className="eyeline">{selectedLead.id} / {selectedLead.source.replace('_', ' ')}</span>
            <h2>{selectedLead.customerName}</h2>
          </div>
          <StatusChip tone={selectedLead.status === 'booked' ? 'good' : selectedLead.status === 'qualified' ? 'warn' : 'neutral'}>
            {statusLabel(selectedLead.status)}
          </StatusChip>
        </div>

        <div className="contact-grid">
          <InfoCell icon={PhoneCall} label="Phone" value={selectedLead.customerPhone} />
          <InfoCell icon={MapPin} label="City" value={selectedLead.city} />
          <InfoCell icon={Zap} label="Urgency" value={selectedLead.urgency.replace('_', ' ')} />
          <InfoCell icon={Clock} label="Preferred time" value={selectedLead.preferredTime} />
        </div>

        <div className="summary-block">
          <span className="eyeline">AI intake summary</span>
          <p>{selectedLead.summary}</p>
        </div>

        <div className="action-grid">
          <button type="button" className="primary-button" onClick={bookSelectedLead}>
            <Calendar size={16} aria-hidden="true" />
            Book job
          </button>
          <button type="button" className="ghost-button" onClick={sendReviewRequest}>
            <Star size={16} aria-hidden="true" />
            Send review request
          </button>
          <button type="button" className="ghost-button" onClick={runMissedCallDemo}>
            <RefreshCw size={16} aria-hidden="true" />
            Simulate missed call
          </button>
        </div>

        <div className="timeline-list">
          {selectedLead.timeline.map((event, index) => (
            <div key={`${event}-${index}`} className="timeline-row">
              <span />
              <p>{event}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="agent-plan panel">
        <PanelTitle icon={Bot} title="Agent plan" action="0 to 100" />
        <div className="stage-map">
          {demoEvents.map((event, index) => (
            <div key={event.id} className={event.complete ? 'stage active' : 'stage'}>
              <span>{index + 1}</span>
              <div>
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="proof panel">
        <PanelTitle icon={Gauge} title="YC proof points" action="Week 1 target" />
        <div className="proof-grid">
          <div>
            <span>Recovered revenue</span>
            <strong>{money(recoveredRevenue)}</strong>
          </div>
          <div>
            <span>Response speed</span>
            <strong>{metrics.responseTimeSeconds}s</strong>
          </div>
          <div>
            <span>Close rate</span>
            <strong>{metrics.closeRate}%</strong>
          </div>
        </div>
      </section>

      <section className="api-log panel">
        <PanelTitle icon={Webhook} title="Integration log" action="live surface" />
        <div className="log-list">
          {logs.map((log) => (
            <div className="log-row" key={log.id}>
              <span>{log.method}</span>
              <div>
                <strong>{log.path}</strong>
                <small>{log.detail}</small>
              </div>
              <em>{log.status}</em>
            </div>
          ))}
        </div>
      </section>
    </motion.main>
  )
}

function InfoCell({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="info-cell">
      <Icon size={15} aria-hidden="true" />
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
    </div>
  )
}

function DemoView({
  demoMessage,
  setDemoMessage,
  runMissedCallDemo,
  demoStep,
}: {
  demoMessage: string
  setDemoMessage: (value: string) => void
  runMissedCallDemo: () => void
  demoStep: number
}) {
  const intake = classifyIntake(demoMessage)

  return (
    <motion.main className="single-surface" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <section className="panel demo-panel">
        <div className="section-head">
          <div>
            <span className="eyeline">Investor demo</span>
            <h2>Missed-call recovery simulator</h2>
          </div>
          <StatusChip tone="good">No keys required</StatusChip>
        </div>

        <div className="call-scene">
          <div className="phone-card">
            <PhoneCall size={22} aria-hidden="true" />
            <strong>Missed call</strong>
            <span>+1 416 555 0110</span>
          </div>
          <div className="flow-line" />
          <div className="phone-card active">
            <MessageSquare size={22} aria-hidden="true" />
            <strong>AI SMS</strong>
            <span>{intake.reply}</span>
          </div>
        </div>

        <label className="demo-input">
          <span>Customer reply</span>
          <textarea value={demoMessage} onChange={(event) => setDemoMessage(event.target.value)} rows={4} />
        </label>

        <div className="classifier-output">
          <div>
            <span>Issue</span>
            <strong>{intake.issueType.replace('_', ' ')}</strong>
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
            <span>Estimate</span>
            <strong>{money(intake.estimatedValue)}</strong>
          </div>
        </div>

        <button type="button" className="primary-button wide" onClick={runMissedCallDemo}>
          <Play size={16} aria-hidden="true" />
          Run this as a recovered lead
        </button>
      </section>

      <section className="panel">
        <PanelTitle icon={Sparkles} title="Demo script" action={`step ${demoStep}/4`} />
        <div className="script-list">
          {[
            'Customer calls after garage door gets stuck.',
            'Owner misses call while on a job.',
            'ServicePilot texts back and qualifies the job.',
            'Owner gets a clean summary and books the work.',
          ].map((item, index) => (
            <div key={item} className={index < demoStep ? 'script-row done' : 'script-row'}>
              <CheckCircle2 size={17} aria-hidden="true" />
              <p>{item}</p>
            </div>
          ))}
        </div>
      </section>
    </motion.main>
  )
}

const segmentIcon: Record<Prospect['segment'], LucideIcon> = {
  fire_station: ShieldCheck,
  storage: Database,
  dealership: Truck,
  warehouse: Building2,
  auto_repair: Settings,
  home_improvement: ClipboardList,
  fuel: Zap,
  commercial: Building2,
}

function MarketingView({
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
  const pipelineValue = prospects.reduce((sum, prospect) => sum + prospect.estimatedValue, 0)
  const loading = prospectStatus === 'loading'

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!loading) runProspectSearch()
  }

  return (
    <motion.main className="single-surface" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <section className="panel lead-finder">
        <div className="section-head">
          <div>
            <span className="eyeline">Outbound marketing agent</span>
            <h2>Find local door accounts</h2>
          </div>
          <StatusChip tone="good">Live data</StatusChip>
        </div>

        <form className="finder-form" onSubmit={submit}>
          <label className="finder-input">
            <MapPin size={16} aria-hidden="true" />
            <input
              value={prospectArea}
              onChange={(event) => setProspectArea(event.target.value)}
              placeholder="City or service area, e.g. North York, Toronto"
              aria-label="Service area to prospect"
            />
          </label>
          <button type="submit" className="primary-button" disabled={loading}>
            {loading ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
            {loading ? 'Scanning…' : 'Find leads'}
          </button>
        </form>

        <p className="finder-hint">
          The agent geocodes your area and scans OpenStreetMap for real businesses that own overhead, bay, and roll-up
          doors — auto shops, dealerships, storage, warehouses, and fire stations — then scores each as an outbound
          account and drafts the first message.
        </p>

        {prospectStatus === 'done' && (
          <div className="finder-summary">
            <div>
              <span>Prospects found</span>
              <strong>{prospects.length}</strong>
            </div>
            <div>
              <span>Pipeline value</span>
              <strong>{money(pipelineValue)}</strong>
            </div>
            <div>
              <span>Source</span>
              <strong>{prospectSource === 'openstreetmap' ? 'OpenStreetMap' : 'Sample set'}</strong>
            </div>
          </div>
        )}

        {prospectNote && <p className="finder-note">{prospectNote}</p>}

        {prospectStatus === 'idle' && (
          <div className="finder-empty">
            <Radar size={26} aria-hidden="true" />
            <p>Enter a service area and run the agent to surface real commercial door accounts near you.</p>
          </div>
        )}

        {loading && (
          <div className="finder-empty">
            <Loader2 size={26} className="spin" aria-hidden="true" />
            <p>Scanning {prospectArea} for businesses with garage, bay, and loading-dock doors…</p>
          </div>
        )}

        {prospectStatus === 'done' && prospects.length > 0 && (
          <div className="prospect-list">
            {prospects.map((prospect) => {
              const Icon = segmentIcon[prospect.segment] ?? Building2
              const added = Boolean(addedProspects[prospect.id])
              return (
                <article className="prospect-card" key={prospect.id}>
                  <div className="prospect-head">
                    <div className="prospect-id">
                      <Icon size={17} aria-hidden="true" />
                      <div>
                        <strong>{prospect.name}</strong>
                        <small>
                          {prospect.category}
                          {prospect.address ? ` · ${prospect.address}` : ''}
                          {prospect.city ? `, ${prospect.city}` : ''}
                        </small>
                      </div>
                    </div>
                    <span className="score-badge" aria-label={`Fit score ${prospect.score} of 100`}>
                      <TrendingUp size={13} aria-hidden="true" />
                      {prospect.score}
                    </span>
                  </div>

                  <div className="prospect-meta">
                    <span>{prospect.doorEstimate}</span>
                    <span>{money(prospect.estimatedValue)}/yr potential</span>
                  </div>

                  <p className="prospect-signal">{prospect.signal}</p>

                  <div className="outreach-box">
                    <span className="eyeline">Drafted outreach</span>
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
                      {added ? 'In pipeline' : 'Add to pipeline'}
                    </button>
                    {prospect.website && (
                      <a className="ghost-button" href={prospect.website} target="_blank" rel="noreferrer">
                        <ExternalLink size={15} aria-hidden="true" />
                        Visit site
                      </a>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {prospectStatus === 'done' && prospects.length === 0 && (
          <div className="finder-empty">
            <Search size={26} aria-hidden="true" />
            <p>No commercial door accounts found here. Try a larger city or a nearby area.</p>
          </div>
        )}
      </section>

      <section className="panel">
        <PanelTitle icon={Send} title="How the agent works" action="real source" />
        <div className="stage-map">
          {[
            { title: 'Geocode the area', detail: 'Nominatim turns your service area into a precise map location.' },
            { title: 'Scan for door accounts', detail: 'Overpass finds real businesses with overhead, bay, and roll-up doors nearby.' },
            { title: 'Score & draft', detail: 'Each prospect is scored for fit and given a ready-to-send first message.' },
            { title: 'Add to pipeline', detail: 'One click pushes the account into your lead queue to work like any other.' },
          ].map((step, index) => (
            <div key={step.title} className="stage active">
              <span>{index + 1}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="guardrail-list">
          <p>Targets commercial accounts that own real, serviceable doors.</p>
          <p>No API keys required — runs on free OpenStreetMap data.</p>
          <p>Outbound leads flow into the same queue, booking, and review loop.</p>
        </div>
      </section>
    </motion.main>
  )
}

function AutomationsView() {
  return (
    <motion.main className="single-surface" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <section className="panel wide-panel">
        <div className="section-head">
          <div>
            <span className="eyeline">Dispatcher + marketing</span>
            <h2>Launch automations</h2>
          </div>
          <StatusChip tone="good">4 active</StatusChip>
        </div>

        <div className="rule-table">
          {automations.map((automation) => (
            <div className="rule-row" key={automation.title}>
              <span>{automation.enabled ? 'On' : 'Off'}</span>
              <div>
                <strong>{automation.title}</strong>
                <small>{automation.trigger}</small>
                <p>{automation.output}</p>
              </div>
              <em>{automation.endpoint}</em>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={ShieldCheck} title="Guardrails" action="MVP safe" />
        <div className="guardrail-list">
          <p>Ask one short question at a time.</p>
          <p>Do not give final prices.</p>
          <p>Do not guarantee a technician until booking confirms availability.</p>
          <p>Keep customer-facing sends human-reviewable in settings.</p>
        </div>
      </section>
    </motion.main>
  )
}

function YCView({
  metrics,
  conversionCopy,
  recoveredRevenue,
  logs,
}: {
  metrics: DashboardMetrics
  conversionCopy: string
  recoveredRevenue: number
  logs: ApiLog[]
}) {
  return (
    <motion.main className="single-surface yc-surface" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <section className="panel wide-panel">
        <div className="pitch-hero">
          <img src={servicepilotMark} alt="" />
          <div>
            <span className="eyeline">YC application narrative</span>
            <h2>AI Growth Dispatcher for Garage Door Companies</h2>
            <p>
              Small service businesses lose high-intent calls while technicians are on jobs. ServicePilot turns missed calls into
              qualified SMS conversations, booked jobs, and review requests.
            </p>
          </div>
        </div>

        <div className="proof-grid large">
          <div>
            <span>Wedge</span>
            <strong>Missed-call recovery</strong>
          </div>
          <div>
            <span>ICP</span>
            <strong>Garage doors first</strong>
          </div>
          <div>
            <span>Value captured</span>
            <strong>{money(recoveredRevenue)}</strong>
          </div>
          <div>
            <span>Operating proof</span>
            <strong>{conversionCopy}</strong>
          </div>
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={FileText} title="Application bullets" action="ready" />
        <div className="bullet-list">
          <p>What we build: a Twilio-powered AI SMS agent that recovers missed calls and qualifies garage-door leads.</p>
          <p>Why now: local service companies are paying for calls but missing them during field work.</p>
          <p>Why wedge works: one urgent missed call can be worth hundreds of dollars and is easy to measure.</p>
          <p>Next proof: onboard 2-3 companies, track recovered jobs, revenue, and review lift.</p>
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={Webhook} title="API evidence" action={`${logs.length} events`} />
        <div className="log-list compact">
          {logs.slice(0, 4).map((log) => (
            <div className="log-row" key={log.id}>
              <span>{log.method}</span>
              <div>
                <strong>{log.path}</strong>
                <small>{log.detail}</small>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={Gauge} title="Current demo metrics" action={money(metrics.estimatedRevenue)} />
        <div className="context-stack">
          <InfoCell icon={Headphones} label="New leads" value={`${metrics.newLeads}`} />
          <InfoCell icon={Truck} label="Booked jobs" value={`${metrics.jobsBooked}`} />
          <InfoCell icon={Star} label="Reviews requested" value={`${metrics.reviewsRequested}`} />
        </div>
      </section>
    </motion.main>
  )
}

function SettingsView({
  integrationKeys,
  setIntegrationKeys,
  readyIntegrations,
}: {
  integrationKeys: Record<string, string>
  setIntegrationKeys: (keys: Record<string, string>) => void
  readyIntegrations: number
}) {
  return (
    <motion.main className="single-surface" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <section className="panel wide-panel">
        <div className="section-head">
          <div>
            <span className="eyeline">Production setup</span>
            <h2>API keys and webhooks</h2>
          </div>
          <StatusChip tone={readyIntegrations ? 'good' : 'neutral'}>
            {readyIntegrations ? `${readyIntegrations} staged` : 'Demo mode'}
          </StatusChip>
        </div>

        <div className="integration-list">
          {integrations.map((integration) => {
            const Icon = integration.icon
            const firstKey = integration.env[0]
            return (
              <label key={integration.id} className="integration-row">
                <Icon size={18} aria-hidden="true" />
                <div>
                  <strong>{integration.name}</strong>
                  <small>{integration.purpose}</small>
                  <code>{integration.env.join(', ')}</code>
                </div>
                <input
                  value={integrationKeys[firstKey] ?? ''}
                  onChange={(event) => setIntegrationKeys({ ...integrationKeys, [firstKey]: event.target.value })}
                  placeholder={`${firstKey} value`}
                  type="password"
                />
              </label>
            )
          })}
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={Webhook} title="Webhook routes" action="Netlify" />
        <div className="endpoint-list">
          {endpointRows.map(([method, path, detail]) => (
            <div className="endpoint-row" key={path}>
              <span>{method}</span>
              <strong>{path}</strong>
              <small>{detail}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <PanelTitle icon={KeyRound} title="Launch checklist" action="keys later" />
        <div className="guardrail-list">
          <p>Run Supabase migration in your project.</p>
          <p>Set Netlify environment variables from `.env.example`.</p>
          <p>Point Twilio voice webhook to `/api/twilio/inbound-call`.</p>
          <p>Point Twilio messaging webhook to `/api/twilio/inbound-sms`.</p>
        </div>
      </section>
    </motion.main>
  )
}

export default App
