import type { Config } from '@netlify/functions'
import { getCompanyId, getSupabaseAdmin } from './_shared/db'
import { json } from './_shared/domain'

const demoMetrics = {
  newLeads: 7,
  missedCallsRecovered: 4,
  jobsBooked: 3,
  estimatedRevenue: 1250,
  reviewsRequested: 2,
  closeRate: 43,
  responseTimeSeconds: 45,
}

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return json({})
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const supabase = getSupabaseAdmin()
  if (!supabase) return json({ metrics: demoMetrics, source: 'demo' })

  const companyId = getCompanyId()
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const [{ data: leads }, { data: jobs }, { data: followups }] = await Promise.all([
    supabase.from('leads').select('source, estimated_value, status').eq('company_id', companyId).gte('created_at', since),
    supabase.from('jobs').select('status, revenue, lead_id').gte('created_at', since),
    supabase.from('followups').select('type, status').gte('created_at', since),
  ])

  const leadRows = leads ?? []
  const booked = leadRows.filter((lead) => lead.status === 'booked').length
  const estimatedRevenue = leadRows.reduce((sum, lead) => sum + Number(lead.estimated_value ?? 0), 0)
  const completedRevenue = (jobs ?? []).reduce((sum, job) => sum + Number(job.revenue ?? 0), 0)

  return json({
    metrics: {
      newLeads: leadRows.length,
      missedCallsRecovered: leadRows.filter((lead) => lead.source === 'missed_call').length,
      jobsBooked: booked,
      estimatedRevenue: Math.max(estimatedRevenue, completedRevenue),
      reviewsRequested: (followups ?? []).filter((followup) => followup.type === 'review_request').length,
      closeRate: leadRows.length ? Math.round((booked / leadRows.length) * 100) : 0,
      responseTimeSeconds: 45,
    },
    source: 'supabase',
  })
}

export const config: Config = {
  path: '/api/dashboard/metrics',
  method: ['GET', 'OPTIONS'],
}
