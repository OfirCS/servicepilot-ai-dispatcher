import { useCallback, useEffect, useRef, useState } from 'react'
import { draftInsight, draftOutreach, qualify } from './agents'
import { scanTerritory } from './osm'
import type {
  Account,
  Agent,
  AgentId,
  ActivityEvent,
  Approval,
  EngineState,
  Settings,
  Stage,
  Territory,
} from './types'

const STORAGE_KEY = 'servicepilot.engine.v1'
const TICK_MS = 1500

let seq = 0
const uid = (p: string) => `${p}-${(seq += 1).toString(36)}-${(now() % 100000).toString(36)}`
function now() {
  return Date.now()
}

const AGENTS: Record<AgentId, Agent> = {
  scout: { id: 'scout', name: 'Scout', role: 'Finds accounts', status: 'idle', task: 'Ready to scan a territory.', done: 0, doneLabel: 'accounts found' },
  qualifier: { id: 'qualifier', name: 'Quinn', role: 'Qualifies & scores', status: 'idle', task: 'Waiting for new accounts.', done: 0, doneLabel: 'accounts scored' },
  writer: { id: 'writer', name: 'Wren', role: 'Writes outreach', status: 'idle', task: 'Waiting for qualified accounts.', done: 0, doneLabel: 'messages drafted' },
  closer: { id: 'closer', name: 'Cole', role: 'Starts outreach', status: 'idle', task: 'Waiting for approvals.', done: 0, doneLabel: 'accounts contacted' },
  analyst: { id: 'analyst', name: 'Ada', role: 'Watches the pipeline', status: 'idle', task: 'Monitoring coverage and value.', done: 0, doneLabel: 'reports' },
}

const DEFAULT_SETTINGS: Settings = {
  companyName: 'Fortress Lock & Security',
  leaderName: 'Alex',
  autonomy: 'ask',
  llmEnabled: false,
  apiKey: '',
  model: 'claude-haiku-4-5-20251001',
}

const DEFAULT_TERRITORIES: Territory[] = [{ name: 'Austin, TX', status: 'pending', found: 0 }]

function freshState(): EngineState {
  return {
    running: false,
    territories: DEFAULT_TERRITORIES,
    accounts: [],
    activity: [],
    approvals: [],
    agents: { ...AGENTS },
    settings: DEFAULT_SETTINGS,
    lastError: null,
  }
}

type Persisted = Pick<EngineState, 'territories' | 'accounts' | 'activity' | 'approvals' | 'settings' | 'running'>

function load(): EngineState {
  if (typeof localStorage === 'undefined') return freshState()
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    const p = JSON.parse(raw) as Persisted
    return {
      ...freshState(),
      territories: p.territories?.length ? p.territories : DEFAULT_TERRITORIES,
      accounts: p.accounts ?? [],
      activity: p.activity ?? [],
      approvals: p.approvals ?? [],
      settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
      running: p.running ?? false,
    }
  } catch {
    return freshState()
  }
}

function save(s: EngineState) {
  if (typeof localStorage === 'undefined') return
  const p: Persisted = {
    territories: s.territories,
    accounts: s.accounts,
    activity: s.activity.slice(0, 60),
    approvals: s.approvals,
    settings: s.settings,
    running: s.running,
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // ignore quota errors
  }
}

function setAgent(s: EngineState, id: AgentId, patch: Partial<Agent>): EngineState {
  return { ...s, agents: { ...s.agents, [id]: { ...s.agents[id], ...patch } } }
}

function logEvent(s: EngineState, agentId: AgentId, text: string, accountId?: string): EngineState {
  const event: ActivityEvent = { id: uid('ev'), agentId, text, at: now(), accountId }
  return { ...s, activity: [event, ...s.activity].slice(0, 60) }
}

