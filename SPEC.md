# Unified Learning Architecture App — Build Spec

Written in phases on purpose. Execute one phase, verify it, then move to the next. Do not build all of this in one shot.

**v2 update:** folds in a real answer to "does this need an API" (yes — see section 9 for what was considered and rejected) and a fix for the offline export only shipping a flat checklist instead of the full graph the user actually built (section 4.1).

---

## 0. What this app actually is

One web app, two linked modes, shared login, shared data:

1. **Architecture mode** — user types a topic, gets a phased dependency map of subtopics, checks them off, gets references on completion.
2. **Implementation Challenges mode** — pick a subtopic from the map, get a branching decision scenario that tests judgement under controlled/uncontrolled factors, get a pass/scar verdict.

Both modes started as standalone HTML prototypes with in-browser Claude API calls (prototypes not present in this repo — Phase 1 was built fresh from this spec). This spec turns them into one real multi-user product: server-owned API key, per-user accounts, real-time sync across devices, tiered access.

---

## 1. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS | Fast, small bundles with code-splitting, huge ecosystem, deploys natively to the edge. |
| Database | Convex | Document based (NoSQL), schema in TypeScript, reactive by default: queries automatically re-run and push updates to every subscribed client the moment data changes, no manual websocket plumbing. Has a native "actions" function type built specifically for calling external APIs like Anthropic's, without blocking the realtime query/mutation layer. Open source, can self-host later. |
| Auth | Clerk | Drop-in login, documented native integration with Convex, handles session tokens. |
| AI calls | Anthropic API, called only from Convex actions (server side) | Key lives in Convex environment variables. Browser never sees it. No free or offline substitute for "generate an accurate, well structured curriculum for an arbitrary topic on demand" — see section 9. |
| Hosting | Vercel (frontend) + Convex Cloud (backend) | Both edge/globally distributed by default. |
| Billing | Stripe + Stripe Customer Portal | Pro subscriptions, webhooks write tier changes back into Convex. |
| Offline/local cache | IndexedDB via idb-keyval | Instant reads on reload, optimistic UI, background sync reconciles with Convex when back online. |

Don't add anything not in this table without a reason.

---

## 2. Data model (Convex schema, document based)

```
users
  - clerkId
  - tier: "free" | "pro"
  - createdAt

architectureMaps
  - userId
  - topic
  - slug
  - phases: [{ id, title, summary }]
  - createdAt
  - updatedAt

architectureNodes
  - mapId
  - phaseId
  - label
  - description
  - prereqIds: string[]
  - completed: boolean
  - completedAt

nodeReferences
  - nodeId
  - topicPhaseHash        // hash of (topic + phase title + node label), see 3.1
  - references: [{ title, url, why }]
  - fetchedAt

implementationChallenges
  - userId
  - mapId (optional link back to an architectureNode)
  - nodeId (optional)
  - scenario: { title, setup, controlledFactors, uncontrolledFactors, stages }
  - stageStates: [{ status, pickedLabel, consequence, warning }]
  - deeperRefs
  - finished: boolean
  - clean: boolean
  - updatedAt

usageQuotas
  - userId
  - period (YYYY-MM)
  - generationsUsed
  - generationsLimit (set by tier)

generationCache          // cross-user cache, see 3.1
  - cacheKey              // hash of (topic + phase title) or (subtopic + node label)
  - kind: "phase" | "node" | "references" | "challenge"
  - payload
  - hitCount
  - createdAt
```

Every table is scoped by `userId`, except `generationCache` which is intentionally shared across all users. No query on any other table is allowed to read another user's rows. Enforce this in the Convex function itself, not just the frontend.

---

## 3. Server side AI proxy

- All calls to Anthropic happen inside Convex `action` functions, never in the browser.
- One Anthropic API key, stored as a Convex environment variable, used for every user.
- Every action that calls Anthropic first checks `usageQuotas` for that user and that month. Reject with a clear "upgrade to keep going" message before spending a token if over limit.
- Hard word/node caps by default so responses don't get cut off, a couple of retries as a genuine safety net, clear per-phase rebuild if something still fails.

### 3.1 Cache everything cacheable

The biggest avoidable cost is re-fetching references/phases from scratch every time, even when another user already generated the same thing.

Rules for `generationCache`:

- **Phase lists and node breakdowns:** cache key = hash of `(normalized topic + phase title)`.
- **References:** cache key = hash of `(normalized subtopic + node label)`.
- **Normalize before hashing:** lowercase, trim, collapse whitespace, strip trailing punctuation.
- Cache hit still counts toward the user's monthly generation count at a steep discount (or not at all) — track `hitCount` either way for a future effectiveness dashboard.
- **Never cache `implementationChallenges` scenarios** — they're meant to test judgement with branching, caching defeats the purpose. Quota and rate limit those separately.

---

## 4. Sync and offline behavior

- On load: read from IndexedDB first (instant paint), then subscribe to the Convex query. Convex is the source of truth, IndexedDB is a cache.
- Checkmark toggles: update IndexedDB and UI immediately (optimistic), fire a Convex mutation in the background. Queue and retry on reconnect if offline.
- Last-write-wins on `completedAt` for conflict resolution — no CRDT, it's one boolean per node.
- Every logged-in device subscribes to the same Convex query, so a checkmark on a phone shows up on a laptop via the same reactive push.

### 4.1 Offline export must include the map, not just the checklist [fix, not new scope]

