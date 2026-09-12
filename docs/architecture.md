# CLZ Marketing & Lead Management System — Architecture

This document is the approved architecture for the system, carried over from the planning
session. It is the reference for how Phase 1 was built and how Phases 2–4 are meant to attach
to it later. See `CLAUDE.md` for day-to-day working conventions.

## Context

CLZ Resources Sdn Bhd needs an AI-powered marketing and lead management system built in 4
phases:

1. **Campaign & Targeting Setup** — marketing staff define a campaign and select target
   buildings from existing datasets. *(This is what's built so far.)*
2. **Content & Launch** — AI generates platform-specific creative drafts from a confirmed
   campaign; humans review/approve/launch.
3. **Acquisition & Engagement** — WhatsApp AI (Meta Cloud API) handles inbound leads, classifies
   them Hot/Warm/Cold, and runs automated follow-ups.
4. **Outcome & Feedback** — humans record sale outcomes; the system aggregates the funnel
   (Ad → Click → WhatsApp Enquiry → Application → Qualified Lead → Sale) for campaign comparison.

Only Phase 1 is implemented. The schema and service boundaries below are designed so Phases
2–4 can be added without reworking Phase 1.

## Technology Stack

| Concern | Choice |
|---|---|
| Language/Framework | TypeScript + Next.js 16 (App Router) |
| Database | Supabase PostgreSQL |
| ORM | Prisma (against the Supabase Postgres connection string) |
| Auth | Supabase Auth (email/password). No role system in Phase 1 — every authenticated staff user can do everything. Staff identity is Supabase's `auth.users`; app tables reference it by UUID (no Prisma-managed FK, since it's a separate Postgres schema). |
| UI | Tailwind CSS + shadcn/ui |
| Validation | Zod |
| Testing | Vitest |
| AI (Phase 2/3 — not built yet) | Anthropic Claude API |
| Messaging (Phase 3 — not built yet) | Meta WhatsApp Cloud API |

## Application Architecture

```
Presentation  → Next.js pages (staff UI: campaign wizard, dataset list)
API layer     → Next.js route handlers (/api/*) — will also host future webhooks
Service layer → domain services (framework-agnostic business logic)
Data layer    → Prisma client → Supabase PostgreSQL
```

**Human/AI/system separation** is enforced structurally, not just by folder convention: every
mutating action is stamped with `actor_type` (`human | ai | system`) and `actor_id`, written to
a shared `activity_log` table. Service functions take `actor` as a required parameter. Phase 1
only ever writes `actor_type = 'human'`, but the column and the function signatures exist from
day one so Phase 2/3 automation slots in without a schema change.

**Campaign status state machine** (enum reserves the full lifecycle; Phase 1 implements only the
first transition):

```
draft → confirmed → content_ready → live → active → closed
        ^^^^^^^^^^^^^^^^^^^^^^^^^^
        Phase 1 scope. Later values are reserved and unused by Phase 1 code.
```

No background jobs, queues, or webhooks exist in Phase 1 — nothing is async yet. Phase 3 will
need a scheduler for Day 1/3/7 follow-ups and a webhook receiver for the WhatsApp Cloud API;
that's out of scope here.

## Database Tables (Phase 1)

- **datasets** — one uploaded file = one independent dataset. Datasets are never merged,
  cleaned, matched, or deduplicated against each other, at import time or later.
- **buildings** — always scoped to exactly one dataset (`dataset_id` not null). Unmapped source
  columns are kept in `raw_attributes` (jsonb) rather than forcing a rigid import schema.
- **campaigns** — `official_pricing` (jsonb: amount/currency/terms) and `differentiators`
  (jsonb array) are **separate fields, never merged**. This distinction is what lets Phase 2's
  AI content generation later treat official facts as ground truth and differentiators as
  freely creative marketing angles.
- **campaign_datasets** — join table: which dataset(s) a campaign targets.
- **campaign_buildings** — primary key `(campaign_id, building_id)`, plus a `dataset_id` column
  kept explicit alongside `building_id` so dataset origin is visible directly in the table, not
  just inferred through `buildings`.
- **activity_log** — generic audit trail (`entity_type`, `entity_id`, `action`, `actor_type`,
  `actor_id`, `metadata`).

Deferred to later phases (not migrated yet, just documented so `campaign_id` stays a stable FK
for them): `creatives` (Phase 2), `leads` / `lead_status_history` / `whatsapp_messages`
(Phase 3), `outcomes` / `funnel_events` (Phase 4).

## Phase 1 → Phase 2 Contract

`campaign-service.ts` exposes one read model, `getCampaignBrief(campaignId)`, returning exactly
what Phase 2's content generation will need:

```ts
{
  campaignId,
  productPromotion,
  officialPricing,      // kept distinct
  differentiators,      // kept distinct from officialPricing, never merged
  targetingSummary: { datasetCount, buildingCount, buildings: [...] }
}
```

This is the **only** interface Phase 2 will call — it never queries Phase 1 tables directly.
Only confirmed campaigns (`status` at or past `confirmed`) can produce a brief.
