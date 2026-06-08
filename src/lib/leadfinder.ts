import { demoCompany } from './servicepilot'

export type ProspectSegment =
  | 'property_management'
  | 'dealership'
  | 'storage'
  | 'hotel'
  | 'realtor'
  | 'auto_repair'
  | 'commercial'

export type Prospect = {
  id: string
  name: string
  category: string
  segment: ProspectSegment
  address: string
  city: string
  lat?: number
  lon?: number
  score: number
  volumeEstimate: string
  estimatedValue: number
  signal: string
  outreach: string
  phone?: string
  website?: string
}

export type ProspectResult = {
  prospects: Prospect[]
  area: string
  center?: { lat: number; lon: number }
  source: 'openstreetmap' | 'demo'
  note?: string
}

type SegmentConfig = {
  segment: ProspectSegment
  category: string
  score: number
  volumeEstimate: string
  estimatedValue: number
  signal: string
}

// Real local accounts a locksmith can win. Every one of these needs recurring
// lock, key, or access work — not a one-off house call.
const SEGMENTS: Record<ProspectSegment, SegmentConfig> = {
  property_management: {
    segment: 'property_management',
    category: 'Property manager',
    score: 95,
    volumeEstimate: 'Rekeys on every tenant turnover',
    estimatedValue: 4200,
    signal: 'Units get rekeyed at every move-out — steady, repeatable work and a master-key contract.',
  },
  dealership: {
    segment: 'dealership',
    category: 'Car dealership',
    score: 90,
    volumeEstimate: 'Key cutting & fob programming',
    estimatedValue: 3200,
    signal: 'Lost-key and duplicate-fob jobs are constant, and dealers pay well for fast turnaround.',
  },
  storage: {
    segment: 'storage',
    category: 'Self-storage facility',
    score: 84,
    volumeEstimate: 'Lock cut-offs & padlocks',
    estimatedValue: 2400,
    signal: 'Overlocks and abandoned-unit cut-offs come up weekly — easy recurring volume.',
  },
  hotel: {
    segment: 'hotel',
    category: 'Hotel / motel',
    score: 82,
    volumeEstimate: 'Key control & rekeys',
    estimatedValue: 2800,
    signal: 'Guest-room and back-of-house locks need rekeys, restricted keyways, and fast service calls.',
  },
  realtor: {
    segment: 'realtor',
    category: 'Real estate office',
    score: 78,
    volumeEstimate: 'Rekeys at every closing',
    estimatedValue: 1800,
    signal: 'New owners want the locks changed on closing day — a referral pipeline to their clients.',
  },
  auto_repair: {
    segment: 'auto_repair',
    category: 'Auto repair shop',
    score: 72,
    volumeEstimate: 'Key & ignition referrals',
    estimatedValue: 1500,
    signal: 'Shops hit key and ignition jobs they cannot finish — an easy referral partnership.',
  },
  commercial: {
    segment: 'commercial',
    category: 'Commercial property',
    score: 64,
    volumeEstimate: 'Commercial lock service',
    estimatedValue: 1200,
    signal: 'Local business with doors, panic bars, and locks worth a maintenance relationship.',
  },
}

type OsmTags = Record<string, string>

function segmentForTags(tags: OsmTags): SegmentConfig {
  if (tags.office === 'property_management') return SEGMENTS.property_management
  if (tags.building === 'apartments' || tags.building === 'residential') return SEGMENTS.property_management
  if (tags.shop === 'car') return SEGMENTS.dealership
  if (tags.shop === 'storage_rental' || tags.office === 'storage_rental') return SEGMENTS.storage
  if (tags.tourism === 'hotel' || tags.tourism === 'motel') return SEGMENTS.hotel
  if (tags.office === 'estate_agent') return SEGMENTS.realtor
  if (tags.shop === 'car_repair' || tags.craft === 'car_repair') return SEGMENTS.auto_repair
  return SEGMENTS.commercial
}

function buildOutreach(name: string, config: SegmentConfig, city: string) {
  const where = city ? ` in ${city}` : ''
  return (
    `Hi ${name} — this is ${demoCompany.ownerName} at ${demoCompany.name}, a local locksmith${where}. ` +
    `We handle ${config.volumeEstimate.toLowerCase()} for places like yours, usually same day. ` +
    `Happy to set up a priority account with one number to call and flat pricing. Worth a quick chat this week?`
  )
}