The original prototype's export only reconstructed the flat checklist, dropping phase columns and prerequisite lines. The data for the full graph is already in the snapshot (`prereqIds` on every node) — it just wasn't being rendered.

Fix (implemented in Phase 1, `lib/offlineExport.ts`): the exported standalone HTML renders both views stacked — graph first (phases as columns, SVG connector lines drawn from `prereqIds`), flat checklist underneath. Both read/write the same local `completed` set (seeded from the map's state at export time, then persisted to the exported file's own localStorage) so checking a box in one view updates the other.

---

## 5. Security baseline

- API key only ever in Convex server environment, never in client bundle, never logged.
- Clerk session tokens validated on every Convex function call, not just on page load.
- Row level scoping by `userId` enforced inside every query and mutation.
- Rate limit per user per minute on generation actions, independent of the monthly quota.
- HTTPS everywhere (default on Vercel/Convex).
- Stripe webhook signature verification on every incoming webhook.
- No `dangerouslySetInnerHTML` anywhere; sanitize AI-generated text before rendering if rich formatting is ever allowed.

---

## 6. Free vs Pro tier

| Feature | Free | Pro |
|---|---|---|
| Architecture maps | 2 active topics | Unlimited |
| Generations/month | Fixed cap, calculated from actual Anthropic per-call cost. Cache hits (3.1) should not count against this the same way raw generations do. | Higher cap |
| Implementation Challenges | 1 active scenario at a time | Unlimited |
| Sync across devices | Yes | Yes |
| Offline export (graph + checklist HTML, see 4.1) | Yes | Yes |
| Priority generation queue | No | Yes |
| Data export (Notion, Obsidian markdown, CSV) | No | Yes |
| Webhook / API access to own maps | No | Yes |
| Custom theming | No | Yes |

Pro integrations (Notion export, webhooks, API access) are Phase 7, not Phase 1.

---

## 7. UI direction

- White, bright background. No dark mode as a first-class citizen.
- Bold, clear typography, sized larger than typical SaaS defaults.
- Soft glow accent only on things that matter: unlocked/ready node, completed checkmark, key phrase in a reference. Don't glow everything.
- No hidden or collapsed content on the main architecture view — whole map visible and scrollable, not accordioned.
- No em dashes anywhere in UI copy or generated content prompts.
- Color language: grey (locked) / green (ready/done) / amber (scar, from Implementation Challenges). Don't reinvent it.

---

## 8. Build phases

**Phase 1 — Core merge, no auth, no billing, single local user** ✅ *(this repo, current state)*
Two routes/tabs: Architecture and Challenges. State in local component state (React context), no database. UI and interaction logic working end to end against a stubbed/local generation call. Offline export fix (4.1) included: downloaded HTML renders the full graph above the flat checklist, both reading/writing the same completion state.

**Phase 2 — Convex integration, no auth yet**
Stand up the Convex schema above, including `generationCache`. Move all state from React context into Convex queries/mutations. Verify realtime updates work across two open tabs of the same browser before moving on.

**Phase 3 — Auth**
Add Clerk. Every Convex function scoped to the logged-in user. Verify one user cannot see another user's data — test this explicitly, don't assume it.

**Phase 4 — Server side AI proxy + quotas + caching**
Move all Anthropic calls into Convex actions. Add `usageQuotas` table and enforcement. Add `generationCache` lookup (3.1) before every phase/node/reference generation call — only hit the model on a cache miss. Verify a clear, non-cryptic quota message, and verify a cache hit returns near-instantly with no model call in the Convex logs.

**Phase 5 — Billing and tiers**
Stripe subscription flow, webhook handling, tier gating on the features table above.

**Phase 6 — Offline/local sync**
IndexedDB caching layer, optimistic updates, background sync queue for offline actions. Confirm the graph+checklist export (4.1) still works once data flows through Convex instead of local state.

**Phase 7 — Pro integrations** (only after 1-6 are solid)
Notion/Obsidian export, webhook access, API keys for the user's own scripts against their own data.

**Phase 8 — Performance pass**
Bundle size audit, code-split anything not needed on first paint, verify cold-start latency on Convex actions, loading skeletons instead of blank screens. Add a cache hit rate metric — it tells you if 3.1 is earning its keep.

Do not jump ahead to Phase 7 while Phase 3 auth is half-done. Each phase should be a working, testable state of the app.

---

## 9. No-API alternatives, considered and rejected

- **Pre-baked static curricula for a fixed topic list.** Zero cost, but kills "type any topic." Rejected outright.
- **In-browser small models (transformers.js, WebLLM).** Free and offline, but structured-output quality (clean JSON, correct prerequisite graph) is meaningfully weaker than a frontier model on this kind of task [inference, not benchmarked for this app specifically]. Would mean maintaining a second, worse pipeline. Rejected for now; could become an optional "lite mode" later if there's real demand for zero-account usage.
- **User-supplied local model via Ollama.** Better quality than in-browser, but requires the app to reach `localhost`, which doesn't work from a hosted Vercel/Convex deployment talking to a browser on a different machine. Incompatible with the multi-device sync goal (section 4). Rejected.

None of these change the core architecture in section 1. The caching in 3.1 is the actual lever that reduces cost without touching output quality.

---

## 10. Deferred, not in scope yet

- Team/shared workspaces (multiple users on one architecture map).
- Mobile app wrapper (Capacitor/React Native) vs. PWA-only.
- Analytics dashboard for Pro users on learning velocity.
- Supporting models other than Claude behind the same proxy.
- Whether the "lite mode" local-model option from section 9 is worth building.
