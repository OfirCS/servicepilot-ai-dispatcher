import type { Config } from '@netlify/functions'
import { getCompanyId, getSupabaseAdmin } from './_shared/db'
import { json, readBody } from './_shared/domain'
import { findProspects, type Prospect } from './_shared/prospecting'

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return json({})
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const body = await readBody(req)
  const area = String(body.area ?? '').trim()
  const radiusKm = Number(body.radiusKm ?? 6)
  const persist = body.persist === true || body.persist === 'true'

  if (!area) return json({ error: 'area is required' }, 400)

  let prospects: Prospect[]
  let source: string
  try {
    const result = await findProspects(area, radiusKm)
    prospects = result.prospects
    source = result.source
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lead source unreachable'
    return json({ error: message, prospects: [], source: 'error' }, 502)
  }

  if (persist && prospects.length) {
    const supabase = getSupabaseAdmin()
    if (supabase) {
      const companyId = getCompanyId()
      const rows = prospects.map((p) => ({
        company_id: companyId,
        customer_name: p.name,
        customer_phone: p.phone ?? '',
        address: p.address,
        city: p.city,
        service_type: 'commercial_door',
        urgency: 'quote',
        status: 'captured',
        source: 'outbound',
        estimated_value: p.estimatedValue,
        summary: `${p.category}. ${p.signal}`,
      }))
      const { error } = await supabase.from('leads').insert(rows)
      if (error) return json({ prospects, source, persisted: false, persistError: error.message })
      return json({ prospects, source, persisted: true, count: rows.length })
    }
  }

  return json({ prospects, source, persisted: false, count: prospects.length })
}

export const config: Config = {
  path: '/api/marketing/prospect',
  method: ['POST', 'OPTIONS'],
}
