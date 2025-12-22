# `studybuddy` — Implementation Plan

> A mobile-native, **fully on-device** RAG app. Drop in any PDF / EPUB / article → it embeds, generates Anki-style flashcards via a local LLM, schedules them with FSRS, and lets you **chat with the document** — all without a single byte leaving the phone. Privacy-first. Works on a plane. Demo-friendly.

**Status:** Draft — pending decisions in §11 before Phase 0 starts.

---

## 1. Goals & non-goals

### Goals
- **Drop-in ingest** — any PDF (and EPUB / Markdown / pasted text) becomes a searchable document in under 60 seconds for a typical 50-page file on a flagship phone.
- **On-device card generation** — `Llama 3.2 3B` (or alternative, see §11) generates 20-50 high-quality Q-A flashcards per chunk, with quality controls (no duplicates, no trivia, mixed cloze + recall styles).
- **FSRS-scheduled review** — daily review queue using the [Free Spaced Repetition Scheduler](https://github.com/open-spaced-repetition/fsrs4anki) (the algorithm Anki shipped as default in v23+). Better than SM-2 for retention curve.
- **Chat with the doc** — ask anything, RAG retrieval over the local vector index, LLM answers with **page-cited evidence** rendered inline.
- **Skia-rendered visualizations** — daily review heatmap, retention forecast curve, similarity rings on the doc browser. Senior craft signal.
- **Zero network** — no API keys, no telemetry, no analytics, no remote model calls. The whole app works offline once models are downloaded.
- **Showcase-grade** — runnable end-to-end via `npx expo run:ios` and `npx expo run:android`. Demo video of 50-page PDF → 30 cards → first review session in under 90 seconds.

### Non-goals (v1)
- No cloud sync. v2 territory (likely via Tailscale-mediated peer sync, see [[project-trading-journal-app]] pattern).
- No multi-user / collaborative decks. Single-user app.
- No web/desktop port. Mobile only (Android + iOS, see §11 #5 for which-first).
- No OCR fallback for scanned PDFs in v1. Text-extractable PDFs only.
- No image-bearing flashcards (images-in-cards). v2.
- No mid-doc LLM rewrites ("summarize chapter 3"). Card generation + chat only.
- No remote LLM fallback. On-device only is the product, not a fallback.

---

## 2. The problem

Spaced repetition is the highest-ROI study technique known (Bjork, Karpicke). Two things hold it back in practice:

1. **Making the cards is the bottleneck.** It takes 5-10× longer to write a good Anki deck than to read the source. Most people give up here.
2. **The desktop tooling is dated.** Anki is functionally amazing, visually 2008. RemNote and Mochi are better but locked into their own cloud + subscription.

The "drop in a PDF, get great cards back" loop has been technically feasible since GPT-3.5 — but every existing implementation **ships your documents to OpenAI / Anthropic / Mistral**. For students reading proprietary textbooks, doctors reading patient notes, lawyers reading case files, engineers reading internal docs — that's a hard no.

ExecuTorch on iPhone 15+ / Galaxy S24+ now runs Llama 3.2 3B at **~15-25 tokens/sec** (commercial use permitted), and MiniLM-L6 embeddings at thousands of chunks/sec. The on-device version is finally fast enough. **Nobody has shipped this as a polished mobile app.** That's the gap.

---

## 3. Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ React Native app (Expo 56 / RN 0.85 / New Architecture / Reanimated 4 / Skia)     │
│                                                                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │
│  │  Library    │  │  Decks      │  │  Review     │  │  Chat       │  ← screens    │
│  │  (PDFs)     │  │  (cards)    │  │  (FSRS Q)   │  │  (RAG)      │               │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘               │
│         │                │                │                │                       │
│  ┌──────▼──────────────────────────────────────────────────────────┐               │
│  │ Zustand stores: library, deck, review, chat, settings           │               │
│  └──────┬──────────────────────────────────────────────────────────┘               │
│         │                                                                          │
│  ┌──────▼──────────────────────────────────────────────────────────┐               │
│  │ Services (TS, hot path)                                          │               │
│  │  - PdfService          extract text + page map                  │               │
│  │  - ChunkerService      semantic chunking (~512 tok, 64 overlap) │               │
│  │  - EmbedService        MiniLM-L6 via ExecuTorch                 │               │
│  │  - VectorStore         in-memory ANN + Float32 blob in SQLite   │               │
│  │  - LlmService          Llama 3.2 3B via ExecuTorch              │               │
│  │  - CardGenService      structured generation w/ retry           │               │
│  │  - RagService          retrieval + answer composition + cites   │               │
│  │  - SchedulerService    FSRS (next-due, intervals, retention)    │               │
│  └──────┬──────────────────────────────────────────────────────────┘               │
│         │                                                                          │
│  ┌──────▼──────────────────────────────────────────────────────────┐               │
│  │ Storage                                                          │               │
│  │  - MMKV   "ui" + "settings" + "models" small fast values        │               │
│  │  - SQLite  documents · chunks · embeddings(BLOB) · cards · reviews │             │
│  │  - FS     /Documents/sb/pdfs/<id>.pdf · /Documents/sb/models/   │               │
│  └─────────────────────────────────────────────────────────────────┘               │
└──────────────────────────────────────────────────────────────────────────────────┘
```

**Hot path latency budgets** (target on iPhone 15 Pro / Galaxy S24+):

| Op | Budget | Why |
|---|---|---|
| Open app cold | < 1.5 s | New Architecture + Hermes; no model preload |
| Embed 1 chunk | < 50 ms | MiniLM-L6 on Neural Engine / Hexagon |
| Embed 50-page PDF | < 30 s | Background task; UI stays responsive |
| Generate 1 card | < 1.5 s | Llama 3.2 3B, ~150 tok output @ 20 tok/s |
| Generate 30 cards | < 60 s | Streamed UI; user can start reviewing while still generating |
| RAG answer | < 4 s | top-k=5 retrieve (instant) + ~250 tok answer |
| FSRS schedule | < 1 ms | Pure math, no I/O |

---

## 4. Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Expo SDK 56** (managed, EAS) | RN 0.85 + React 19.2 + Hermes v1; New Architecture mandatory anyway in SDK 55+; dev-client for native modules; EAS for iOS/Android CI is free for OSS |
| Navigation | Expo Router 4 | File-system routing matches the screens tree; typed routes |
| State | **Zustand** 4.x | User-stated preference. Minimal, plays well with TanStack Query for async |
| Async state | TanStack Query v5 | Mutations (ingest, generate, embed) become first-class with retries, optimistic updates, suspense |
| Storage (kv) | **MMKV** 2.x | User-stated preference. Sync reads = instant UI on cold start |
| Storage (relational + blobs) | `react-native-quick-sqlite` + Drizzle ORM | Vectors stored as Float32 BLOB columns. Drizzle = same ORM as the user's other projects, schema lives in TS |
| Animations | **Reanimated 4** | User-stated preference. CSS-style declarative animations for card flip + tab transitions |
| Custom drawing | **`react-native-skia` 2.x** | Heatmap, retention curve, similarity rings, waveform during voice chat (v2). 60fps drawing on UI thread |
| On-device LLM | **`react-native-executorch`** (Software Mansion) | Commercial use permitted; supports Llama 3.2 1/3B, Phi-3.5 mini, Gemma 2 2B, MiniLM embeddings, Whisper. Apple Neural Engine + Android NNAPI accelerated |
| LLM (default) | **Llama 3.2 3B Instruct, 4-bit quantized** | ~2.5 GB; ~20 tok/sec on iPhone 15 Pro; well-tuned for structured output |
| Embedding model | **all-MiniLM-L6-v2** (quantized) | ~25 MB, 384-dim, multilingual-OK, 100× faster than the LLM for embedding pass |
| PDF parsing | `react-native-pdf-extract` baseline → custom TurboModule wrapping PDFKit (iOS) + PdfBox (Android) for v0.2 | Baseline works for single-column text PDFs; native bridge needed for messy real-world PDFs |
| Audio (v2 voice chat) | `react-native-audio-api` + `whisper.rn` | Hot stack in 2026 |
| Gestures | `react-native-gesture-handler` 2.x | Required by Reanimated 4 for swipe-to-grade gestures |
| CI / build | **EAS Build** (free tier, OSS) | iOS + Android builds without owning a Mac runner or signing certs locally |
| Tests | Vitest (unit) + Maestro (E2E) | Maestro YAML flows for "open app → import PDF → review one card" smoke test |
| Lint / format | Biome | Single tool, faster than ESLint+Prettier |
| Type system | TypeScript 5.7+ strict + `noUncheckedIndexedAccess` | Matches the user's other projects |

---

## 5. Public surface (screens + flows)

### 5.1 Screens

```
/                       → Library (default)
/library                List of imported docs with thumbnails + chunk counts + last-reviewed
/library/[docId]        Doc detail: chunks, embeddings stats, regen options
/library/import         Modal: file picker / paste text / paste URL (URL fetch is v2)

/decks                  List of generated decks (one per doc + custom decks)
/decks/[deckId]         Cards in deck (browse / edit / delete)
/decks/[deckId]/card    Single-card editor (edit Q, A, page cite)

/review                 Today's queue (FSRS-ordered)
/review/session         Active session — swipe-to-grade
/review/done            Session summary + Skia retention curve

/chat                   List of doc-scoped chats
/chat/[docId]           RAG chat over one doc

/settings               Models, storage, FSRS params, danger zone
/settings/models        Download / verify / delete model files
/settings/about         OSS license, sources, version
```

### 5.2 Key user flows

**Ingest** (Library → import):
1. Pick PDF via `expo-document-picker`
2. Copy to app sandbox `/Documents/sb/pdfs/<uuid>.pdf`
3. Insert `documents` row (status='ingesting')
4. Spawn ingest worker (TanStack Query mutation; status displayed inline)
5. **Pages** — PDF → page text via `react-native-pdf-extract`
6. **Chunks** — `ChunkerService.chunk(pages)` produces ~500-char overlapping chunks with `(docId, pageStart, pageEnd, char_offset)` provenance
7. **Embed** — `EmbedService.embed(text)` returns 384-dim Float32 vector per chunk
8. Insert chunks + embeddings (as BLOB) into SQLite
9. `documents.status` → 'ready'
10. Toast: "Library: <name>.pdf ready · 247 chunks · 312 KB embeddings"

**Card generation** (Decks → generate from doc):
1. User picks doc + target count (default 30)
2. CardGen samples representative chunks (k-means cluster centroids of embeddings — ensures topic coverage, not just sequential)
3. For each sampled chunk: LLM prompt → JSON `[{q, a, type: cloze|recall|qa, citePage}]`
4. Streamed insert into `cards` table; UI shows count rising in real time
5. Dedup pass: cosine-sim threshold on card Q embeddings — kill near-dupes
6. Deck ready; auto-navigate user to `/decks/<id>`

**Review** (Review → session):
1. `SchedulerService.nextDueCards(limit=20)` returns FSRS-sorted queue
2. Present card front; user swipes:
   - ↑ "Good" · → "Easy" · ↓ "Again" · ← "Hard"
3. FSRS computes new `stability` + `difficulty` + `due` for the card
4. Reanimated 4 card flip transition between cards
5. End-of-session: Skia retention curve drawn from updated stability values

**Chat** (Chat → [docId]):
1. User types query
2. `RagService.answer(docId, query)`:
   - Embed query (MiniLM)
   - Top-k=5 cosine similarity over `chunks WHERE docId=?`
   - Prompt LLM with retrieved chunks + system prompt enforcing citation format
   - Stream tokens to UI
3. Parse citations (`[p.12]` style) and render inline as tappable chips that scroll the source PDF view

---

## 6. Project structure

```
studybuddy/
├── PLAN.md
├── README.md
├── LICENSE                       MIT
├── package.json
├── pnpm-lock.yaml
├── app.json                       Expo config
├── eas.json                       EAS Build profiles
├── babel.config.js
├── metro.config.js                with `react-native-executorch` resolver
├── biome.json
├── tsconfig.json
├── drizzle.config.ts
├── app/                           Expo Router screens
│   ├── _layout.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx
│   │   ├── library/
│   │   ├── decks/
│   │   ├── review/
│   │   └── chat/
│   ├── settings/
│   └── +not-found.tsx
├── src/
│   ├── components/                Pure UI
│   │   ├── card/                  Flashcard + flip animation + swipe gestures
│   │   ├── heatmap/               Skia review heatmap
│   │   ├── retention-curve/       Skia retention forecast
│   │   ├── chat-bubble/
│   │   ├── progress-ring/         Skia ring with %
│   │   └── ui/                    Buttons, inputs, sheets
│   ├── services/                  TS hot path (no UI)
│   │   ├── pdf.service.ts
│   │   ├── chunker.service.ts
│   │   ├── embed.service.ts
│   │   ├── vector-store.ts
│   │   ├── llm.service.ts
│   │   ├── card-gen.service.ts
│   │   ├── rag.service.ts
│   │   ├── scheduler.service.ts   FSRS
│   │   └── models.service.ts      Download + verify model files
│   ├── stores/                    Zustand
│   │   ├── library.store.ts
│   │   ├── deck.store.ts
│   │   ├── review.store.ts
│   │   ├── chat.store.ts
│   │   └── settings.store.ts
│   ├── db/                        Drizzle
│   │   ├── schema.ts
│   │   ├── client.ts
│   │   └── migrations/
│   ├── prompts/                   Versioned LLM prompts
│   │   ├── card-gen.v1.ts
│   │   ├── rag-answer.v1.ts
│   │   └── chunk-summary.v1.ts
│   ├── lib/
│   │   ├── cosine.ts              Vector math (Float32Array, SIMD via NEON when avail)
│   │   ├── kmeans.ts              Mini-k-means for representative chunk sampling
│   │   ├── fsrs.ts                FSRS algo (TS port of fsrs.rs)
│   │   ├── pdf-thumbnail.ts
│   │   └── id.ts                  uuidv7
│   ├── hooks/
│   │   ├── use-doc.ts
│   │   ├── use-due-cards.ts
│   │   ├── use-rag-answer.ts
│   │   └── use-models.ts
│   └── types/
├── assets/                        Icons, fonts
├── e2e/                           Maestro flows
│   ├── import-pdf.yaml
│   ├── generate-deck.yaml
│   └── review-session.yaml
└── docs/
    ├── ARCHITECTURE.md
    ├── PROMPTS.md                 prompt versioning rationale
    └── MODELS.md                  model URLs, hashes, licenses
```

---

## 7. Database schema (SQLite + Drizzle)

```ts
// src/db/schema.ts (excerpt)

export const documents = sqliteTable('documents', {
  id: text('id').primaryKey(),                  // uuidv7
  title: text('title').notNull(),
  source: text('source').notNull(),             // 'pdf' | 'epub' | 'paste'
  filePath: text('file_path'),                  // null for pasted text
  pageCount: integer('page_count').notNull().default(0),
  charCount: integer('char_count').notNull().default(0),
  status: text('status').notNull(),             // 'ingesting' | 'ready' | 'failed'
  errorMessage: text('error_message'),
  importedAt: integer('imported_at', { mode: 'timestamp_ms' }).notNull(),
  lastReviewedAt: integer('last_reviewed_at', { mode: 'timestamp_ms' }),
});

export const chunks = sqliteTable(
  'chunks',
  {
    id: text('id').primaryKey(),
    docId: text('doc_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),              // ordinal within doc
    pageStart: integer('page_start').notNull(),
    pageEnd: integer('page_end').notNull(),
    charOffset: integer('char_offset').notNull(),
    text: text('text').notNull(),
    tokenCount: integer('token_count').notNull(),
    // 384-dim float32 = 1536 bytes
    embedding: blob('embedding', { mode: 'buffer' }).notNull(),
  },
  (t) => ({
    docIdx: index('chunks_doc_idx').on(t.docId, t.idx),
  }),
);

export const decks = sqliteTable('decks', {
  id: text('id').primaryKey(),
  docId: text('doc_id').references(() => documents.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  generatedWithModel: text('generated_with_model').notNull(),
  generatedWithPromptVersion: text('generated_with_prompt_version').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const cards = sqliteTable(
  'cards',
  {
    id: text('id').primaryKey(),
    deckId: text('deck_id').notNull().references(() => decks.id, { onDelete: 'cascade' }),
    sourceChunkId: text('source_chunk_id').references(() => chunks.id),
    type: text('type').notNull(),               // 'cloze' | 'recall' | 'qa'
    front: text('front').notNull(),
    back: text('back').notNull(),
    pageCite: integer('page_cite'),
    questionEmbedding: blob('question_embedding', { mode: 'buffer' }),  // for dedup
    // ── FSRS state ──
    stability: real('stability').notNull().default(0),
    difficulty: real('difficulty').notNull().default(0),
    elapsedDays: real('elapsed_days').notNull().default(0),
    scheduledDays: real('scheduled_days').notNull().default(0),
    reps: integer('reps').notNull().default(0),
    lapses: integer('lapses').notNull().default(0),
    state: text('state').notNull().default('new'),  // 'new' | 'learning' | 'review' | 'relearning'
    due: integer('due', { mode: 'timestamp_ms' }).notNull(),
    lastReview: integer('last_review', { mode: 'timestamp_ms' }),
  },
  (t) => ({
    dueIdx: index('cards_due_idx').on(t.due, t.state),
    deckIdx: index('cards_deck_idx').on(t.deckId),
  }),
);

export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  cardId: text('card_id').notNull().references(() => cards.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),          // 1 = again, 2 = hard, 3 = good, 4 = easy
  durationMs: integer('duration_ms').notNull(),
  stabilityBefore: real('stability_before').notNull(),
  stabilityAfter: real('stability_after').notNull(),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp_ms' }).notNull(),
});

export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  docId: text('doc_id').notNull().references(() => documents.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const chatMessages = sqliteTable(
  'chat_messages',
  {
    id: text('id').primaryKey(),
    chatId: text('chat_id').notNull().references(() => chats.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),               // 'user' | 'assistant'
    content: text('content').notNull(),
    cites: text('cites'),                       // JSON [{ chunkId, page }]
    tokensIn: integer('tokens_in'),
    tokensOut: integer('tokens_out'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
  },
  (t) => ({
    chatIdx: index('chat_messages_chat_idx').on(t.chatId, t.createdAt),
  }),
);
```

**MMKV layout** (small, hot values):
- `ui:lastTab` · `ui:theme` · `ui:onboarding-done`
- `models:llm-installed` · `models:embed-installed` · `models:llm-id` · `models:embed-id`
- `settings:fsrs-params` · `settings:dailyTarget` · `settings:reviewLimit`
- `runtime:lastModelLoad` · `runtime:lastEmbeddingPass`

---

## 8. Key flows (in depth)

### 8.1 Ingest

```
file picked
  └─► copy to sandbox: /Documents/sb/pdfs/<uuid>.pdf
       └─► PdfService.extract(filePath)
             ├─► [iOS]  PDFKit via TurboModule (v0.2 — baseline uses RN-pdf-extract)
             └─► [Android] PdfBox via TurboModule (v0.2)
                   └─► returns Page[]  { idx, text, charOffset }
       └─► ChunkerService.chunk(pages, { targetTokens: 512, overlapTokens: 64 })
             └─► returns Chunk[] (split on paragraph + sentence boundaries; never mid-sentence)
       └─► EmbedService.embedBatch(chunks)
             └─► batch of 16 chunks per ExecuTorch call → Float32Array (16 × 384)
                  └─► persist as BLOBs into `chunks.embedding`
       └─► documents.status = 'ready'
       └─► fire-and-forget: generate default deck (30 cards) if user opted in
```

Cancel-safe: every step writes its result to SQLite before invoking the next. If the user kills the app mid-embed, the next launch resumes from `chunks WHERE embedding IS NULL`.

### 8.2 Card generation prompt (v1, snippet)

```
[SYSTEM — cached on the LLM via KV-cache reuse]
You write spaced-repetition flashcards for serious students.
Output JSON only, no markdown. Each card:
  { "type": "cloze" | "recall" | "qa",
    "front": "<question>",
    "back": "<answer>",
    "page": <int> }

Rules:
  - Cards must be answerable from the passage ONLY. No outside knowledge.
  - For cloze cards, replace the key term with `{{c1::term}}`. One cloze per card.
  - For recall cards, the front is a paraphrased question and the back is the
    exact phrase / fact from the passage (max 25 words).
  - For qa cards, both front and back are full sentences.
  - Mix all three types. ~40% cloze, ~40% recall, ~20% qa.
  - DO NOT generate trivia, dates-only, or "what is the main idea" style cards.
  - Each card stands alone — never reference "the passage" or "the author".
  - Return exactly N cards.

[USER]
N = {target}
Passage (pp. {pageStart}-{pageEnd}):
"""
{chunkText}
"""
```

Generation pipeline:
1. Sample `k = ceil(target / 5)` chunks via k-means on the embedding matrix (so chunks are topically spread, not just sequential).
2. For each sampled chunk, prompt for **5 cards**. Stream tokens.
3. Parse JSON incrementally. Insert each finished card. UI animates count.
4. Dedup: cosine-sim between question embeddings > 0.92 → drop the later one.
5. If `cards.length < target`, sample more chunks and continue.

### 8.3 FSRS (`src/lib/fsrs.ts`)

Pure functional. Inputs: card state + rating (1-4) + now. Outputs: new state + next due. Algorithm: FSRS-4.5 (the version Anki uses as default).

Reference test vectors in `e2e/fsrs-vectors.json` ported from `fsrs4anki` repo.

### 8.4 RAG answer

```
ragAnswer(docId, query) ->
  1. qVec = embed(query)                                     // ~30ms
  2. top5 = sql:
       SELECT id, text, page_start, page_end
       FROM chunks
       WHERE doc_id = ?
       ORDER BY cosine(embedding, ?) DESC
       LIMIT 5
     -- cosine implemented as SQLite UDF; falls back to JS for the first 1000 rows
  3. prompt = systemPrompt + retrieved.map(formatWithCite) + "\nQuestion: " + query
  4. stream LLM tokens → UI
  5. parse citations on the way ("[p.12]", "[chunk:abc...]") and render as tappable chips
```

Citations are mandatory in the system prompt. If the LLM returns an uncited claim, a regex post-step strikes it through and adds "⚠ uncited" — visible but not blocking.

### 8.5 Skia heatmap

GitHub-commit-style 53-week × 7-day grid. Each cell colored by reviews-on-that-day (0 = bg, 1-3 = pale, 4-10 = medium, 11+ = bright). Tap a cell → review session detail. Gesture: horizontal scroll for older months. Drawn entirely in Skia for 60fps panning over 5 years of data.

---

## 9. Models — what ships in v1

| Model | Size | Purpose | Source | License |
|---|---|---|---|---|
| **Llama 3.2 3B Instruct** (4-bit GGUF → ExecuTorch .pte) | ~2.4 GB | Card generation + chat | Meta via Hugging Face | Llama 3 Community License (commercial OK at <700M MAU) |
| **all-MiniLM-L6-v2** (quantized .pte) | ~25 MB | Embeddings | sentence-transformers | Apache 2.0 |

Models download on first run via a guided onboarding flow (Wi-Fi-only by default; charging required toggle). Stored in `/Documents/sb/models/`. SHA-256 verified after download. App refuses to start if models are corrupted; offers re-download.

**Why not bundle?** App Store binary cap is 200 MB; we'd blow it.

**v0.2 alternatives** the user can pick in Settings → Models:
- **Phi-3.5 mini** (3.8B) — better at structured output, ~2.4 GB
- **Gemma 2 2B** (2B) — fastest, smaller cards quality
- **Llama 3.2 1B** — for low-end devices

---

## 10. Build phases

| Phase | Scope | Effort |
|---|---|---|
| **0** | Repo scaffold: Expo SDK 56 project, Drizzle + quick-sqlite, MMKV, Zustand, Skia, Reanimated 4. Empty screens with Expo Router. CI: EAS Build dev profile, Maestro smoke test scaffold. README + LICENSE. | 1 evening |
| **1** | Schema + DB plumbing: migrations, seed data, library screen with hardcoded docs, settings shell, model-download screen UI (no actual download yet) | 2 evenings |
| **2** | Models infra: `react-native-executorch` wired, model download with progress + SHA verify, embed service (MiniLM forward pass on test text), benchmark page in Settings showing tok/s + ms/embedding | 3 evenings |
| **3** | PDF ingest end-to-end: pick → copy → extract → chunk → embed → persist. UI shows `documents.status = 'ingesting' \| 'ready'` with progress. | 3 evenings |
| **4** | Card generation: LLM service, card-gen prompt v1, streaming insert, dedup, decks browser screen with Skia progress ring during gen | 3 evenings |
| **5** | FSRS + review session: scheduler, swipe gestures via Reanimated 4 + Gesture Handler, card-flip animation, end-of-session retention curve (Skia) | 3 evenings |
| **6** | RAG chat: query embed, top-k SQL, streaming answer with inline page-cite chips, chat history persistence | 3 evenings |
| **7** | Skia heatmap + retention curve polish, daily review notifications via expo-notifications, settings (FSRS params, model picker, danger zone wipe) | 2 evenings |
| **8** | Onboarding flow (3 screens: model download, sample doc, first review), in-app help, README screenshots, demo video script + recording | 2 evenings |

**v1 total:** ~22 evenings of focused work. 6-8 weeks at sustainable pace.

**Stretch (v0.2):**
- Custom TurboModule PDF parsers (PDFKit / PdfBox)
- OCR fallback for scanned PDFs (ML Kit on Android, Vision framework on iOS)
- EPUB import
- Voice chat with the doc (whisper.rn + Kokoro TTS)
- Image-bearing cards
- Tailscale-mediated sync to desktop

---

## 11. Decisions to confirm before Phase 0

| # | Decision | Default (Recommended) | Alternatives |
|---|---|---|---|
| 1 | Project name | **`studybuddy`** (working name, easy to rename) | `recall`, `mindfile`, `vault.study`, `gist.local` |
| 2 | Primary LLM | **Llama 3.2 3B Instruct (4-bit)** — best quality/speed tradeoff on flagship devices | Phi-3.5 mini (slightly better at JSON), Gemma 2 2B (lighter), Llama 3.2 1B (low-end) |
| 3 | SRS algorithm | **FSRS-4.5** — modern, optimizable per-user, matches what Anki defaults to in 2024+ | SM-2 (simpler, more familiar) |
| 4 | Vector store | **In-memory Float32Array + Float32 BLOB column in SQLite** (top-k via JS for <10k chunks) | `sqlite-vec` extension (faster but adds a native dep) |
| 5 | Platform priority | **Both at once** via Expo + EAS — iOS for demo polish, Android for ExecuTorch perf claims | iOS-first (cleaner audio + Live Activities), Android-first (better ExecuTorch perf) |
| 6 | Runtime | **Expo (managed) on SDK 56** with dev-client where native modules need it | Bare RN (more control, more setup) |
| 7 | PDF parser (v0.1) | **`react-native-pdf-extract`** baseline; custom TurboModule in v0.2 | Native parser day 1 (slower to ship, better real-world PDFs) |
| 8 | Repo location | `~/Desktop/development/personal/studybuddy/` | other |
| 9 | OSS visibility | **Public + MIT** from day one (same as your other OSS) | Private until v0.1 ships |
| 10 | Demo content | Ship with **`Sample.pdf`** in `/assets/` (a Wikipedia article exported as PDF) so first-launch users can try without picking a file | None — empty first launch |
| 11 | Telemetry | **None** — privacy is the product. No Sentry, no Firebase, no Mixpanel | Local-only crash logging to MMKV |

---

## 12. Out of scope (explicit so we don't drift)

- Account systems / cloud accounts
- Remote LLM fallback (defeats the privacy story)
- Markdown editor for cards (cards are LLM-generated; manual edits are textarea-only in v1)
- Audio cards (TTS for answers) — v0.2
- Image cards — v0.2
- Notion / Obsidian import — v0.2
- Web extension to "send page to studybuddy" — v0.3
- Multi-doc decks ("everything I read about kubernetes") — v0.2
- Sync — never on a third-party server; v0.2 considers Tailscale peer sync

---

## 13. References

- ExecuTorch RN — https://docs.swmansion.com/react-native-executorch/
- FSRS algorithm — https://github.com/open-spaced-repetition/fsrs4anki
- Llama 3.2 model card — https://huggingface.co/meta-llama/Llama-3.2-3B-Instruct
- all-MiniLM-L6-v2 — https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
- Reanimated 4 release — https://blog.swmansion.com/reanimated-4-stable-release-the-future-of-react-native-animations-ba68210c3713
- react-native-skia — https://shopify.github.io/react-native-skia/
- Bjork on spaced repetition — *Making Things Hard On Yourself, But In A Good Way* (2011)
- Karpicke testing-effect papers — *Test-Enhanced Learning* (2008)

---

## 14. Anti-features (will get pushback; we say no)

- **"Add ChatGPT mode" / "fallback to GPT-4"** — defeats the privacy story. Hard no.
- **"Export to Anki"** — interesting but adds .apkg packaging burden. v0.3.
- **"Per-card audio recording (your own voice)"** — cool but bloats data + UX. v0.3.
- **"AI tutor that asks Socratic questions"** — fun but scope-creep beyond the SRS thesis. v0.3.
