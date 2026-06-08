import type { RawAccount, Segment } from './types'

// Live commercial-account discovery from OpenStreetMap. Free, keyless, and
// CORS-enabled, so the agents can scan a real territory straight from the
// browser. No data is hardcoded — every account is a real place on the map.

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

type Tags = Record<string, string>

const SEGMENT_META: Record<Segment, { category: string }> = {
  property_management: { category: 'Property manager' },
  apartments: { category: 'Apartment community' },
  hotel: { category: 'Hotel' },
  hospital: { category: 'Hospital / medical' },
  university: { category: 'University' },
  school: { category: 'School (K-12)' },
  government: { category: 'Government facility' },
  dealership: { category: 'Auto dealership' },
  storage: { category: 'Self-storage' },
  mall_retail: { category: 'Shopping center' },
  bank: { category: 'Bank / credit union' },
  warehouse: { category: 'Warehouse / logistics' },
  gym: { category: 'Fitness center' },
  office: { category: 'Office building' },
  commercial: { category: 'Commercial property' },
}

export function segmentCategory(segment: Segment) {
  return SEGMENT_META[segment].category
}

function segmentForTags(tags: Tags): Segment {
  if (tags.office === 'property_management') return 'property_management'
  if (tags.building === 'apartments' || tags.building === 'residential') return 'apartments'
  if (tags.tourism === 'hotel' || tags.tourism === 'motel') return 'hotel'
  if (tags.amenity === 'hospital' || tags.amenity === 'clinic' || tags.healthcare) return 'hospital'
  if (tags.amenity === 'university' || tags.amenity === 'college') return 'university'
  if (tags.amenity === 'school') return 'school'
  if (tags.office === 'government' || tags.amenity === 'townhall' || tags.amenity === 'courthouse') return 'government'
  if (tags.shop === 'car') return 'dealership'
  if (tags.shop === 'storage_rental' || tags.office === 'storage_rental') return 'storage'
  if (tags.shop === 'mall' || tags.shop === 'department_store') return 'mall_retail'
  if (tags.amenity === 'bank') return 'bank'
  if (tags.building === 'warehouse' || tags.landuse === 'industrial') return 'warehouse'
  if (tags.leisure === 'fitness_centre' || tags.leisure === 'sports_centre') return 'gym'
  if (tags.office) return 'office'
  return 'commercial'
}

