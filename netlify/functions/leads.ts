import type { Config } from '@netlify/functions'
import { getCompanyId, getSupabaseAdmin } from './_shared/db'
import { classifyIntake, json, readBody } from './_shared/domain'

const demoLeads = [
  {
    id: 'LD-2051',
    customerName: 'David',
    customerPhone: '+1 416 555 0184',
    city: 'North York',
    issueType: 'Garage door stuck closed',
    urgency: 'emergency',
    status: 'qualified',
    source: 'missed_call',
    estimatedValue: 475,
    carTrapped: true,
    preferredTime: 'Today',
    summary: 'Customer says the door is stuck closed and the car is inside. Needs same-day dispatch.',
    receivedAt: '2 min ago',
    lastMessage: 'Hi David, sorry we missed your call. Is the garage door stuck open or closed, and is a car trapped inside?',
    timeline: ['Missed call detected.', 'Recovery SMS sent.', 'AI classified emergency.', 'Owner summary queued.'],
  },
]

export default async (req: Request) => {
  if (req.method === 'OPTIONS') return json({})

  const supabase = getSupabaseAdmin()
  const companyId = getCompanyId()

  if (req.method === 'GET') {
    if (!supabase) return json({ leads: demoLeads, source: 'demo' })

    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) return json({ error: error.message }, 500)
    return json({ leads: data, source: 'supabase' })
  }

  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const body = await readBody(req)
  const customerPhone = String(body.customerPhone ?? body.From ?? '')
  const message = String(body.message ?? body.Body ?? '')
  const intake = classifyIntake(message)

  if (!supabase) {
    return json({
      lead: {
        id: `DEMO_${Date.now()}`,
        customerPhone,
        summary: intake.summary,
        status: intake.status,
        urgency: intake.urgency,
        issueType: intake.issueType,
      },
      intake,
      source: 'demo',
    })
  }

  const { data, error } = await supabase
    .from('leads')
    .insert({
      company_id: companyId,
      customer_name: body.customerName ?? null,
      customer_phone: customerPhone,
      address: body.address ?? null,
      city: body.city ?? null,
      service_type: intake.issueType,
      urgency: intake.urgency,
      status: intake.status,
      source: body.source ?? 'manual',
      estimated_value: intake.estimatedValue,
      summary: intake.summary,
      preferred_time: body.preferredTime ?? null,
    })
    .select()
    .single()

  if (error) return json({ error: error.message }, 500)

  return json({ lead: data, intake, source: 'supabase' }, 201)
}

export const config: Config = {
  path: ['/api/leads', '/dashboard/leads'],
  method: ['GET', 'POST', 'OPTIONS'],
}