function titleCaseCity(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter'
const NOMINATIM_ENDPOINT = 'https://nominatim.openstreetmap.org/search'

function overpassQuery(lat: number, lon: number, radius: number) {
  const a = `(around:${radius},${lat},${lon})`
  return `[out:json][timeout:25];(
    nwr["office"="property_management"]${a};
    nwr["shop"="car"]${a};
    nwr["shop"="storage_rental"]${a};
    nwr["office"="storage_rental"]${a};
    nwr["tourism"="hotel"]["name"]${a};
    nwr["tourism"="motel"]["name"]${a};
    nwr["office"="estate_agent"]${a};
    nwr["shop"="car_repair"]${a};
  );out center tags 80;`
}

function elementToProspect(element: {
  id: number
  type: string
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: OsmTags
}): Prospect | null {
  const tags = element.tags ?? {}
  const name = tags.name?.trim()
  if (!name) return null

  const config = segmentForTags(tags)
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim()
  const city = (tags['addr:city'] ?? '').trim()
  const lat = element.lat ?? element.center?.lat
  const lon = element.lon ?? element.center?.lon

  return {
    id: `OSM-${element.type}-${element.id}`,
    name,
    category: config.category,
    segment: config.segment,
    address: street || city || 'Address on file',
    city,
    lat,
    lon,
    score: config.score,
    volumeEstimate: config.volumeEstimate,
    estimatedValue: config.estimatedValue,
    signal: config.signal,
    outreach: buildOutreach(name, config, city),
    phone: tags.phone ?? tags['contact:phone'],
    website: tags.website ?? tags['contact:website'],
  }
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    if (!response.ok) throw new Error(`Request failed: ${response.status}`)
    return await response.json()
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Finds real local commercial prospects for a locksmith using OpenStreetMap
 * (Nominatim geocoding + Overpass business search). Both APIs are free, keyless,
 * and CORS-enabled, so this runs straight from the browser. Falls back to a
 * deterministic local set if the network is unavailable.
 */
export async function findProspects(area: string, radiusKm = 6): Promise<ProspectResult> {
  const query = area.trim() || demoCompany.serviceArea
  const radius = Math.round(Math.min(Math.max(radiusKm, 1), 25) * 1000)

  try {
    const geo = (await fetchJson(
      `${NOMINATIM_ENDPOINT}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { Accept: 'application/json' } },
      12000,
    )) as Array<{ lat: string; lon: string; display_name: string }>

    if (!geo?.length) {
      return { ...fallbackProspects(query), note: `Could not locate "${query}". Showing sample accounts.` }
    }

    const lat = Number(geo[0].lat)
    const lon = Number(geo[0].lon)

    const overpass = (await fetchJson(
      OVERPASS_ENDPOINT,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: overpassQuery(lat, lon, radius) }).toString(),
      },
      20000,
    )) as { elements?: Parameters<typeof elementToProspect>[0][] }

    const seen = new Set<string>()
    const prospects = (overpass.elements ?? [])
      .map(elementToProspect)
      .filter((p): p is Prospect => p !== null)
      .filter((p) => {
        const key = `${p.name}|${p.address}`.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 14)

    if (!prospects.length) {
      return { ...fallbackProspects(query), note: `No commercial accounts found near "${query}" yet.` }
    }

    return { prospects, area: query, center: { lat, lon }, source: 'openstreetmap' }
  } catch {
    return {
      ...fallbackProspects(query),
      note: 'Live lead source unreachable — showing sample accounts.',
    }
  }
}

function fallbackProspects(area: string): ProspectResult {
  const city = titleCaseCity(area.split(',')[0] ?? area) || 'your area'
  const seeds: Array<{ name: string; segment: ProspectSegment; address: string }> = [
    { name: `${city} Property Group`, segment: 'property_management', address: '1200 Main St' },
    { name: 'Riverside Motors', segment: 'dealership', address: '910 Auto Mile' },
    { name: `${city} Self Storage`, segment: 'storage', address: '1450 Industrial Pkwy' },
    { name: 'The Bell Hotel', segment: 'hotel', address: '88 Center Ave' },
    { name: 'Anchor Realty', segment: 'realtor', address: '275 Market St' },
    { name: 'Apex Auto Service', segment: 'auto_repair', address: '45 Garage Lane' },
  ]

  const prospects = seeds.map((seed, index) => {
    const config = SEGMENTS[seed.segment]
    return {
      id: `DEMO-${index + 1}`,
      name: seed.name,
      category: config.category,
      segment: seed.segment,
      address: seed.address,
      city,
      score: config.score,
      volumeEstimate: config.volumeEstimate,
      estimatedValue: config.estimatedValue,
      signal: config.signal,
      outreach: buildOutreach(seed.name, config, city),
    }
  })

  prospects.sort((a, b) => b.score - a.score)
  return { prospects, area, source: 'demo' }
}
