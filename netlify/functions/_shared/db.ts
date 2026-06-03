import { createClient } from '@supabase/supabase-js'
import { demoCompanyId, getEnv } from './domain'

export function getCompanyId() {
  return getEnv('SERVICEPILOT_COMPANY_ID') || demoCompanyId
}

export function getSupabaseAdmin() {
  const url = getEnv('SUPABASE_URL')
  const key = getEnv('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) {
    return null
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function recordEvent(event: {
  companyId?: string
  leadId?: string
  provider: string
  eventType: string
  payload: Record<string, unknown>
}) {
  const supabase = getSupabaseAdmin()
  if (!supabase) return { stored: false }

  const { error } = await supabase.from('integration_events').insert({
    company_id: event.companyId ?? getCompanyId(),
    lead_id: event.leadId,
    provider: event.provider,
    event_type: event.eventType,
    payload: event.payload,
  })

  if (error) {
    console.error('integration_events insert failed', error)
    return { stored: false, error: error.message }
  }

  return { stored: true }
}
