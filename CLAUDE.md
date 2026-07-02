# Learning Architecture

One web app, two linked modes, plus a persistent reference panel:

- **Architecture** — type a topic, get a phased dependency map of subtopics, check them off, get references on completion.
- **Zenith sidebar** — persistent across both tabs, tracks whatever topic is currently active (`activeMapId` in `app/providers.tsx`). An idealized, non-interactive reference version of the topic to aspire toward. Generated once per topic and cached by slug (`zenithsBySlug`), same intent as the real spec's `generationCache`.
- **Challenges** — pick 1 of 10 generated real-world implementation angles for the active topic, choose a rep count, and drill it: each iteration forces exactly one varying factor (a parameter/dynamic), closes with a 5-question reflective check (not gating — low scores unlock up to 2 retries, but "Continue" is always available), and a checklist tracks genuine repeated practice across iterations. This replaced the original single-scenario Challenges flow.

Full build spec, tech stack rationale, data model, and phase-by-phase plan: `SPEC.md` in this repo.

## Current phase: Phase 1 — Core merge, no auth, no billing, single local user

State lives in React context (`app/providers.tsx`), not a database. Do not add a database, auth, or billing in this phase.

Next phase (Phase 2) stands up the Convex schema and moves state out of context into Convex queries/mutations — see build spec section 8.

## Architecture map generation: real, with a mock fallback

`app/api/generate-map/route.ts` is a server-only Next.js Route Handler that calls Claude (`claude-opus-4-8`, adaptive thinking, structured output via `output_config.format` so the JSON is schema-guaranteed, not regex-extracted) with a senior-architect/specialist persona (`lib/prompts.ts`). This was pulled forward from Phase 4 (which specs a Convex action instead) specifically because no deterministic template can produce genuinely technical, logically accurate content for an arbitrary topic — that's the actual fix for "this content isn't technical/logical enough," not more mock categories.

Requires `ANTHROPIC_API_KEY` in `.env.local` (gitignored, never commit a real key). **Without a key configured, the app still works** — `lib/realGenerate.ts`'s `tryGenerateArchitectureViaApi()` returns `null` on any failure (no key, network error, malformed response) and `app/providers.tsx`'s `createMap` falls back to the deterministic mock generator. Same real API response seeds both the architecture map and the zenith sidebar (one call, two consistent views) — don't split that into two calls.

Only the architecture map's generation was pulled forward. `generateReferences`, `generateImplementations`, and the Challenges iteration content (`buildIterationPractice`, `buildQuiz`) are still the Phase 1 mock stub — extending real generation to those is a reasonable next step but wasn't done here, don't assume it already happened.

## Stack (target, full spec)

Next.js (App Router) + TypeScript + Tailwind · Convex · Clerk · Anthropic API via Convex actions · Vercel + Convex Cloud · Stripe · IndexedDB (idb-keyval). Only Next.js + TypeScript + Tailwind are installed so far — everything else lands in its named phase, not before.

## Key files

| File | Purpose |
|------|---------|
| `app/providers.tsx` | All app state (maps, zenith/implementation caches, implementation runs) and the mutating actions. `activeMapId` is the single shared "current topic" read by both pages and `ZenithSidebar`. Will become Convex queries/mutations in Phase 2. |
| `app/api/generate-map/route.ts`, `lib/realGenerate.ts`, `lib/prompts.ts` | Real Claude-powered architecture map generation (server-only key, structured JSON output, senior-architect persona). See section above. |
| `lib/mockGenerate.ts` | Fallback used when no API key is configured (or the real call fails), and still the only source for references/implementations/challenges content. Keyword-classified into categories (networking, language, systems, security, data, process, general fallback) rather than one fixed template with the topic string substituted in — better than nothing, but `classifyTopic()` is a plain substring match, not real understanding. |
| `lib/nodeStatus.ts` | locked / ready / completed derivation from `prereqIds`. |
| `lib/offlineExport.ts` | Builds the standalone offline-export HTML. Must render the full graph (phases + prereq connector lines) above the flat checklist, both reading/writing the same completion state — this was a fix to the original prototype's export, which only rendered the flat checklist. Seeds from the map's current completion state at export time, then hands off to the exported file's own localStorage. |
| `app/architecture/page.tsx` | Map generation + display. |
| `app/challenges/page.tsx` | Orchestrates picker → active iteration run → completion summary. The `IterationFlow` subcomponent is remounted (via `key`) on every iteration change so its local "quiz revealed" state resets automatically — don't replace that with manual state syncing. |
| `components/ZenithSidebar.tsx`, `ImplementationPicker.tsx`, `IterationChecklist.tsx`, `IterationPracticeCard.tsx`, `IterationQuizCard.tsx`, `ImplementationRunSummary.tsx` | Zenith panel + the full Challenges iteration flow. |

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
