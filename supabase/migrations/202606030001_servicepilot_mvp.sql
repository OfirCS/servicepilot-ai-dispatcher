create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_name text not null,
  owner_phone text not null,
  phone_number text,
  service_area text not null default '',
  google_review_link text,
  calendar_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_name text,
  customer_phone text not null,
  address text,
  city text,
  service_type text not null default 'other',
  urgency text not null default 'normal' check (urgency in ('emergency', 'same_day', 'normal', 'quote')),
  status text not null default 'captured' check (status in ('captured', 'qualifying', 'qualified', 'booked', 'completed', 'lost')),
  source text not null default 'missed_call',
  estimated_value numeric(10, 2) not null default 0,
  call_sid text,
  summary text,
  car_trapped boolean not null default false,
  preferred_time text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  company_id uuid references public.companies(id) on delete cascade,
  direction text not null check (direction in ('inbound', 'outbound', 'internal')),
  channel text not null check (channel in ('sms', 'voice', 'email', 'dashboard')),
  body text not null,
  provider_message_id text,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  scheduled_time timestamptz,
  technician_name text,
  status text not null default 'needs_dispatch' check (status in ('needs_dispatch', 'scheduled', 'completed', 'cancelled')),
  revenue numeric(10, 2) not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.followups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null check (type in ('quote_followup', 'lost_lead_recovery', 'review_request')),
  scheduled_for timestamptz not null,
  sent_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'sent', 'cancelled', 'failed')),
  created_at timestamptz not null default now()
);

create table if not exists public.integration_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  lead_id uuid references public.leads(id) on delete set null,
  provider text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists leads_company_status_created_idx
  on public.leads (company_id, status, created_at desc);

create index if not exists leads_phone_company_idx
  on public.leads (company_id, customer_phone);

create index if not exists messages_lead_created_idx
  on public.messages (lead_id, created_at);

create index if not exists jobs_lead_status_idx
  on public.jobs (lead_id, status);

create index if not exists followups_due_idx
  on public.followups (status, scheduled_for)
  where status = 'scheduled';

create or replace function public.touch_lead_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_leads_updated_at on public.leads;
create trigger touch_leads_updated_at
  before update on public.leads
  for each row
  execute function public.touch_lead_updated_at();

alter table public.companies enable row level security;
alter table public.leads enable row level security;
alter table public.messages enable row level security;
alter table public.jobs enable row level security;
alter table public.followups enable row level security;
alter table public.integration_events enable row level security;

create policy "service role manages companies" on public.companies
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "service role manages leads" on public.leads
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "service role manages messages" on public.messages
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "service role manages jobs" on public.jobs
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "service role manages followups" on public.followups
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create policy "service role manages integration events" on public.integration_events
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into public.companies (
  id,
  name,
  owner_name,
  owner_phone,
  phone_number,
  service_area,
  google_review_link,
  calendar_id
) values (
  '00000000-0000-4000-8000-000000000001',
  'Northline Door & Lock',
  'Mike',
  '+14165550111',
  '+14165550184',
  'North York, Toronto, Vaughan',
  'https://g.page/r/demo-review-link',
  'primary'
) on conflict (id) do nothing;

insert into public.leads (
  id,
  company_id,
  customer_name,
  customer_phone,
  address,
  city,
  service_type,
  urgency,
  status,
  source,
  estimated_value,
  call_sid,
  summary,
  car_trapped,
  preferred_time
) values
  (
    '00000000-0000-4000-8000-000000000101',
    '00000000-0000-4000-8000-000000000001',
    'David',
    '+14165550184',
    null,
    'North York',
    'stuck_closed',
    'emergency',
    'qualified',
    'missed_call',
    475,
    'DEMO_CALL_001',
    'Garage door stuck closed. Customer says the car is inside and needs help today.',
    true,
    'Today'
  ),
  (
    '00000000-0000-4000-8000-000000000102',
    '00000000-0000-4000-8000-000000000001',
    'Rachel Kim',
    '+14165550185',
    '84 Willowbend Ave',
    'Toronto',
    'broken_spring',
    'same_day',
    'booked',
    'inbound_sms',
    650,
    null,
    'Broken torsion spring. Same-day window accepted.',
    false,
    '12:30-2:00'
  )
on conflict (id) do nothing;
