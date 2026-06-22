# studybuddy

On-device RAG study app for iOS and Android. Drop in a PDF, get FSRS-scheduled
flashcards back, and chat with the document. Nothing leaves the phone.

- **Local LLM** (Llama 3.2 3B, 4-bit, swappable to Phi-3.5 / Gemma 2 / Llama 1B)
- **Local embeddings** (MiniLM-L6-v2)
- **FSRS-4.5** spaced repetition (the algorithm Anki ships as default since 23.10)
- **React Native + Skia + Reanimated 4 + ExecuTorch**
- **MIT licensed**, no network, no telemetry, no accounts

```
                ┌─────────────────────────────────────────┐
   pdf  ───►   │  ingest                                  │
                │  ├─ extract pages (PDFKit / PdfBox)      │
                │  ├─ chunk @ ~512 tokens / 64 overlap     │
                │  └─ embed via MiniLM-L6                  │
                └─────────────────┬───────────────────────┘
                                   │ chunks + 384-dim float32 blob
                                   ▼
                ┌─────────────────────────────────────────┐
                │  sqlite (drizzle + quick-sqlite)         │
                └────┬─────────────────────────┬──────────┘
                     │                          │
                     ▼                          ▼
        ┌────────────────────┐      ┌─────────────────────┐
        │ card-gen (Llama)   │      │ rag chat (Llama)    │
        │ k-means sample     │      │ top-k cosine        │
        │ dedup q-embeds     │      │ cited evidence      │
        └────────┬───────────┘      └─────────┬───────────┘
                 │ cards                       │ stream
                 ▼                             ▼
         ┌──────────────┐               ┌──────────────┐
         │ fsrs review  │               │ chat ui      │
         │ skia heatmap │               │ cite chips   │
         └──────────────┘               └──────────────┘
```

## Quick start

Requirements: Node 20+, pnpm 9+, Xcode 16+ (iOS) or Android Studio Koala+
(Android), `eas-cli` for the build flow.

```bash
pnpm install
pnpm typecheck    # zero errors
pnpm test         # ~100 vitest cases, ~500ms
```

Run on a device or simulator (requires a dev client, since we depend on
native modules: quick-sqlite, mmkv, executorch, skia):

```bash
# ios (one-time: pnpm dlx expo prebuild --platform ios)
pnpm ios

# android (one-time: pnpm dlx expo prebuild --platform android)
pnpm android
```

By default the app runs with **mock models** so you can iterate end-to-end
without downloading any model files. To exercise the real LLM + embedder:

```bash
EXPO_PUBLIC_USE_REAL_MODELS=1 pnpm ios
```

Then go to Settings → Models and download Llama 3.2 3B + MiniLM-L6.

## Screenshots

Drop screenshots into `screenshots/` and they will show up here:

- `screenshots/library.png` — the library after a sample import
- `screenshots/review.png` — swipe-to-grade with the FSRS state badge
- `screenshots/heatmap.png` — Skia review heatmap
- `screenshots/chat.png` — RAG chat with inline page-cite chips

## Project layout

```
app/                  expo-router screens (file system routing)
  (tabs)/             library / decks / review / chat
  settings/           model picker, storage, danger zone
  onboarding/         welcome -> models -> sample
src/
  components/         pure RN UI (card, heatmap, retention-curve, …)
  services/           pdf, chunker, embed, llm, vector-store, rag, card-gen, …
  stores/             zustand (library, deck, review, chat, settings)
  db/                 drizzle schema + sqlite client + migrations
  prompts/            versioned LLM prompts (card-gen.v1, rag-answer.v1)
  lib/                pure helpers — cosine, kmeans, fsrs, chunker, id
  hooks/              react query + small ui hooks
  types/              zod schemas (shared with services)
e2e/                  maestro yaml flows
docs/                 architecture, prompts, models
assets/               sample.pdf, icons, fonts
```

## Privacy

studybuddy never makes network requests once models are downloaded. There
is no analytics, no crash reporting service, no account system. Your
documents and review history live in your app sandbox.

The model download (first run) is the only network activity — it's a HEAD
request for size, then a resumable download from Hugging Face, then a
SHA-256 verify. Source URLs and hashes live in `src/services/models.service.ts`
and `docs/MODELS.md`.

## Roadmap (v0.2)

These are explicit non-goals for v0.1 — landing in v0.2.

- **Custom TurboModule PDF parsers** wrapping PDFKit (iOS) and PdfBox
  (Android) for messy real-world PDFs that `react-native-pdf-extract`
  doesn't handle well.
- **OCR fallback** for scanned PDFs (Vision framework on iOS, ML Kit on
  Android).
- **EPUB import**.
- **Voice chat with the doc** via Whisper + an on-device TTS.
- **Image-bearing cards** for diagrams.
- **Tailscale-mediated sync** between phone and desktop — never via a
  third-party server.
- **Per-user FSRS optimization** — the optimize() stub already shipped in
  `lib/fsrs.ts` reports log-loss; the L-BFGS-B fitting follows once a
  user has 1000+ reviews logged.
- **Multi-doc decks** ("everything I read about kubernetes").

## License

MIT. Models retain their own licenses (Llama Community, Apache 2.0,
Gemma Terms of Use); see `docs/MODELS.md`.
