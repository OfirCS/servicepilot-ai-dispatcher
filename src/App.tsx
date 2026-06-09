import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  ArrowRight,
  Boxes,
  Brain,
  Building2,
  Car,
  CheckCircle2,
  Dumbbell,
  Globe,
  GraduationCap,
  Landmark,
  LineChart,
  Loader2,
  MapPin,
  Pause,
  PenLine,
  Phone,
  Play,
  Plus,
  Radar,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Trophy,
  Warehouse,
  X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatAgo, metrics, useEngine } from './lib/engine'
import type { Account, AgentId, Segment, Stage, Tier } from './lib/types'
import './App.css'

function money(value: number) {
  if (value >= 1000) return `$${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k`
  return `$${Math.round(value)}`
}

const agentIcon: Record<AgentId, LucideIcon> = {
  scout: Radar,
  qualifier: Target,
  writer: PenLine,
  closer: Send,
  analyst: LineChart,
}

const segmentIcon: Record<Segment, LucideIcon> = {
  property_management: Building2,
  apartments: Building2,
  hotel: Building2,
  hospital: Plus,
  university: GraduationCap,
  school: GraduationCap,
  government: Landmark,
  dealership: Car,
  storage: Boxes,
  mall_retail: ShoppingBag,
  bank: Landmark,
  warehouse: Warehouse,
  gym: Dumbbell,
  office: Building2,
  commercial: Building2,
}

const stageLabel: Record<Stage, string> = {
  discovered: 'Found',
  qualified: 'Qualified',
  ready: 'Ready to send',
  contacted: 'Contacted',
  won: 'Won',
  passed: 'Passed',
}

const tierTone: Record<Tier, 'gold' | 'blue' | 'grey'> = { A: 'gold', B: 'blue', C: 'grey' }

type Filter = 'all' | 'A' | 'ready' | 'contacted' | 'won'

