# My bonsai · 我的盆栽

A quiet, mobile-first browser game about growing and shaping a bonsai. Adopt a randomly generated sapling, give it a name, and return to its permanent link to see how it has grown.

## How to play

1. **Adopt a tree.** Each sapling has its own silhouette, foliage, colors, and pot. Naming it is optional.
2. **Watch it grow.** Time passes while you are away. Returning plays a short growth replay.
3. **Shape and care for it.** Drag the scissors to prune side branches, or bring the watering can to the pot. The trunk stays protected, and new branches grow gradually over time.
4. **Come back and share.** Keep the tree's link, invite someone to visit, or explore other trees in the courtyard gallery.

No scores, winning, or finish line—just a tree that changes with time and your care. No account is required; anyone with a tree's link can visit and interact with it.

The main game supports **English and Simplified Chinese**, follows your browser language by default, and offers a language selector on the homepage.

## Run locally

Use **Node.js 24**.

```sh
npm ci
npm start
```

Open [localhost:4173](http://127.0.0.1:4173/). Local trees are saved in `data/trees.json` by default. Run checks with `npm test`.

## Design and documentation

- [Documentation index](docs/README.md) — design, implementation, research, reviews, and historical archives.
- Game design: [English](docs/design.en.md) · [简体中文](docs/design.zh-CN.md).
- [Design system preview](http://127.0.0.1:4173/design-system.html) — interactive trees, pots, colors, and tools; requires the local server.
- [Original MVP design](docs/archive/original-mvp.zh-CN.md) — historical product proposal in Chinese; some mechanics have since changed.
- [Implementation and development reference](docs/implementation-notes.zh-CN.md) — detailed behavior, experiments, and links to technical notes in Chinese.

## Development and CI

Develop on `dev`, tracking `origin/dev`. Review changes and validate them locally before pushing; agent changes require explicit approval after review. Follow [AGENTS.md](AGENTS.md).

The [CI workflow](.github/workflows/ci.yml) tests with Node.js 24 and promotes a successful `dev` commit to `main` by fast-forward. `main` is the production branch. CI success alone does not confirm deployment.

## Render + Neon

Deploy using [render.yaml](render.yaml), with Render tracking `main` and a Neon PostgreSQL connection in `DATABASE_URL`. Production requires PostgreSQL. For local database configuration, copy [.env.example](.env.example) to `.env` and provide your connection string.

Set `PUBLIC_BASE_URL` when using a custom domain so shared tree links and preview images use the correct address. Keep `.env`, database credentials, and local `data/` out of commits.
