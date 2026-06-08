# ServicePilot

**The autonomous commercial lead engine for multi-location locksmith companies.**

Big locksmith companies don't grow by waiting for the phone to ring — they grow by winning standing commercial accounts: property-management portfolios, hospitals, universities, hotels, apartment communities, dealerships, malls. ServicePilot puts a team of AI agents on that job and lets them run.

You give it a territory. The agents go and **find real commercial accounts on the live map, qualify and score every one, estimate its annual value, and draft the first-touch outreach** — continuously, on their own. The sales leader only steps in to approve.

There is **no seeded data**. Every account in the pipeline is a real place the agents discovered from OpenStreetMap and scored in front of you. State is saved in your browser, so the pipeline the agents build is yours and persists across reloads.

## The AI workforce

| Agent | Job | What it does, autonomously |
|---|---|---|
| **Scout** | Finds accounts | Scans a real territory (OpenStreetMap) for commercial properties that need a locksmith on contract |
| **Quinn** | Qualifies & scores | Scores each account 0–100 for fit, assigns an A/B/C tier, and estimates annual contract value from real size signals |
| **Wren** | Writes outreach | Drafts a tailored first-touch message for each high-priority account |
| **Cole** | Starts outreach | Queues the send for your approval — or fires it himself in full-auto mode |
| **Ada** | Watches the pipeline | Tracks coverage, pipeline value, and tells you when to add a territory |

## How it works

1. **Add a territory** (e.g. `Dallas, TX`). The Scout geocodes it and queries OpenStreetMap Overpass for commercial accounts across 15+ segments — property managers, hospitals, universities, apartments, hotels, government, dealerships, storage, malls, banks, warehouses, and more.
2. **Quinn qualifies** each real account: a fit score, an A/B/C tier (high-value segments like property management and hospitals are floored at A), and an estimated annual contract value derived from real attributes (hotel room counts, building height, bed counts, chain operators).
3. **Wren drafts** a personalized first touch for the top accounts.
4. **You approve** (or run full-auto). Approved accounts move to *Contacted*; mark the winners *Won* to track booked annual value.

Everything streams into one command center: live KPIs, a Found → Qualified → Ready → Contacted → Won funnel, the territory map of work, the agent team's live status, a **Needs your OK** approval inbox, and a real-time activity feed.

### Autonomy: you hold the leash

- **Ask first** — agents do all the work but stop at the send. Each outreach lands in the approval inbox.
- **Full auto** — agents proceed on their own and just log what they did.

### Optional: real Claude reasoning (bring your own key)

Out of the box, the agents use a strong built-in writer and scorer — no key required, works for everyone. Flip on **Claude reasoning** in Settings and paste an Anthropic API key, and Wren writes outreach and per-account angles with a real model (Claude Haiku 4.5 or Sonnet 4.6). The key is stored only in your browser's `localStorage` and is sent directly from your browser to Anthropic — it never touches a server.

## Why this is genuinely agentic

- **Real tools, real data** — agents call live OpenStreetMap (Nominatim + Overpass) and, optionally, the Anthropic API. Nothing is mocked or seeded.
- **An autonomous loop** — a tick-based orchestrator decides what to do next (scan, qualify, draft, advance) based on pipeline state, not a script.
- **Human-in-the-loop** — agents escalate exactly the decisions a person should make and act on everything else.
- **Stateful** — the pipeline persists in the browser and grows the more territories you give it.

## Tech stack

- React + TypeScript + Vite, framer-motion
- Live data: OpenStreetMap Nominatim (geocoding) + Overpass (business search) — free, keyless, CORS-enabled
- Optional AI: Anthropic Messages API, called directly from the browser (bring-your-own-key)
- State: browser `localStorage` (no backend required for the engine)
- Deploy: static site (GitHub Pages / Netlify). The repo also ships Netlify Functions for a future server-backed pilot.

## Local development

```bash
npm install
npm run dev
```

Checks:

```bash
npm run build
npm run lint
npm run typecheck:functions
```

## Using it

1. Open the app and click **Start agents** (or just add a territory — that starts them).
2. Watch the Scout populate the pipeline with real accounts and Quinn score them.
3. Open any account to see its value, why it scored that way, and the drafted outreach.
4. Approve outreach in **Needs your OK**, or switch to **Full auto**.
5. Add more territories to expand coverage. **Reset** (in Settings) clears the pipeline and rescans.

## Deployment

Static build — `npm run build` outputs `dist/`. This repo auto-deploys `main` to GitHub Pages via `.github/workflows/deploy-pages.yml`. `netlify.toml` is included for Netlify (and its serverless functions) if you want a server-backed pilot later.

## Notes

- The engine works fully without any API keys. If the live map is briefly unreachable, the Scout falls back to a clearly-labeled sample so the demo never looks broken — every other path is real data.
- Calling Anthropic directly from the browser exposes your key to client-side code; use a scoped key and rotate it. For production, proxy AI calls through the included Netlify Functions instead.
