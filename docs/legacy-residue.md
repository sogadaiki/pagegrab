# Legacy Residue

## Live, Not Residue

### `manifest.json`

Chrome 拡張の runtime 設定です。
first pass で削除候補にしません。

### `src/background/**`, `src/content/**`, `src/popup/**`

拡張機能の現行実装です。
repo の中心です。

### `src/cli/**`

進行中の追加レーンですが、現役の実装対象です。
未完成でも residue 扱いしません。

### `store/**`

promo asset、配布 ZIP、listing 原稿の tracked workspace です。
generated artifact ではなく、意図的に repo に残しています。

## Local-Only Artifacts

### `dist/`

build output です。
repo truth ではありません。

### `node_modules/`

ローカル依存です。
repo truth ではありません。

### `restart.md` と `restart/**`

local handoff 用メモです。
最近の状況把握には有用ですが、canonical truth ではありません。

## Cleanup Rule

この repo では、削除対象になりやすいのは `dist/` や local cache です。
`store/` や `src/cli/**` は first pass で消さず、配布物 / 進行中レーンとして区別してください。
