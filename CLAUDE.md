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

### Zenith gap tracking and spaced repetition

Zenith is not just a static reference panel, it's a live gap map. Each `ZenithNode` carries a `reinforcement: ReinforcementState` (`lib/types.ts`): `boxLevel` (0 = never reinforced, a genuine gap; 1-5 = Leitner review boxes), `timesReinforced`, `lastPracticedAt`, `dueAt`. `lib/spacedRepetition.ts` implements the actual scheduling: a plain Leitner box system (fixed review intervals per box, promote on a pass, reset to box 1 on a miss), deliberately chosen because it's zero-cost, deterministic, needs no API call, and is the same mechanism under Anki's card scheduling, just unused outside flashcard apps.

Every completed quiz attempt in Challenges (`submitQuizAttempt` in `app/providers.tsx`) reinforces exactly one zenith node via `pickNodeToReinforce`: untouched nodes first (building initial coverage across the map), then whichever touched node is most overdue (spacing review across real time once everything's been touched at least once). This is intentionally not tied to a specific implementation's content, since implementations don't carry an explicit link back to individual zenith nodes yet, that would need real per-node semantic tagging in generation, not something to fake with positional pairing.

`ZenithSidebar` shows a gap-state dot per node (grey = gap/untouched, amber = due for review, green = recently reinforced, `lib/spacedRepetition.ts`'s `gapState`) and a header count ("N of M reinforced"), reusing the app's existing grey/green/amber color language, no new colors introduced. `ImplementationRunSummary` echoes the same count after finishing a run, as the guided nudge connecting Challenges back to Zenith. If you touch iteration completion logic, keep the reinforcement call wired to the actual quiz-submission event, not to `advanceIteration`, since a rep can be quizzed without being advanced past yet (retries).

### Zenith structure, function, and market grounding

`ZenithNode` splits what used to be a single `how` field into `structure` (what the concept is actually composed of, how its parts connect) and `behavior` (how it actually operates at runtime, in motion), so the sidebar reads as a working model of the subject rather than description. Each node also carries `marketImplementation`: one specific, real, named current product/company/deployed system that's genuinely among the most advanced real-world applications of that exact subtopic, or an honest "nothing current stands out, this is still research" if the model isn't confident one exists. This claim is explicitly the most perishable field in the schema, the persona (`lib/prompts.ts`) tells the model to flag low confidence rather than manufacture a plausible-sounding name, since what's cutting edge can go stale between training and read time. The mock fallback leaves `marketImplementation` as an empty string (same pattern as `equation`, conditionally hidden in the UI) rather than inventing one, since mock has no real per-topic market knowledge to draw on.

### The structure/behavior/connection triad

Every `ZenithNode` is described through the same three lenses regardless of topic: `structure` (what it's composed of), `behavior` (how it operates at runtime), and `connection` (the technical link to what it depends on). These aren't three unrelated fields, they're one architectural picture seen three ways, the same triad any real systems diagram needs (composition, behavior, connections), the same idea whether the topic is distributed caching or cell biology. The persona (`lib/prompts.ts`) explicitly tells the model to keep the three coherent as one thing per node, not fill them in independently. Don't reintroduce a blended single field here, and don't add topic-specific visual styling (this came up once as a literal request for a cyberpunk network diagram illustration, decided against, kept as text calibrated per topic instead).

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
