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

`app/api/generate-map/route.ts` is a server-only Next.js Route Handler that calls Claude (`claude-opus-4-8`, adaptive thinking, `effort: "high"`, structured output via `output_config.format` so the JSON is schema-guaranteed, not regex-extracted) with a senior-architect/specialist persona (`lib/prompts.ts`). This was pulled forward from Phase 4 (which specs a Convex action instead) specifically because no deterministic template can produce genuinely technical, logically accurate content for an arbitrary topic — that's the actual fix for "this content isn't technical/logical enough," not more mock categories.

Every `ArchitectureNode` carries four separate fields, `what` / `why` / `how` / (on `ZenithNode`) `insight`, instead of one flat description — this was a direct fix for real generation output reading as "theoretical, just verbiage." The persona prompt explicitly instructs the model to scale technical depth to what the topic actually demands (grade-school topic stays plain and correct; a graduate/research-level topic goes all the way to real mechanisms, numbers, and named techniques) and to make depth grow across the map's 4 phases (fundamentals → real practice → expert tradeoffs → frontier). The mock fallback (`lib/mockGenerate.ts`) mirrors the same four-field shape with hand-written content so the type contract holds and the UI looks the same either way, but it's still fixed prose per category, not depth-calibrated to an arbitrary topic — that calibration is only real for the live-generation path.

Requires `ANTHROPIC_API_KEY` in `.env.local` (gitignored, never commit a real key). **Without a key configured, the app still works** — `lib/realGenerate.ts`'s `tryGenerateArchitectureViaApi()` returns `null` on any failure (no key, network error, malformed response) and `app/providers.tsx`'s `createMap` falls back to the deterministic mock generator. Same real API response seeds both the architecture map and the zenith sidebar (one call, two consistent views) — don't split that into two calls.

Only the architecture map's generation was pulled forward. `generateReferences`, `generateImplementations`, and the Challenges iteration content (`buildIterationPractice`, `buildQuiz`) are still the Phase 1 mock stub — extending real generation to those is a reasonable next step but wasn't done here, don't assume it already happened.

### Real dependency links, not positional pairing

Early versions computed `prereqIds` by pairing node index N in phase P with node index N in phase P-1 — purely positional, no actual logical relationship, which read as "no meaningful sequential logic" because the arrows genuinely weren't meaningful. Fixed: the generation schema now requires each node to include `dependsOn`, an array of the *exact* label strings of specific earlier-phase nodes it genuinely depends on (model's own reasoning, phase 1 nodes always empty). `lib/realGenerate.ts`'s `buildArchitectureMapFromPayload` resolves those labels to node ids via a label-to-id map built strictly phase by phase, so a node can only ever resolve to something from an earlier phase. If you touch this, don't reintroduce index-based pairing — it looks fine in code and produces garbage dependency graphs.

### Clarifying questions before generation

`app/api/clarify-topic/route.ts` is a second, lightweight Claude call (same key/persona/fallback discipline as generate-map, smaller `max_tokens`) that judges whether the raw typed topic is genuinely ambiguous before committing to a full 4-phase generation. If so, it returns up to 3 short questions with 2-4 options each; `app/architecture/page.tsx` shows them via `ClarifyingQuestions` before generating, and the answers get serialized into a `context` string threaded into the main generation prompt. If the topic is already clear, or the clarify call fails/no key, it skips straight to generation exactly like before — this is strictly additive, never a required step.

### Label repetition

Node/zenith labels no longer get a mechanical `"${topic}: "` prefix — that was 9-12x literal repetition of whatever the user typed, which read as templated, not intelligent. The persona prompt now explicitly tells the model the raw input is "intent to interpret, not a label to echo back," and every label must stand alone as a real heading. Don't reintroduce topic-prefixing on node labels.

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
