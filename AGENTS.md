# Repo Guide

## Read Order

1. `README.md`
2. `AGENTS.md`
3. `docs/project-context.md`
4. `docs/legacy-residue.md`
5. `restart.md`

## Scope Boundary

- この repo の本体は Chrome Extension Manifest V3 のローカルツールです
- live runtime は `src/background`, `src/content`, `src/popup`, `manifest.json`
- `src/cli` は extension 本体とは別の Node CLI レーンです
- `sadame-ops` は portfolio routing と事業文脈を持つだけで、実装 truth ではありません

## Truth-Source Precedence

When files disagree, trust them in this order:

1. `src/background/**`, `src/content/**`, `src/popup/**`, `src/cli/**`
2. `manifest.json`
3. `build.mjs`
4. `docs/project-context.md`
5. `README.md` / this file
6. `restart.md`

## Operational Guardrails

- `dist/` はローカル build output です。repo truth ではありません
- `node_modules/` はローカル依存で、commit 対象ではありません
- `store/` は配布物や promo asset を置く tracked workspace です。first pass で削除候補にしません
- `restart.md` と `restart/**` は local handoff。最近の状況把握には有用ですが、canonical truth ではありません
- version は `package.json` と `manifest.json` の一致が前提です。`build.mjs` が mismatch を fail fast します

## Safe First Checks

```bash
npm run type-check
npm run build
```

Chrome への読み込み確認まで進めるなら、`dist/` を extension として reload してから見るのが安全です。
