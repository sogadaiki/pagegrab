# PageGrab CLI + MCP Server 技術設計書

Status: 設計完了、PH後に実装予定
Created: 2026-03-06

---

## 1. アーキテクチャ概要

```
pagegrab/
├── src/
│   ├── core/                    ← 新規: Chrome API非依存の純粋DOM解析ロジック
│   │   ├── extractor.ts         ← 既存extractor.tsからChrome APIを除去(778行/849行が再利用可)
│   │   ├── design-system-analyzer.ts  ← そのまま再利用可能
│   │   ├── layout-analyzer.ts         ← そのまま再利用可能
│   │   └── lp-analyzer.ts             ← そのまま再利用可能
│   │
│   ├── types.ts                 ← 既存: 全パッケージで共有
│   │
│   ├── extension/               ← 既存Chrome拡張コード(core/をimport)
│   │   ├── content.ts           ← core/をimport + chrome.runtime.onMessageリスナー
│   │   ├── service-worker.ts    ← chrome.downloads/debugger依存(拡張専用)
│   │   └── popup/popup.ts       ← 拡張専用UI
│   │
│   ├── cli/                     ← 新規: CLI版
│   │   ├── index.ts             ← エントリポイント(npx pagegrab)
│   │   ├── commands/
│   │   │   ├── extract.ts
│   │   │   ├── design-system.ts
│   │   │   ├── lp-analyze.ts
│   │   │   ├── layout.ts
│   │   │   └── screenshot.ts
│   │   ├── browser.ts           ← Playwright管理(launch/close/navigate)
│   │   └── output.ts            ← ファイル保存(fs.writeFileSync)
│   │
│   └── mcp/                     ← 新規: MCP Server版
│       ├── server.ts            ← MCP Serverエントリポイント
│       └── tools.ts             ← ツール定義(5ツール)
│
├── package.json
├── tsconfig.json
├── tsconfig.cli.json            ← CLI/MCP用(DOM型なし、Node.js向け)
└── build.mjs                    ← 拡張+CLI+MCPビルド統合
```

## 2. コード共有の境界分析

### そのまま再利用可能(Chrome API依存ゼロ)

| ファイル | 行数 | 依存 | CLI/MCPでの利用方法 |
|---------|------|------|-------------------|
| `types.ts` | 241 | なし | 全パッケージで直接import |
| `design-system-analyzer.ts` | 307 | DOM APIのみ | `page.evaluate()`で注入 |
| `layout-analyzer.ts` | 280 | DOM APIのみ | `page.evaluate()`で注入 |
| `lp-analyzer.ts` | 255 | DOM APIのみ | `page.evaluate()`で注入 |

### 軽微な分離が必要

| ファイル | 行数 | Chrome API依存箇所 | 分離方法 |
|---------|------|--------------------|---------|
| `extractor.ts` | 849 | 最後71行のみ(L779-849): onMessage/sendMessage | L1-776を`core/`に分離、L779-849を`extension/content.ts`に移動 |
| `component-picker.ts` | 300 | 1箇所のみ。インタラクティブUIなのでCLI/MCP不要 | CLI/MCPでは除外 |

### 拡張専用(再利用不可)

| ファイル | 行数 | 理由 |
|---------|------|------|
| `service-worker.ts` | 826 | chrome.downloads/debugger全体に浸透 |
| `popup.ts` | 125 | chrome.tabs/scripting -- 拡張UI専用 |

## 3. CLI コマンド体系

```
pagegrab extract <url>          # テキスト抽出 -> Markdown
pagegrab design-system <url>    # デザインシステム -> JSON/CSS/Tailwind
pagegrab lp-analyze <url>       # LP分析 -> JSON/Markdown
pagegrab layout <url>           # レイアウト分析 -> JSON
pagegrab screenshot <url>       # フルページスクリーンショット -> PNG

共通オプション:
  --output, -o <path>           # 出力先(デフォルト: stdout)
  --format <json|md|both>       # 出力形式
  --wait <ms>                   # ページ読み込み後の追加待機時間
  --viewport <WxH>              # ビューポートサイズ(デフォルト: 1280x800)
  --headless                    # ヘッドレスモード(デフォルト: true)
```

## 4. MCP Server ツール定義

5ツール: `pagegrab_extract`, `pagegrab_design_system`, `pagegrab_lp_analyze`, `pagegrab_layout`, `pagegrab_screenshot`

- 入力: URL + オプション(wait_ms, viewport)
- 出力: JSON(text content type) / PNG(image content type)
- 一括出力(ストリーミング不要)
- 依存: `@modelcontextprotocol/sdk`, `zod`, `playwright`

## 5. 実装ステップ(合計10時間)

| Phase | 内容 | 工数 |
|-------|------|------|
| 1 | core/ 分離 + 拡張動作確認 | 2h |
| 2 | CLI基盤(browser.ts, output.ts, extractコマンド) | 3h |
| 3 | CLI残りコマンド(4コマンド) | 2h |
| 4 | MCP Server(CLI commandsを再利用) | 2h |
| 5 | パッケージ整備(bin, exports, README) | 1h |

## 6. 技術的な注意点

- **Playwright初回DL**: Chromiumバイナリ200MB+。`playwright-core` + 既存Chrome指定で軽量化可能
- **X.comログイン**: CLI版ではセッションなし。`--cookies`/`--profile`オプションで対応
- **headless描画差異**: Webフォント読込タイミング等で拡張版と結果が異なる可能性
- **スクリーンショット**: 拡張版120行のchrome.debugger処理 -> Playwright `page.screenshot()` 1行に置換
- **単一パッケージ推奨**: 3,183行にモノレポは過剰

## 7. 戦略的位置づけ

- **タイミング**: PH後2-3週で実装。PH前には触らない
- **価格**: Pro$29購入者に同梱(CLI/MCP含む)。カニバリなし(ペルソナが違う)
- **競合**: CLI/MCP対応の直接競合はゼロ(2026-03時点)。First mover
- **レバー**: Pro購入者へCLI配布 -> Chrome Web Storeレビュー依頼のきっかけ
- **第2弾ローンチ**: PH結果バッジ付きでDev.to/HNに「now on CLI & MCP」告知
- **撤退条件**: PH Top5未達ならCLI開発に入らず撤退判断優先
