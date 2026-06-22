# Models

studybuddy ships with two on-device models: one LLM for card generation
and RAG answers, one embedder for retrieval. Three more LLMs are listed
in `MODEL_CATALOG` (`src/services/models.service.ts`) and selectable in
Settings → Models.

Every file is downloaded once on first run, stored under
`/Documents/sb/models/<filename>.pte`, and SHA-256 verified before being
marked installed. Mismatched bytes are deleted; the app prompts to
retry.

## Catalog

| id                              | kind  | size    | license                       |
|---------------------------------|-------|---------|-------------------------------|
| `llama-3.2-3b-instruct-q4`      | llm   | ~2.5 GB | Llama 3 Community License     |
| `phi-3.5-mini-q4`               | llm   | ~2.4 GB | MIT                           |
| `gemma-2-2b-q4`                 | llm   | ~1.8 GB | Gemma Terms of Use            |
| `llama-3.2-1b-q4`               | llm   | ~0.9 GB | Llama 3 Community License     |
| `all-minilm-l6-v2`              | embed | ~25 MB  | Apache 2.0                    |

Source URLs and expected hashes live in `models.service.ts`.

## Choosing a model

- **Llama 3.2 3B** — default. Best quality / speed tradeoff on flagship
  phones (iPhone 15 Pro, Galaxy S24+). ~20 tok/sec.
- **Phi-3.5 mini** — slightly better at structured JSON output, similar
  size, similar speed. Try if you see card-gen JSON parse failures.
- **Gemma 2 2B** — fastest of the bunch. Cards are slightly shorter +
  blunter; great for grinding through large docs.
- **Llama 3.2 1B** — for low-end devices. Card quality suffers; RAG
  citations still land.
- **MiniLM-L6** — the only embedder. 384-dim, fast, multilingual-OK.

## Running with mock models

The default dev build sets `EXPO_PUBLIC_USE_REAL_MODELS=0`. The embed
service hashes inputs into deterministic 384-dim vectors; the LLM
service emits canned JSON for card-gen prompts and a one-line RAG-shaped
answer for everything else. The mock path is enough to drive every
screen end-to-end.

Flip the env var to load the real models:

```
EXPO_PUBLIC_USE_REAL_MODELS=1 pnpm ios
```

## Storage budget

- 50-page PDF → ~250 chunks → ~380 KB of float32 embeddings
- One LLM file → 1-2.5 GB
- Embedder → 25 MB

Settings → Storage shows a per-doc breakdown with a "danger zone wipe".
