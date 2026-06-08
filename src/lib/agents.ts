import type { Account, RawAccount, Segment, Settings, Tier } from './types'

// ---------------------------------------------------------------------------
// Deterministic, per-entity helpers. We never use Math.random for account
// numbers — values are derived from the real OSM id so they're stable across
// reloads but still vary believably between accounts.
// ---------------------------------------------------------------------------
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
function rand01(seed: string): number {
  return (hash(seed) % 100000) / 100000
}
function pick<T>(seed: string, items: T[]): T {
  return items[hash(seed) % items.length]
}

// Per-segment economics for a *recurring commercial account* (annual contract
// value range) and the work a big locksmith company would sell them.
const SEGMENTS: Record<Segment, { base: number; acv: [number, number]; need: string; floor: Tier }> = {
  property_management: { base: 92, acv: [8000, 22000], need: 'portfolio rekeys on every turnover + master-key management', floor: 'A' },
  hospital: { base: 90, acv: [10000, 30000], need: 'high-security master keying and 24/7 access control', floor: 'A' },
  university: { base: 88, acv: [9000, 26000], need: 'campus-wide keying, dorm rekeys, and access control', floor: 'A' },
  apartments: { base: 86, acv: [6000, 18000], need: 'unit rekeys at every move-out and common-area access', floor: 'A' },
  government: { base: 85, acv: [8000, 24000], need: 'secured facilities, restricted keyways, and service contracts', floor: 'A' },
  school: { base: 80, acv: [5000, 14000], need: 'classroom rekeys, panic hardware, and access control', floor: 'B' },
  hotel: { base: 82, acv: [5000, 16000], need: 'guest-room rekeys, key control, and safe service', floor: 'B' },
  mall_retail: { base: 76, acv: [5000, 15000], need: 'storefront locks, master keying, and tenant turnovers', floor: 'B' },
  bank: { base: 78, acv: [6000, 14000], need: 'vault service, high-security locks, and audits', floor: 'B' },
  warehouse: { base: 72, acv: [4000, 12000], need: 'high-security access and dock-door hardware', floor: 'B' },
  dealership: { base: 74, acv: [4000, 11000], need: 'key & fob cutting/programming at volume', floor: 'B' },
  storage: { base: 70, acv: [3000, 9000], need: 'lock cut-offs, overlocks, and padlock supply', floor: 'B' },
  gym: { base: 64, acv: [2500, 7000], need: 'locker hardware and access control', floor: 'C' },
  office: { base: 62, acv: [2500, 8000], need: 'commercial lock service and access control', floor: 'C' },
  commercial: { base: 56, acv: [1500, 6000], need: 'commercial lock and key service', floor: 'C' },
}

function tierFromScore(score: number, floor: Tier): Tier {
  let tier: Tier = score >= 82 ? 'A' : score >= 68 ? 'B' : 'C'
  // A floor guarantees high-value segments never drop below their minimum tier.
  const order: Tier[] = ['C', 'B', 'A']
  if (order.indexOf(tier) < order.indexOf(floor)) tier = floor
  return tier
}

// The Qualifier agent. Scores a real account for fit and value using its
// segment, the size signal from the map, and whether we can reach them.
export function qualify(raw: RawAccount, territory: string): Account {
  const meta = SEGMENTS[raw.segment]
  const sizeBonus = Math.round(raw.sizeScore * 16)
  const contactBonus = (raw.phone ? 4 : 0) + (raw.website ? 3 : 0)
  const jitter = Math.round(rand01(raw.id) * 5) - 2
  const score = Math.max(35, Math.min(99, meta.base + sizeBonus + contactBonus + jitter))
  const tier = tierFromScore(score, meta.floor)

  const [lo, hi] = meta.acv
  const acvRaw = lo + rand01(raw.id + 'acv') * (hi - lo)
  const acv = Math.round((acvRaw * (0.75 + raw.sizeScore * 0.5)) / 100) * 100

  const reasons = [
    `${raw.category} — ${meta.need.split(' + ')[0]}`,
    raw.sizeScore >= 0.7 ? `Large site (${raw.sizeLabel}) means recurring volume` : `Steady ${raw.category.toLowerCase()} work`,
    raw.phone || raw.website ? 'Direct contact available' : 'No public contact — visit or look up decision-maker',
  ]

  return {
    ...raw,
    stage: 'qualified',
    tier,
    score,
    acv,
    need: meta.need,
    reasons,
    territory,
    discoveredAt: 0, // set by the engine
  }
}