// Pure metrics selector for the UI.
export function metrics(s: EngineState) {
  const accounts = s.accounts ?? []
  const territories = s.territories ?? []
  const live = accounts.filter((a) => a.stage !== 'passed')
  const stage = (st: Stage) => accounts.filter((a) => a.stage === st).length
  const pipelineValue = live
    .filter((a) => a.stage !== 'discovered')
    .reduce((sum, a) => sum + a.acv, 0)
  const wonValue = accounts.filter((a) => a.stage === 'won').reduce((sum, a) => sum + a.acv, 0)
  return {
    discovered: accounts.length,
    qualified: accounts.filter((a) => ['qualified', 'ready', 'contacted', 'won'].includes(a.stage)).length,
    ready: stage('ready'),
    contacted: accounts.filter((a) => ['contacted', 'won'].includes(a.stage)).length,
    won: stage('won'),
    aTier: live.filter((a) => a.tier === 'A').length,
    pipelineValue,
    wonValue,
    territoriesCovered: territories.filter((t) => t.status === 'covered').length,
    territoriesTotal: territories.length,
  }
}

export function formatAgo(at: number, nowMs: number) {
  const s = Math.max(0, Math.round((nowMs - at) / 1000))
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}

export function useEngine() {
  const [state, setState] = useState<EngineState>(load)
  const [clock, setClock] = useState(() => now())
  const stateRef = useRef(state)
  const scanningRef = useRef(false)
  const draftingRef = useRef(false)
  const tickingRef = useRef(false)

  // keep refs + persistence in sync
  useEffect(() => {
    stateRef.current = state
    save(state)
  }, [state])

  const update = useCallback((fn: (s: EngineState) => EngineState) => setState((prev) => fn(prev)), [])

  // a wall clock for relative timestamps (keeps Date.now out of render)
  useEffect(() => {
    const id = setInterval(() => setClock(now()), 15000)
    return () => clearInterval(id)
  }, [])

  // ---- async unit: scan one territory ----
  const runScan = useCallback(
    (territory: Territory) => {
      scanningRef.current = true
      update((s) =>
        setAgent(
          { ...s, territories: s.territories.map((t) => (t.name === territory.name ? { ...t, status: 'scanning' } : t)) },
          'scout',
          { status: 'working', task: `Scanning ${territory.name} for commercial accounts…` },
        ),
      )
      scanTerritory(territory.name)
        .then((result) => {
          update((s) => {
            const existing = new Set(s.accounts.map((a) => a.id))
            const fresh = result.accounts
              .filter((a) => !existing.has(a.id))
              .map<Account>((raw) => ({
                ...raw,
                stage: 'discovered',
                tier: 'C',
                score: 0,
                acv: 0,
                need: '',
                reasons: [],
                territory: territory.name,
                discoveredAt: now(),
              }))
            let next: EngineState = {
              ...s,
              accounts: [...s.accounts, ...fresh],
              territories: s.territories.map((t) =>
                t.name === territory.name ? { ...t, status: 'covered', found: t.found + fresh.length } : t,
              ),
              lastError: result.source === 'sample' ? result.note ?? 'Live map unreachable — sample shown.' : null,
            }
            next = setAgent(next, 'scout', {
              status: 'idle',
              task: `Found ${fresh.length} accounts in ${territory.name}.`,
              done: next.agents.scout.done + fresh.length,
            })
            next = logEvent(
              next,
              'scout',
              `scanned ${territory.name} and found ${fresh.length} commercial ${fresh.length === 1 ? 'account' : 'accounts'}${
                result.source === 'sample' ? ' (sample — live map unreachable)' : ''
              }.`,
            )
            return next
          })
        })
        .catch(() => {
          update((s) =>
            setAgent(
              { ...s, territories: s.territories.map((t) => (t.name === territory.name ? { ...t, status: 'error' } : t)) },
              'scout',
              { status: 'idle', task: 'Scan failed — will retry.' },
            ),
          )
        })
        .finally(() => {
          scanningRef.current = false
        })
    },
    [update],
  )

  // ---- async unit: draft outreach for one account ----
  const runDraft = useCallback(
    (account: Account) => {
      draftingRef.current = true
      update((s) => setAgent(s, 'writer', { status: 'working', task: `Writing first-touch for ${account.name}…` }))
      const settings = stateRef.current.settings
      Promise.all([draftOutreach(account, settings), draftInsight(account, settings)])
        .then(([draft, insight]) => {
          update((s) => {
            const auto = s.settings.autonomy === 'auto'
            let next: EngineState = {
              ...s,
              accounts: s.accounts.map((a) =>
                a.id === account.id
                  ? { ...a, outreach: draft.text, insight: insight ?? a.insight, draftedByLLM: draft.byLLM, stage: auto ? 'contacted' : 'ready' }
                  : a,
              ),
            }
            next = setAgent(next, 'writer', {
              status: 'idle',
              task: `Drafted outreach for ${account.name}.`,
              done: next.agents.writer.done + 1,
            })
            next = logEvent(
              next,
              'writer',
              `drafted a first-touch for ${account.name}${draft.byLLM ? ' with Claude' : ''}.`,
              account.id,
            )
            if (auto) {
              next = setAgent(next, 'closer', {
                status: 'idle',
                task: `Auto-started outreach to ${account.name}.`,
                done: next.agents.closer.done + 1,
              })
              next = logEvent(next, 'closer', `auto-started outreach to ${account.name} (full-auto mode).`, account.id)
            } else {
              const approval: Approval = {
                id: uid('ap'),
                agentId: 'closer',
                accountId: account.id,
                title: `Start outreach to ${account.name}`,
                detail: `${account.tier}-tier ${account.category} · ${account.sizeLabel} · ~$${account.acv.toLocaleString()}/yr. Message is ready.`,
                action: 'Approve & send',
              }
              next = { ...next, approvals: [approval, ...next.approvals] }
            }
            return next
          })
        })
        .finally(() => {
          draftingRef.current = false
        })
    },
    [update],
  )

  // ---- the tick: one beat of autonomous work ----
  const tick = useCallback(() => {
    if (tickingRef.current) return
    tickingRef.current = true
    try {
      const s = stateRef.current
      if (!s.running) return

      // 1) Scan a pending territory (in parallel with everything else)
      if (!scanningRef.current) {
        const pending = s.territories.find((t) => t.status === 'pending')
        if (pending) runScan(pending)
      }

      // 2) Qualify a batch of freshly discovered accounts
      const discovered = s.accounts.filter((a) => a.stage === 'discovered')
      if (discovered.length) {
        const batch = discovered.slice(0, 4)
        update((prev) => {
          const ids = new Set(batch.map((b) => b.id))
          let aWins = 0
          const accounts = prev.accounts.map((a) => {
            if (!ids.has(a.id)) return a
            const q = qualify(a, a.territory)
            if (q.tier === 'A') aWins += 1
            return { ...q, discoveredAt: a.discoveredAt }
          })
          let next: EngineState = { ...prev, accounts }
          next = setAgent(next, 'qualifier', {
            status: 'working',
            task: `Scoring accounts in ${batch[0].territory}…`,
            done: next.agents.qualifier.done + batch.length,
          })
          if (aWins > 0) next = logEvent(next, 'qualifier', `flagged ${aWins} A-tier ${aWins === 1 ? 'account' : 'accounts'} worth chasing first.`)
          return next
        })
        return
      }
      // qualifier winds down when nothing to score
      if (s.agents.qualifier.status === 'working') {
        update((prev) => setAgent(prev, 'qualifier', { status: 'idle', task: 'All discovered accounts scored.' }))
      }

      // 3) Draft outreach for the highest-priority qualified account
      if (!draftingRef.current) {
        const candidate = s.accounts
          .filter((a) => a.stage === 'qualified' && !a.outreach)
          .sort((a, b) => b.score - a.score)[0]
        if (candidate) {
          runDraft(candidate)
          return
        }
      }

      // 4) Idle: occasional analyst pulse
      const m = metrics(s)
      const allCovered = s.territories.every((t) => t.status === 'covered' || t.status === 'error')
      const nothingPending = !s.accounts.some((a) => a.stage === 'discovered' || (a.stage === 'qualified' && !a.outreach))
      if (allCovered && nothingPending && !scanningRef.current && !draftingRef.current) {
        const last = s.activity[0]
        const quietFor = !last || now() - last.at > 12000
        if (quietFor && m.qualified > 0) {
          update((prev) =>
            logEvent(
              setAgent(prev, 'analyst', { status: 'idle', task: `Pipeline: $${Math.round(m.pipelineValue / 1000)}k across ${m.qualified} accounts.` }),
              'analyst',
              `pipeline holding at $${m.pipelineValue.toLocaleString()} across ${m.qualified} qualified accounts. Add a territory to find more.`,
            ),
          )
        }
      }
    } finally {
      tickingRef.current = false
    }
  }, [runDraft, runScan, update])

  const tickRef = useRef(tick)
  useEffect(() => {
    tickRef.current = tick
  }, [tick])

  useEffect(() => {
    const id = setInterval(() => tickRef.current(), TICK_MS)
    return () => clearInterval(id)
  }, [])

  // ---------- actions ----------
  const start = useCallback(() => update((s) => logEvent({ ...s, running: true }, 'analyst', 'engine started — agents are working the territories.')), [update])
  const stop = useCallback(() => update((s) => ({ ...s, running: false })), [update])
  const toggle = useCallback(() => update((s) => (s.running ? { ...s, running: false } : logEvent({ ...s, running: true }, 'analyst', 'engine started — agents are working the territories.'))), [update])

  const addTerritory = useCallback(
    (name: string) => {
      const clean = name.trim()
      if (!clean) return
      update((s) =>
        s.territories.some((t) => t.name.toLowerCase() === clean.toLowerCase())
          ? s
          : { ...s, running: true, territories: [...s.territories, { name: clean, status: 'pending', found: 0 }] },
      )
    },
    [update],
  )

  const rescanTerritory = useCallback(
    (name: string) =>
      update((s) => ({
        ...s,
        running: true,
        territories: s.territories.map((t) => (t.name === name ? { ...t, status: 'pending' } : t)),
      })),
    [update],
  )

  const removeTerritory = useCallback(
    (name: string) => update((s) => ({ ...s, territories: s.territories.filter((t) => t.name !== name) })),
    [update],
  )

  const approve = useCallback(
    (approvalId: string) =>
      update((s) => {
        const approval = s.approvals.find((a) => a.id === approvalId)
        if (!approval) return s
        let next: EngineState = {
          ...s,
          approvals: s.approvals.filter((a) => a.id !== approvalId),
          accounts: s.accounts.map((a) => (a.id === approval.accountId ? { ...a, stage: 'contacted' } : a)),
        }
        const acct = s.accounts.find((a) => a.id === approval.accountId)
        next = setAgent(next, 'closer', { status: 'idle', task: `Started outreach to ${acct?.name ?? 'account'}.`, done: next.agents.closer.done + 1 })
        next = logEvent(next, 'closer', `you approved — outreach started to ${acct?.name ?? 'the account'}.`, approval.accountId)
        return next
      }),
    [update],
  )

  const dismiss = useCallback(
    (approvalId: string) =>
      update((s) => {
        const approval = s.approvals.find((a) => a.id === approvalId)
        return {
          ...s,
          approvals: s.approvals.filter((a) => a.id !== approvalId),
          accounts: approval ? s.accounts.map((a) => (a.id === approval.accountId ? { ...a, stage: 'passed' } : a)) : s.accounts,
        }
      }),
    [update],
  )

  const setStage = useCallback(
    (accountId: string, stage: Stage) =>
      update((s) => {
        let next: EngineState = { ...s, accounts: s.accounts.map((a) => (a.id === accountId ? { ...a, stage } : a)) }
        const acct = s.accounts.find((a) => a.id === accountId)
        if (stage === 'won' && acct) next = logEvent(next, 'closer', `marked ${acct.name} as WON — $${acct.acv.toLocaleString()}/yr added.`, accountId)
        return next
      }),
    [update],
  )

  const updateSettings = useCallback((patch: Partial<Settings>) => update((s) => ({ ...s, settings: { ...s.settings, ...patch } })), [update])

  const reset = useCallback(
    () =>
      update((s) => ({
        ...s,
        accounts: [],
        activity: [],
        approvals: [],
        agents: { ...AGENTS },
        territories: s.territories.map((t) => ({ ...t, status: 'pending', found: 0 })),
      })),
    [update],
  )

  return {
    state,
    clock,
    actions: {
      start,
      stop,
      toggle,
      addTerritory,
      rescanTerritory,
      removeTerritory,
      approve,
      dismiss,
      setStage,
      updateSettings,
      reset,
    },
  }
}
