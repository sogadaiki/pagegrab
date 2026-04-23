# Project Context

## Product

PageGrab は、Web ページの本文を Markdown と画像セットでローカル保存する Chrome 拡張です。
主用途は、X やブログ記事などを AI ツールに渡せる形へ変換することです。

## Current Operating Shape

- 本体は Chrome Extension Manifest V3
- `src/background/**` が service worker
- `src/content/**` が抽出・解析ロジック
- `src/popup/**` が popup UI
- `src/cli/**` は CDP 接続で screenshot を取る追加 CLI レーン
- build は `build.mjs`
- 配布用・promo 用の静的資産は `store/`

現時点の主役は extension 本体です。最新の restart notes では、CLI の Slice 1b 以降が次タスクとして残っています。

## Stakeholders

- 曽我さん / sadame
  - プロダクト責任者
  - 実運用と配布判断を持つ
- PageGrab 利用者
  - Claude / Codex / その他 AI ツールに Web コンテンツを取り込みたい人
- `sadame-ops`
  - portfolio 上の位置づけ、他プロダクトとの routing、販売導線の正本

## Decision Boundaries

- 拡張機能本体、抽出ロジック、CLI、配布物の truth はこの repo
- 事業文脈、他プロダクトとの接続、横断 inventory は `sadame-ops`
- Chrome Web Store 公開や配布方針の判断は repo 外の運用境界

## Current Risks

- `src/cli` は進行中レーンで、extension 本体と完成度が異なる
- repo に `store/` の配布物、`dist/` の build output、`restart/` の handoff が混在し、初見者が truth を取り違えやすい
- AGENTS / project-context が無い状態だと、Chrome 拡張 repo なのか CLI repo なのかが分かりにくい

## Practical Read

初見者は、まず `manifest.json` と `src/content/extractor.ts` で extension の中心を掴み、その後 `build.mjs` と `restart.md` で CLI の現在地を確認すると安全です。