// ---------------------------------------------------------------------------
// Outreach drafting. Deterministic, personalized templates by default; real
// Claude reasoning when the company brings an API key.
// ---------------------------------------------------------------------------
function deterministicDraft(account: Account, settings: Settings): string {
  const opener = pick(account.id, [
    `Hi — I run partnerships at ${settings.companyName}, a commercial locksmith team that covers ${account.city || 'your area'}.`,
    `Hello from ${settings.companyName} — we're the locksmith partner for a lot of ${account.category.toLowerCase()}s near you.`,
    `Quick note from ${settings.companyName}. We handle commercial lock and key work for properties like ${account.name}.`,
  ])
  const value = pick(account.id + 'v', [
    `We'd set you up with one number to call, flat per-site pricing, and 24/7 emergency response.`,
    `Most groups your size want a single vendor across every location — that's exactly what we do.`,
    `We can take ${account.need} off your plate with priority service and predictable pricing.`,
  ])
  const close = pick(account.id + 'c', [
    `Worth a 15-minute call this week to scope a priority account?`,
    `Open to a quick intro call to set up a standing account?`,
    `Can I send over a simple account proposal for ${account.name}?`,
  ])
  return `${opener} I noticed ${account.name} likely needs ${account.need}. ${value} ${close}`
}

export async function draftOutreach(account: Account, settings: Settings): Promise<{ text: string; byLLM: boolean }> {
  if (settings.llmEnabled && settings.apiKey.trim()) {
    try {
      const text = await llmDraft(account, settings)
      if (text) return { text, byLLM: true }
    } catch {
      // fall through to deterministic
    }
  }
  return { text: deterministicDraft(account, settings), byLLM: false }
}

// Optional one-line strategic angle for top accounts (LLM only).
export async function draftInsight(account: Account, settings: Settings): Promise<string | null> {
  if (!(settings.llmEnabled && settings.apiKey.trim())) return null
  try {
    const out = await callClaude(
      settings,
      'You are a B2B sales strategist for a commercial locksmith company. In ONE short sentence (max 22 words), give the sharpest angle to win this account. No preamble.',
      `Account: ${account.name}. Type: ${account.category}. Size: ${account.sizeLabel}. City: ${account.city}. They need: ${account.need}.`,
      60,
    )
    return out?.trim() || null
  } catch {
    return null
  }
}

async function llmDraft(account: Account, settings: Settings): Promise<string> {
  const system =
    `You write short, sharp B2B outreach for ${settings.companyName}, a commercial locksmith company that serves multi-location clients. ` +
    `Write a first-touch message (max 65 words) to the facilities/operations decision-maker. ` +
    `Be specific to the account, lead with their likely need, mention one concrete value point (single vendor, flat per-site pricing, or 24/7 response), and end with a soft ask for a short call. No subject line, no markdown, no placeholders.`
  const user = `Account: ${account.name}\nType: ${account.category}\nSize signal: ${account.sizeLabel}\nCity: ${account.city}\nLikely need: ${account.need}`
  const out = await callClaude(settings, system, user, 220)
  return out.trim()
}

// Calls the Anthropic API directly from the browser. Requires the
// bring-your-own-key field; the key stays in the browser (localStorage).
async function callClaude(settings: Settings, system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': settings.apiKey.trim(),
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: settings.model || 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  })
  if (!res.ok) throw new Error(`Anthropic ${res.status}`)
  const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> }
  return (data.content ?? []).map((c) => c.text ?? '').join('').trim()
}