function App() {
  const { state, clock, actions } = useEngine()
  const m = useMemo(() => metrics(state), [state])
  const [drawer, setDrawer] = useState<'settings' | string | null>(null) // string = accountId
  const [filter, setFilter] = useState<Filter>('all')
  const [territoryInput, setTerritoryInput] = useState('')

  const selected = typeof drawer === 'string' ? state.accounts.find((a) => a.id === drawer) ?? null : null

  const visible = useMemo(() => {
    const ranked = [...state.accounts].sort((a, b) => {
      const stageRank = (x: Account) => ['ready', 'qualified', 'contacted', 'won', 'discovered', 'passed'].indexOf(x.stage)
      if (a.stage !== b.stage) return stageRank(a) - stageRank(b)
      return b.score - a.score
    })
    if (filter === 'all') return ranked.filter((a) => a.stage !== 'passed')
    if (filter === 'A') return ranked.filter((a) => a.tier === 'A' && a.stage !== 'passed' && a.stage !== 'discovered')
    if (filter === 'ready') return ranked.filter((a) => a.stage === 'ready')
    if (filter === 'contacted') return ranked.filter((a) => a.stage === 'contacted')
    return ranked.filter((a) => a.stage === 'won')
  }, [state.accounts, filter])

  const scanning = state.territories.some((t) => t.status === 'scanning')

  function submitTerritory(e: FormEvent) {
    e.preventDefault()
    if (!territoryInput.trim()) return
    actions.addTerritory(territoryInput)
    setTerritoryInput('')
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">
            <Radar size={20} aria-hidden="true" />
          </span>
          <div className="brand-text">
            <strong>ServicePilot</strong>
            <span>{state.settings.companyName}</span>
          </div>
        </div>

        <div className="top-actions">
          <div className="seg" role="group" aria-label="Autonomy">
            <button
              type="button"
              className={state.settings.autonomy === 'ask' ? 'seg-btn on' : 'seg-btn'}
              onClick={() => actions.updateSettings({ autonomy: 'ask' })}
            >
              Ask first
            </button>
            <button
              type="button"
              className={state.settings.autonomy === 'auto' ? 'seg-btn on' : 'seg-btn'}
              onClick={() => actions.updateSettings({ autonomy: 'auto' })}
            >
              Full auto
            </button>
          </div>
          <button
            type="button"
            className={state.running ? 'run-btn on' : 'run-btn'}
            onClick={actions.toggle}
          >
            {state.running ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
            {state.running ? 'Agents running' : 'Start agents'}
          </button>
          <button type="button" className="icon-button" onClick={() => setDrawer('settings')} aria-label="Settings">
            <Settings size={18} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="board">
        <section className="hello">
          <div>
            <span className="eyeline">Autonomous commercial lead engine</span>
            <h1>
              {state.running ? 'Your agents are working the map' : 'Put your sales team on autopilot'}
              {state.settings.llmEnabled && state.settings.apiKey ? ' · Claude-powered' : ''}
            </h1>
            <p className="hello-sub">
              Five AI agents scan real territories, qualify every commercial account, score its value, and draft the
              first touch — so {state.settings.leaderName} only steps in to approve.
            </p>
          </div>
          <div className="kpis">
            <Kpi icon={TrendingUp} label="Pipeline value" value={money(m.pipelineValue)} accent />
            <Kpi icon={Target} label="A-tier accounts" value={`${m.aTier}`} />
            <Kpi icon={Building2} label="Accounts found" value={`${m.discovered}`} />
            <Kpi icon={Trophy} label="Won / yr" value={money(m.wonValue)} />
          </div>
        </section>

        <Funnel m={m} />

        <div className="grid">
          <div className="col-main">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Territories</h2>
                  <p>Add a city or area and the Scout goes to work on real map data.</p>
                </div>
                <span className="count-pill subtle">
                  {m.territoriesCovered}/{m.territoriesTotal}
                </span>
              </div>
              <form className="terr-form" onSubmit={submitTerritory}>
                <span className="terr-input">
                  <MapPin size={15} aria-hidden="true" />
                  <input
                    value={territoryInput}
                    onChange={(e) => setTerritoryInput(e.target.value)}
                    placeholder="Add a territory, e.g. Dallas, TX"
                    aria-label="Add a territory"
                  />
                </span>
                <button type="submit" className="primary-button">
                  <Plus size={15} aria-hidden="true" />
                  Send scout
                </button>
              </form>
              <div className="terr-list">
                {state.territories.map((t) => (
                  <div className="terr" key={t.name}>
                    <span className={`terr-dot ${t.status}`} aria-hidden="true" />
                    <div className="terr-main">
                      <strong>{t.name}</strong>
                      <small>
                        {t.status === 'scanning'
                          ? 'Scanning…'
                          : t.status === 'covered'
                            ? `${t.found} accounts found`
                            : t.status === 'error'
                              ? 'Scan failed'
                              : 'Queued'}
                      </small>
                    </div>
                    <button type="button" className="mini-button" onClick={() => actions.rescanTerritory(t.name)} aria-label={`Rescan ${t.name}`}>
                      <RefreshCw size={13} aria-hidden="true" />
                    </button>
                    <button type="button" className="mini-button" onClick={() => actions.removeTerritory(t.name)} aria-label={`Remove ${t.name}`}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Pipeline</h2>
                  <p>Every account the agents found and scored. Tap one to see the plan.</p>
                </div>
                <div className="filters">
                  {(['all', 'A', 'ready', 'contacted', 'won'] as Filter[]).map((f) => (
                    <button key={f} type="button" className={filter === f ? 'filter on' : 'filter'} onClick={() => setFilter(f)}>
                      {f === 'all' ? 'All' : f === 'A' ? 'A-tier' : f === 'ready' ? 'Ready' : f === 'contacted' ? 'Contacted' : 'Won'}
                    </button>
                  ))}
                </div>
              </div>

              {visible.length === 0 ? (
                scanning ? (
                  <SkeletonList />
                ) : (
                  <EngineEmpty running={state.running} scanning={scanning} onStart={actions.start} />
                )
              ) : (
                <div className="acct-list">
                  {visible.map((a) => {
                    const Icon = segmentIcon[a.segment] ?? Building2
                    return (
                      <button type="button" className="acct" key={a.id} onClick={() => setDrawer(a.id)}>
                        <span className="avatar">
                          <Icon size={16} aria-hidden="true" />
                        </span>
                        <div className="acct-main">
                          <strong>{a.name}</strong>
                          <small>
                            {a.category} · {a.sizeLabel}
                            {a.city ? ` · ${a.city}` : ''}
                          </small>
                        </div>
                        <div className="acct-meta">
                          {a.score > 0 && <span className={`tier ${tierTone[a.tier]}`}>{a.tier}</span>}
                          <span className="acct-acv">{a.acv ? `${money(a.acv)}/yr` : '—'}</span>
                          <span className={`stage ${a.stage}`}>{stageLabel[a.stage]}</span>
                        </div>
                        <ArrowRight size={15} className="acct-arrow" aria-hidden="true" />
                      </button>
                    )
                  })}
                </div>
              )}
            </section>
          </div>

          <div className="col-side">
            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Your AI team</h2>
                  <p>Five agents, always on.</p>
                </div>
                <span className={state.running ? 'live-dot' : 'live-dot off'} aria-hidden="true" />
              </div>
              <div className="agent-list">
                {(Object.keys(state.agents) as AgentId[]).map((id) => {
                  const agent = state.agents[id]
                  const Icon = agentIcon[id]
                  return (
                    <div className="agent" key={id}>
                      <span className="avatar">
                        <Icon size={16} aria-hidden="true" />
                      </span>
                      <div className="agent-info">
                        <div className="agent-line">
                          <strong>{agent.name}</strong>
                          <span className={`agent-status ${agent.status}`}>
                            <span className="dot" aria-hidden="true" />
                            {agent.status === 'working' ? 'Working' : agent.status === 'blocked' ? 'Blocked' : 'Ready'}
                          </span>
                        </div>
                        <small>{agent.role}</small>
                        <p>{agent.task}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Needs your OK</h2>
                  <p>Agents pause here for a human call.</p>
                </div>
                <span className="count-pill">{state.approvals.length}</span>
              </div>
              {state.approvals.length === 0 ? (
                <div className="empty good">
                  <CheckCircle2 size={24} aria-hidden="true" />
                  <p>Nothing waiting. {state.settings.autonomy === 'auto' ? 'Full-auto is on — agents proceed on their own.' : 'Agents will queue outreach here for approval.'}</p>
                </div>
              ) : (
                <div className="approval-list">
                  {state.approvals.slice(0, 6).map((ap) => (
                    <article className="approval" key={ap.id}>
                      <div className="approval-body">
                        <strong>{ap.title}</strong>
                        <p>{ap.detail}</p>
                      </div>
                      <div className="approval-actions">
                        <button type="button" className="primary-button" onClick={() => actions.approve(ap.id)}>
                          <CheckCircle2 size={14} aria-hidden="true" />
                          {ap.action}
                        </button>
                        <button type="button" className="text-button" onClick={() => actions.dismiss(ap.id)}>
                          Pass
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="card">
              <div className="card-head">
                <div>
                  <h2>Live activity</h2>
                  <p>What the agents did on their own.</p>
                </div>
                <Activity size={16} className="muted-icon" aria-hidden="true" />
              </div>
              <div className="activity-list">
                {state.activity.length === 0 && <p className="activity-empty">Start the agents to see them work.</p>}
                <AnimatePresence initial={false}>
                  {state.activity.slice(0, 9).map((ev) => {
                    const Icon = agentIcon[ev.agentId]
                    return (
                      <motion.div
                        className="activity"
                        key={ev.id}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <span className="avatar small">
                          <Icon size={12} aria-hidden="true" />
                        </span>
                        <p>
                          <b>{state.agents[ev.agentId].name}</b> {ev.text}
                        </p>
                        <time>{formatAgo(ev.at, clock)}</time>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            </section>
          </div>
        </div>

        {state.lastError && (
          <p className="banner">
            <Sparkles size={14} aria-hidden="true" /> {state.lastError}
          </p>
        )}
      </main>

      <AnimatePresence>
        {drawer && (
          <Drawer onClose={() => setDrawer(null)}>
            {drawer === 'settings' ? (
              <SettingsPanel
                settings={state.settings}
                update={actions.updateSettings}
                reset={() => {
                  actions.reset()
                  setDrawer(null)
                }}
              />
            ) : selected ? (
              <AccountPanel account={selected} actions={actions} onClose={() => setDrawer(null)} />
            ) : null}
          </Drawer>
        )}
      </AnimatePresence>
    </div>
  )
}

function Kpi({ icon: Icon, label, value, accent }: { icon: LucideIcon; label: string; value: string; accent?: boolean }) {
  return (
    <div className={accent ? 'kpi accent' : 'kpi'}>
      <Icon size={15} aria-hidden="true" />
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  )
}

function Funnel({ m }: { m: ReturnType<typeof metrics> }) {
  const stages = [
    { label: 'Found', value: m.discovered, icon: Building2 },
    { label: 'Qualified', value: m.qualified, icon: Target },
    { label: 'Ready', value: m.ready, icon: PenLine },
    { label: 'Contacted', value: m.contacted, icon: Send },
    { label: 'Won', value: m.won, icon: Trophy },
  ]
  return (
    <section className="funnel">
      {stages.map((s, i) => {
        const Icon = s.icon
        return (
          <div className="funnel-stage" key={s.label}>
            <Icon size={15} aria-hidden="true" />
            <strong>{s.value}</strong>
            <span>{s.label}</span>
            {i < stages.length - 1 && <ArrowRight size={14} className="funnel-arrow" aria-hidden="true" />}
          </div>
        )
      })}
    </section>
  )
}

function SkeletonList() {
  return (
    <div className="skeleton-list" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div className="sk-row" key={i}>
          <div className="sk sk-avatar" />
          <div className="sk-lines">
            <div className="sk sk-line" />
            <div className="sk sk-line short" />
          </div>
          <div className="sk sk-pill" />
        </div>
      ))}
    </div>
  )
}

function EngineEmpty({ running, scanning, onStart }: { running: boolean; scanning: boolean; onStart: () => void }) {
  if (scanning || running) {
    return (
      <div className="empty">
        <Loader2 size={26} className="spin" aria-hidden="true" />
        <p>{scanning ? 'The Scout is scanning real map data for commercial accounts…' : 'Agents are working — accounts will appear here as they qualify them.'}</p>
      </div>
    )
  }
  return (
    <div className="empty">
      <Radar size={26} aria-hidden="true" />
      <p>The engine is paused. Start the agents and they’ll fill this pipeline with real accounts.</p>
      <button type="button" className="primary-button" onClick={onStart}>
        <Play size={15} aria-hidden="true" />
        Start the agents
      </button>
    </div>
  )
}

function Drawer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <motion.div className="scrim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.aside
        className="drawer"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="drawer-close" onClick={onClose} aria-label="Close">
          <X size={18} aria-hidden="true" />
        </button>
        {children}
      </motion.aside>
    </motion.div>
  )
}

function AccountPanel({
  account,
  actions,
  onClose,
}: {
  account: Account
  actions: ReturnType<typeof useEngine>['actions']
  onClose: () => void
}) {
  const Icon = segmentIcon[account.segment] ?? Building2
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="eyeline">
          {account.category} · {account.territory}
        </span>
        <div className="acct-title">
          <span className="avatar lg">
            <Icon size={20} aria-hidden="true" />
          </span>
          <div>
            <h2>{account.name}</h2>
            <div className="acct-title-meta">
              {account.score > 0 && <span className={`tier ${tierTone[account.tier]}`}>{account.tier}-tier</span>}
              <span className={`stage ${account.stage}`}>{stageLabel[account.stage]}</span>
              <span className="score-line">
                <TrendingUp size={12} aria-hidden="true" /> {account.score || '—'}/100
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="acct-value">
        <div>
          <span>Est. annual value</span>
          <strong>${account.acv.toLocaleString()}</strong>
        </div>
        <div>
          <span>Size signal</span>
          <strong>{account.sizeLabel}</strong>
        </div>
      </div>

      <div className="need-box">
        <span className="eyeline">What they need</span>
        <p>{account.need || 'Pending qualification…'}</p>
      </div>

      {account.reasons.length > 0 && (
        <div className="reasons">
          <span className="eyeline">Why the agent scored it</span>
          {account.reasons.map((r, i) => (
            <div className="reason" key={i}>
              <CheckCircle2 size={14} aria-hidden="true" />
              <p>{r}</p>
            </div>
          ))}
        </div>
      )}

      {account.insight && (
        <div className="insight">
          <Brain size={15} aria-hidden="true" />
          <p>{account.insight}</p>
        </div>
      )}

      {account.outreach ? (
        <div className="draft">
          <span className="eyeline">
            Drafted first touch {account.draftedByLLM ? '· by Claude' : ''}
          </span>
          <p>{account.outreach}</p>
        </div>
      ) : (
        <div className="draft pending">
          <Loader2 size={15} className="spin" aria-hidden="true" />
          <p>The writer hasn’t drafted this one yet.</p>
        </div>
      )}

      <div className="contact-row">
        {account.phone && (
          <a className="ghost-button" href={`tel:${account.phone}`}>
            <Phone size={14} aria-hidden="true" /> {account.phone}
          </a>
        )}
        {account.website && (
          <a className="ghost-button" href={account.website} target="_blank" rel="noreferrer">
            <Globe size={14} aria-hidden="true" /> Website
          </a>
        )}
        {account.lat && account.lon && (
          <a className="ghost-button" href={`https://www.openstreetmap.org/?mlat=${account.lat}&mlon=${account.lon}#map=18/${account.lat}/${account.lon}`} target="_blank" rel="noreferrer">
            <MapPin size={14} aria-hidden="true" /> Map
          </a>
        )}
      </div>

      <div className="panel-actions">
        {account.stage === 'ready' && (
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              actions.setStage(account.id, 'contacted')
              onClose()
            }}
          >
            <Send size={15} aria-hidden="true" /> Mark contacted
          </button>
        )}
        {account.stage !== 'won' && (
          <button
            type="button"
            className="primary-button gold"
            onClick={() => {
              actions.setStage(account.id, 'won')
              onClose()
            }}
          >
            <Trophy size={15} aria-hidden="true" /> Mark won
          </button>
        )}
        <button
          type="button"
          className="ghost-button"
          onClick={() => {
            actions.setStage(account.id, 'passed')
            onClose()
          }}
        >
          Pass
        </button>
      </div>
    </div>
  )
}

function SettingsPanel({
  settings,
  update,
  reset,
}: {
  settings: ReturnType<typeof useEngine>['state']['settings']
  update: ReturnType<typeof useEngine>['actions']['updateSettings']
  reset: () => void
}) {
  return (
    <div className="panel">
      <div className="panel-head">
        <span className="eyeline">Setup</span>
        <h2>Configure your engine</h2>
        <p>Set your company, how much rope the agents get, and optional Claude reasoning.</p>
      </div>

      <label className="field">
        <span>Company name</span>
        <input value={settings.companyName} onChange={(e) => update({ companyName: e.target.value })} />
      </label>
      <label className="field">
        <span>Your name (sales leader)</span>
        <input value={settings.leaderName} onChange={(e) => update({ leaderName: e.target.value })} />
      </label>

      <div className="field">
        <span>Autonomy</span>
        <div className="seg wide">
          <button type="button" className={settings.autonomy === 'ask' ? 'seg-btn on' : 'seg-btn'} onClick={() => update({ autonomy: 'ask' })}>
            Ask me first
          </button>
          <button type="button" className={settings.autonomy === 'auto' ? 'seg-btn on' : 'seg-btn'} onClick={() => update({ autonomy: 'auto' })}>
            Full auto
          </button>
        </div>
      </div>

      <div className="llm-card">
        <div className="llm-head">
          <div>
            <strong><Brain size={15} aria-hidden="true" /> Claude reasoning</strong>
            <small>Let agents write outreach and angles with real AI. Your key stays in this browser.</small>
          </div>
          <button
            type="button"
            className={settings.llmEnabled ? 'switch on' : 'switch'}
            onClick={() => update({ llmEnabled: !settings.llmEnabled })}
            aria-pressed={settings.llmEnabled}
          >
            <span />
          </button>
        </div>
        {settings.llmEnabled && (
          <>
            <label className="field tight">
              <span>Anthropic API key</span>
              <input type="password" value={settings.apiKey} onChange={(e) => update({ apiKey: e.target.value })} placeholder="sk-ant-..." />
            </label>
            <label className="field tight">
              <span>Model</span>
              <select value={settings.model} onChange={(e) => update({ model: e.target.value })}>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (fast)</option>
                <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (sharper)</option>
              </select>
            </label>
            <p className="key-note">Stored only in your browser’s localStorage. Without a key, agents use a strong built-in writer.</p>
          </>
        )}
      </div>

      <div className="guarantee">
        <ShieldCheck size={16} aria-hidden="true" />
        <p>No data leaves your browser except the live map lookups and (if enabled) your own Claude calls.</p>
      </div>

      <button type="button" className="ghost-button danger wide" onClick={reset}>
        <RefreshCw size={14} aria-hidden="true" /> Reset pipeline & rescan
      </button>
    </div>
  )
}

export default App
