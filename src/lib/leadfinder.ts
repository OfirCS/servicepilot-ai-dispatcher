import { demoCompany } from './servicepilot'

export type ProspectSegment =
  | 'fire_station'
  | 'auto_repair'
  | 'dealership'
  | 'storage'
  | 'warehouse'
  | 'fuel'
  | 'home_improvement'
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
  doorEstimate: string
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
  doorEstimate: string
  estimatedValue: number
  signal: string
}

// Real commercial accounts a garage-door company can win. Every one of these
// owns overhead, bay, roll-up, or loading-dock doors that need service.
const SEGMENTS: Record<ProspectSegment, SegmentConfig> = {
  fire_station: {
    segment: 'fire_station',
    category: 'Fire station',
    score: 95,
    doorEstimate: '3-8 apparatus bay doors',
    estimatedValue: 4200,
    signal: 'Apparatus bay doors cycle constantly and need certified maintenance contracts.',
  },
  storage: {
    segment: 'storage',
    category: 'Self-storage facility',
    score: 92,
    doorEstimate: '20+ roll-up doors',
    estimatedValue: 3600,
    signal: 'High roll-up door count means recurring repair and spring-replacement volume.',
  },
  dealership: {
    segment: 'dealership',
    category: 'Car dealership',
    score: 86,
    doorEstimate: '4-10 showroom & service doors',
    estimatedValue: 2600,
    signal: 'Service drive and detailing bays depend on doors that cannot be down during hours.',
  },
  warehouse: {
    segment: 'warehouse',
    category: 'Warehouse / industrial',
    score: 82,
    doorEstimate: '4-12 loading-dock doors',
    estimatedValue: 3000,
    signal: 'Loading-dock doors are mission-critical and command priority service plans.',
  },
  auto_repair: {
    segment: 'auto_repair',
    category: 'Auto repair shop',
    score: 84,
    doorEstimate: '2-6 bay doors',
    estimatedValue: 1800,
    signal: 'Bay doors open hundreds of times a week — high wear, easy same-day upsell.',
  },
  home_improvement: {
    segment: 'home_improvement',
    category: 'Trade / hardware supplier',
    score: 72,
    doorEstimate: '2-5 loading doors',
    estimatedValue: 1500,
    signal: 'Yard and loading doors plus a referral pipeline to their own customers.',
  },
  fuel: {
    segment: 'fuel',
    category: 'Service station',
    score: 66,
    doorEstimate: '1-3 service bays',
    estimatedValue: 900,
    signal: 'Service-bay doors and quick-turn repairs keep the pumps and shop running.',
  },
  commercial: {
    segment: 'commercial',
    category: 'Commercial property',
    score: 60,
    doorEstimate: 'Overhead / bay doors',
    estimatedValue: 1200,
    signal: 'Local commercial site with overhead doors worth a maintenance quote.',
  },
}

type OsmTags = Record<string, string>

function segmentForTags(tags: OsmTags): SegmentConfig {
  if (tags.amenity === 'fire_station') return SEGMENTS.fire_station
  if (tags.shop === 'storage_rental' || tags.office === 'storage_rental') return SEGMENTS.storage
  if (tags.shop === 'car') return SEGMENTS.dealership
  if (tags.shop === 'car_repair' || tags.craft === 'car_repair' || tags.amenity === 'car_wash')
    return SEGMENTS.auto_repair
  if (tags.building === 'warehouse' || tags.landuse === 'industrial' || tags.industrial)
    return SEGMENTS.warehouse
  if (tags.shop === 'doityourself' || tags.shop === 'trade' || tags.shop === 'hardware')
    return SEGMENTS.home_improvement
  if (tags.amenity === 'fuel') return SEGMENTS.fuel
  return SEGMENTS.commercial
}

function buildOutreach(name: string, config: SegmentConfig, city: string) {
  const where = city ? ` across ${city}` : ''
  return (
    `Hi ${name} — this is ${demoCompany.ownerName} at ${demoCompany.name}. ` +
    `We repair and maintain commercial overhead, bay, and roll-up doors${where}. ` +
    `I noticed your ${config.doorEstimate.toLowerCase()} and wanted to offer a free 5-point ` +
    `door safety check this week, plus same-day priority repair for local businesses. Worth a quick look?`
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
    nwr["shop"="car_repair"]${a};
    nwr["shop"="car"]${a};
    nwr["amenity"="car_wash"]${a};
    nwr["amenity"="fire_station"]${a};
    nwr["shop"="storage_rental"]${a};
    nwr["office"="storage_rental"]${a};
    nwr["building"="warehouse"]["name"]${a};
    nwr["amenity"="fuel"]${a};
    nwr["shop"="doityourself"]${a};
    nwr["shop"="trade"]${a};
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
    doorEstimate: config.doorEstimate,
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
 * Finds real local commercial prospects for a garage-door company using
 * OpenStreetMap (Nominatim geocoding + Overpass business search). Both APIs
 * are free, keyless, and CORS-enabled, so this runs straight from the browser.
 * Falls back to a deterministic local set if the network is unavailable.
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
      return { ...fallbackProspects(query), note: `Could not locate "${query}". Showing sample prospects.` }
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
      return { ...fallbackProspects(query), note: `No commercial door accounts found near "${query}" yet.` }
    }

    return { prospects, area: query, center: { lat, lon }, source: 'openstreetmap' }
  } catch {
    return {
      ...fallbackProspects(query),
      note: 'Live lead source unreachable — showing sample prospects.',
    }
  }
}

function fallbackProspects(area: string): ProspectResult {
  const city = titleCaseCity(area.split(',')[0] ?? area) || 'your area'
  const seeds: Array<{ name: string; segment: ProspectSegment; address: string }> = [
    { name: `${city} Self Storage`, segment: 'storage', address: '1200 Industrial Pkwy' },
    { name: 'Apex Auto Service', segment: 'auto_repair', address: '88 Garage Lane' },
    { name: `${city} Fire Station 4`, segment: 'fire_station', address: '300 Civic Dr' },
    { name: 'Northbridge Distribution', segment: 'warehouse', address: '45 Logistics Way' },
    { name: 'Riverside Motors', segment: 'dealership', address: '910 Auto Mile' },
    { name: 'BuildRight Supply', segment: 'home_improvement', address: '275 Trade Ct' },
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
      doorEstimate: config.doorEstimate,
      estimatedValue: config.estimatedValue,
      signal: config.signal,
      outreach: buildOutreach(seed.name, config, city),
    }
  })

  prospects.sort((a, b) => b.score - a.score)
  return { prospects, area, source: 'demo' }
}
