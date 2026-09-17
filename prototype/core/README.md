# Versioned application engines

- `v1/`: existing frozen geometry utilities and historical reference engine.
- `v2/`: application lifecycle, geometry and renderer frozen from commit `8a70a72`. Records with `bonsai-growth-2` or no version use this engine. Its default output is the compatibility baseline.
- `v3/`: the reviewed design language, individual generation and renderer. It reuses the frozen v2 lifecycle through generator injection, along with frozen v1/v2 utilities. Records explicitly use `bonsai-growth-3`.

Do not import mutable prototype/research geometry into these engines. Changes that alter persisted geometry, identifiers or random choices require a new version. Shared interaction/UI modules may evolve independently. The top-level design language files remain experiment sources; the design page uses v3 as its application baseline.
