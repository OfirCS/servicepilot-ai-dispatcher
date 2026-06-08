# ServicePilot

**The AI front desk for locksmiths.**

ServicePilot is an **agentic AI workforce** for small locksmith businesses. A team of AI agents answers missed calls, qualifies the job over text, books the work, finds new commercial accounts, and asks happy customers for reviews — on their own. The owner stays in control and only steps in when an agent asks for the OK.

The whole product is **one calm home screen** built for a busy owner who is usually on a job, not at a desk:

- **Needs your OK** — the human-in-the-loop inbox. Agents do the work and only stop here when a person should decide.
- **Today's jobs** — every missed call and text the agents turned into a real job, one tap to open.
- **Your AI team** — five named agents and what each one is doing right now.
- **Live activity** — the autonomous actions the agents have taken.
- **Try a missed call** and **Find new accounts** — the demo and the outbound prospector, available as inline actions.

### The AI workforce

| Agent | Job | What it does |
|---|---|---|
| Riley | Answers the phone | Recovers missed calls with an instant text-back |
| Iris | Qualifies the job | Figures out lockout vs. rekey vs. car key, the location, and urgency |
| Dex | Books & schedules | Books the job and sets the arrival window |
| Pia | Finds new accounts | Finds local commercial accounts worth a standing relationship |
| Remy | Earns 5-star reviews | Asks happy customers for a Google review |

## Why locksmiths

A locksmith's calls are high-intent and time-sensitive: someone is locked out of a car or house, a new tenant needs a rekey, a shop lost the only key fob. If no one answers in the first minute, the customer calls the next locksmith. ServicePilot makes sure the first response always happens — instantly, by text — even when the owner is under a dash or drilling a lock.

### Ideal customer

- Owner-operated or small-crew locksmiths (1–10 techs)
- Mobile, mostly on the road, missing calls during jobs and after hours
- Buying leads from Google, Yelp, or paid search and losing the ones they can't answer

The agents generalize cleanly to other emergency home services (garage doors, HVAC, plumbing, appliance repair) — locksmiths are the wedge because the urgency and per-job value are obvious and easy to measure.

### Wedge

Missed-call recovery. The before/after metric is concrete: missed calls recovered, jobs qualified, jobs booked, revenue saved, and reviews requested.

### Lead finder (outbound)

Missed-call recovery is the inbound side. The Lead Finder is the outbound side: **Pia** goes and finds new accounts for the owner. Open **Find new accounts**, type a service area, and she:

1. Geocodes the area with OpenStreetMap Nominatim.
2. Scans OpenStreetMap Overpass for the local businesses that need a locksmith on call — property managers, car dealerships, self-storage, hotels, real estate offices, and auto shops.
3. Scores each account for fit, estimates the yearly value, and drafts a ready-to-send first message.
4. Lets the owner push any account into the same job queue with one tap.

This uses **real, free, keyless data** (OpenStreetMap), so it works in the browser during `npm run dev` and on Netlify without configuration. If the live source is ever unreachable, it falls back to a deterministic sample set so the demo never breaks.

### Revenue model

- $299/month per location for missed-call recovery and review automation
- Optional usage pass-through for Twilio SMS/calls
- Later: dispatch automation, calendar sync, and CRM integrations

One recovered emergency lockout or rekey can cover much of the monthly price; recovered car-key and commercial jobs and compounding reviews do the rest.

## Architecture

```text
Customer call / SMS
        ↓
Twilio phone number
        ↓
Netlify Functions
        ↓
AI intake classifier
        ↓
Supabase Postgres
        ↓
Owner gets a job summary + one-tap actions
        ↓
Booking + review follow-up
        ↓
Home-screen metrics
```

## Tech stack

- Frontend: React, TypeScript, Vite (single-screen owner dashboard, framer-motion drawers)
- Hosting/API: Netlify + Netlify Functions
- Database: Supabase Postgres
- Phone/SMS: Twilio
- AI: deterministic demo classifier now, OpenAI-ready via `OPENAI_API_KEY`
- Lead sourcing: OpenStreetMap (Nominatim geocoding + Overpass), free and keyless

## API routes

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/twilio/inbound-call` | Forward inbound calls and attach a no-answer callback |
| `POST` | `/api/twilio/call-status` | Trigger missed-call recovery SMS |
| `POST` | `/api/twilio/inbound-sms` | Classify customer replies and return Twilio XML |
| `POST` | `/api/ai/intake` | Classify the job, urgency, missing fields, and reply |
| `POST` | `/api/marketing/prospect` | Find local commercial accounts as outbound leads |
| `POST` | `/api/calendar/book` | Create a scheduled job |
| `POST` | `/api/followups/review` | Send a review request SMS |
| `GET` | `/api/dashboard/metrics` | Return home-screen metrics |
| `GET/POST` | `/api/leads` | Demo/Supabase lead access |

## Local development

```bash
npm install
npm run dev
```

Run checks:

```bash
npm run build
npm run lint
npm run typecheck:functions
```

## Environment variables

Copy `.env.example` and set values locally or in Netlify.

Required for production:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`
- `OWNER_PHONE_NUMBER`
- `FORWARD_TO_NUMBER`

Optional:
- `OPENAI_API_KEY`
- `GOOGLE_CALENDAR_ID`

Keep `SERVICEPILOT_DEMO_MODE=true` until real SMS sending is intended.

## Supabase setup

Run the migration in `supabase/migrations/202606030001_servicepilot_mvp.sql`.

Tables: `companies`, `leads`, `messages`, `jobs`, `followups`, `integration_events`. All public tables have RLS enabled. Server writes use the Supabase service role key from Netlify Functions only — never expose it in the browser.

## Twilio setup

- Voice webhook: `https://YOUR_SITE.netlify.app/api/twilio/inbound-call`
- Messaging webhook: `https://YOUR_SITE.netlify.app/api/twilio/inbound-sms`

The voice route forwards calls to `FORWARD_TO_NUMBER`. If the call is not answered, Twilio posts to `/api/twilio/call-status`, which sends the missed-call recovery SMS.

## Deployment

This repo includes `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

## Current status

A functional MVP with production-shaped integration boundaries. It runs locally in demo mode without any API keys, and is ready to connect to Supabase, Twilio, and Netlify environment variables for a real locksmith pilot.