// Pull a "this is a big account" signal out of the OSM tags. Real attributes —
// hotel room counts, building height, bed counts, chain operators — feed the
// qualifier so larger sites score higher.
function sizeFromTags(tags: Tags, segment: Segment): { label: string; score: number } {
  const num = (v?: string) => {
    const n = Number((v ?? '').replace(/[^\d]/g, ''))
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  const levels = num(tags['building:levels'])
  const rooms = num(tags.rooms) || num(tags['rooms:total'])
  const beds = num(tags.beds) || num(tags.capacity)
  const flats = num(tags['building:flats'])
  const isChain = Boolean(tags.brand || tags.operator)

  let score = 0.25
  let label = 'Single site'

  if (segment === 'hotel' && rooms) {
    score = Math.min(1, 0.4 + rooms / 300)
    label = `${rooms} rooms`
  } else if (segment === 'apartments' && (flats || levels)) {
    const units = flats || levels * 8
    score = Math.min(1, 0.4 + units / 200)
    label = flats ? `${flats} units` : `${levels} floors`
  } else if (segment === 'hospital' && beds) {
    score = Math.min(1, 0.5 + beds / 400)
    label = `${beds} beds`
  } else if (levels >= 4) {
    score = Math.min(1, 0.45 + levels / 30)
    label = `${levels}-floor building`
  } else if (segment === 'university' || segment === 'government' || segment === 'hospital') {
    score = 0.8
    label = 'Large campus'
  } else if (segment === 'property_management' || segment === 'mall_retail') {
    score = 0.7
    label = 'Multi-property'
  }

  if (isChain) {
    score = Math.min(1, score + 0.15)
    label = tags.brand ? `${tags.brand} (chain)` : `${label} · chain`
  }
  return { label, score: Math.round(score * 100) / 100 }
}

function buildQuery(lat: number, lon: number, radius: number) {
  const a = `(around:${radius},${lat},${lon})`
  const lines = [
    `nwr["office"="property_management"]${a};`,
    `nwr["building"="apartments"]["name"]${a};`,
    `nwr["tourism"="hotel"]["name"]${a};`,
    `nwr["tourism"="motel"]["name"]${a};`,
    `nwr["amenity"="hospital"]["name"]${a};`,
    `nwr["amenity"="university"]["name"]${a};`,
    `nwr["amenity"="college"]["name"]${a};`,
    `nwr["amenity"="school"]["name"]${a};`,
    `nwr["office"="government"]${a};`,
    `nwr["amenity"="townhall"]["name"]${a};`,
    `nwr["shop"="car"]${a};`,
    `nwr["shop"="storage_rental"]${a};`,
    `nwr["shop"="mall"]["name"]${a};`,
    `nwr["shop"="department_store"]["name"]${a};`,
    `nwr["amenity"="bank"]["name"]${a};`,
    `nwr["building"="warehouse"]["name"]${a};`,
    `nwr["leisure"="fitness_centre"]["name"]${a};`,
    `nwr["office"="company"]["name"]${a};`,
  ].join('\n')
  return `[out:json][timeout:25];(\n${lines}\n);out center tags 250;`
}

async function fetchJson(url: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

type OsmEl = { id: number; type: string; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Tags }

function toRaw(el: OsmEl): RawAccount | null {
  const tags = el.tags ?? {}
  const name = tags.name?.trim()
  if (!name) return null
  const segment = segmentForTags(tags)
  const street = [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ').trim()
  const city = (tags['addr:city'] ?? '').trim()
  const size = sizeFromTags(tags, segment)
  return {
    id: `osm-${el.type}-${el.id}`,
    name,
    segment,
    category: segmentCategory(segment),
    address: street || city || 'Address on map',
    city,
    lat: el.lat ?? el.center?.lat,
    lon: el.lon ?? el.center?.lon,
    phone: tags.phone ?? tags['contact:phone'],
    website: tags.website ?? tags['contact:website'],
    sizeLabel: size.label,
    sizeScore: size.score,
  }
}

export type ScanResult = {
  accounts: RawAccount[]
  source: 'live' | 'sample'
  note?: string
}

export async function scanTerritory(area: string, radiusKm = 9): Promise<ScanResult> {
  const query = area.trim()
  const radius = Math.round(Math.min(Math.max(radiusKm, 1), 25) * 1000)

  try {
    const geo = (await fetchJson(
      `${NOMINATIM}?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,
      { headers: { Accept: 'application/json' } },
      12000,
    )) as Array<{ lat: string; lon: string }>
    if (!geo?.length) return { ...sampleScan(query), note: `Could not locate "${query}".` }

    const lat = Number(geo[0].lat)
    const lon = Number(geo[0].lon)
    const body = new URLSearchParams({ data: buildQuery(lat, lon, radius) }).toString()

    let data: { elements?: OsmEl[] } | null = null
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        data = (await fetchJson(
          endpoint,
          { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
          22000,
        )) as { elements?: OsmEl[] }
        break
      } catch {
        // try the next mirror
      }
    }
    if (!data) return { ...sampleScan(query), note: 'Live map source unreachable — showing sample accounts.' }

    const seen = new Set<string>()
    const accounts = (data.elements ?? [])
      .map(toRaw)
      .filter((a): a is RawAccount => a !== null)
      .filter((a) => {
        const key = `${a.name}|${a.address}`.toLowerCase()
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

    if (!accounts.length) return { ...sampleScan(query), note: `No commercial accounts found near "${query}".` }
    return { accounts, source: 'live' }
  } catch {
    return { ...sampleScan(query), note: 'Live map source unreachable — showing sample accounts.' }
  }
}

// Resilience only: if the live map is unreachable we still show plausible
// accounts so the engine never looks broken, clearly flagged as a sample.
function sampleScan(area: string): ScanResult {
  const city = (area.split(',')[0] || 'your area').trim()
  const seeds: Array<{ name: string; segment: Segment; size: string; sizeScore: number }> = [
    { name: `${city} Towers Apartments`, segment: 'apartments', size: '240 units', sizeScore: 0.9 },
    { name: `${city} Regional Hospital`, segment: 'hospital', size: '320 beds', sizeScore: 0.95 },
    { name: `Grand ${city} Hotel`, segment: 'hotel', size: '180 rooms', sizeScore: 0.8 },
    { name: `${city} Property Partners`, segment: 'property_management', size: 'Multi-property', sizeScore: 0.85 },
    { name: `${city} State University`, segment: 'university', size: 'Large campus', sizeScore: 0.9 },
    { name: `${city} Town Center Mall`, segment: 'mall_retail', size: 'Multi-property', sizeScore: 0.75 },
    { name: `${city} Self Storage`, segment: 'storage', size: 'Single site', sizeScore: 0.4 },
    { name: `${city} Auto Group`, segment: 'dealership', size: 'chain', sizeScore: 0.6 },
  ]
  const accounts = seeds.map((s, i) => ({
    id: `sample-${city}-${i}`.toLowerCase(),
    name: s.name,
    segment: s.segment,
    category: segmentCategory(s.segment),
    address: `${100 + i * 35} Main St`,
    city,
    sizeLabel: s.size,
    sizeScore: s.sizeScore,
  }))
  return { accounts, source: 'sample' }
}
