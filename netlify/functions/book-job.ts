import type { Config } from '@netlify/functions'
import { getSupabaseAdmin } from './_shared/db'
import { json, readBody } from './_shared/domain'

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return json({})
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const body = await readBody(req)
  const leadId = String(body.leadId ?? '')
  const technicianName = String(body.technicianName ?? 'Ari Cohen')
  const scheduledTime = String(body.scheduledTime ?? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString())
  const revenue = Number(body.revenue ?? 475)
  const supabase = getSupabaseAdmin()

  if (!leadId) return json({ error: 'leadId is required' }, 400)

  if (!supabase) {
    return json({
      job: {
        id: `DEMO_JOB_${Date.now()}`,
        leadId,
        technicianName,
        scheduledTime,
        revenue,
        status: 'scheduled',
      },
      source: 'demo',
    })
  }

  const { data, error } = await supabase
    .from('jobs')
    .insert({
      lead_id: leadId,
      scheduled_time: scheduledTime,
      technician_name: technicianName,
      status: 'scheduled',
      revenue,
    })
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  await supabase.from('leads').update({ status: 'booked', estimated_value: revenue }).eq('id', leadId)

  return json({ job: data, source: 'supabase' }, 201)
}

export const config: Config = {
  path: '/api/calendar/book',
  method: ['POST', 'OPTIONS'],
}
