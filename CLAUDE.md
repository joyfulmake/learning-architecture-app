# Learning Architecture

One web app, two linked modes: **Architecture** (type a topic, get a phased dependency map of subtopics, check them off, get references on completion) and **Challenges** (pick a subtopic, work through a branching judgment scenario, get a clean-pass or scar verdict).

Full build spec, tech stack rationale, data model, and phase-by-phase plan: see the project brief in the conversation that created this repo (not yet checked in as a file — ask before assuming it lives elsewhere).

## Current phase: Phase 1 — Core merge, no auth, no billing, single local user

State lives in React context (`app/providers.tsx`), not a database. Generation is stubbed (`lib/mockGenerate.ts`, no real Anthropic calls) with a simulated network delay so the UI/interaction logic can be verified end to end before Convex, Clerk, Stripe, or the real AI proxy exist. Do not add a database, auth, or billing in this phase.

Next phase (Phase 2) stands up the Convex schema and moves state out of context into Convex queries/mutations — see build spec section 8.

## Stack (target, full spec)

Next.js (App Router) + TypeScript + Tailwind · Convex · Clerk · Anthropic API via Convex actions · Vercel + Convex Cloud · Stripe · IndexedDB (idb-keyval). Only Next.js + TypeScript + Tailwind are installed so far — everything else lands in its named phase, not before.

## Key files

| File | Purpose |
|------|---------|
| `app/providers.tsx` | All app state (architecture maps, challenge runs) and the mutating actions. Will become Convex queries/mutations in Phase 2. |
| `lib/mockGenerate.ts` | Stand-in for the Convex action + Anthropic call. Deterministic, local, simulated delay. Replace wholesale in Phase 4 — don't patch it to be "more real." |
| `lib/nodeStatus.ts` | locked / ready / completed derivation from `prereqIds`. |
| `lib/offlineExport.ts` | Builds the standalone offline-export HTML. Must render the full graph (phases + prereq connector lines) above the flat checklist, both reading/writing the same completion state — this was a fix to the original prototype's export, which only rendered the flat checklist. Seeds from the map's current completion state at export time, then hands off to the exported file's own localStorage. |
| `app/architecture/page.tsx`, `app/challenges/page.tsx` | The two modes. |

## UI rules (don't relitigate)

White/bright background, no dark mode as first-class. Bold, larger-than-default typography. Color language: grey = locked, green = ready/done, amber = scar/warning. No accordions on the architecture view — everything visible and scrollable. No em dashes in UI copy or generated-content prompts.

## Commands

```bash
npm run dev      # localhost:3000
npm run build
npx tsc --noEmit
npx eslint .
```

## Deploy

Not yet deployed. Target per spec: Vercel (frontend) + Convex Cloud (backend), once Phase 2+ exist.
