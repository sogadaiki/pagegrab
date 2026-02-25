# PageGrab

Chrome extension that extracts page text as Markdown and downloads images locally. Built for feeding web content into AI tools like Claude Code.

WebページのテキストをワンクリックでMarkdown抽出し、画像もローカル保存するChrome拡張機能です。

## Why? / なぜ作ったか

- **X (Twitter) blocks AI bots** - Claude Code can't read tweets or X articles
- **FireShot's free plan** produces blurry screenshots that AI can't parse
- **Long-form X articles (Notes)** need both text AND images extracted together

PageGrab solves all three: one click to extract structured Markdown + download all images locally.

---

- **X(Twitter)がAI/Botをブロックする** - Claude CodeでXのページを読み込めない
- **FireShotの無料プラン** - スクリーンショットの文字が潰れてAI解析できない
- **Xの長文記事(Notes)** - テキストと画像を一括でナレッジ化したい

PageGrabはこの3つをワンクリックで解決します。Markdown形式のテキスト + 画像をローカルに保存し、Claude CodeのReadツールでそのまま読み取れます。

## Features / 機能

- **テキスト抽出** - DOMベースの抽出。ログイン済みセッションで動作するためBotブロックの影響なし
- **X(Twitter)最適化** - ツイート、スレッド、Notes(長文ポスト)、Articlesに対応
- **画像ダウンロード** - 記事内の全画像をローカル保存。Markdownに絶対パスで参照
- **Markdown出力** - frontmatterメタデータ + 構造化コンテンツ。AIツールにそのまま渡せる形式
- **外部依存ゼロ** - ブラウザ内で完結。APIキー不要、外部サーバーへの通信なし

## Size / サイズ

| Item | Size |
|------|------|
| Extension (dist/) | **80KB** |
| Source code | ~1,000 lines (TypeScript) |
| Runtime dependencies | **0** (dev-only: esbuild, typescript, @types/chrome) |

拡張機能本体はわずか **80KB** です。外部ライブラリの実行時依存はありません。ビルドに必要な `node_modules` (~34MB) はインストール時のみ使用され、ブラウザには読み込まれません。

## Security / セキュリティ

- **外部通信なし** - 抽出したデータはローカルにのみ保存されます。外部サーバーへの送信は一切ありません
- **コード量が少ない** - TypeScript約1,000行のみ。全コードを自分で確認できます
- **難読化なし** - ビルド済みJSもminifyしていません。`dist/` 内のコードをそのまま読めます
- **必要最小限の権限** - `activeTab`(現在のタブのみ), `scripting`, `downloads`, `debugger`

**自己責任でのインストールをお願いします。** Chrome Web Storeの審査を経ていない開発者モードインストールです。コードはすべてこのリポジトリで公開されているので、不安な方はインストール前にソースコードをご確認ください。

## Install / インストール

Chrome Web Storeには公開していません。開発者モードでインストールします。

```bash
git clone https://github.com/sogadaiki/pagegrab.git
cd pagegrab
npm install
npm run build
```

1. Chromeで `chrome://extensions` を開く
2. 右上の **「デベロッパーモード」** をONにする
3. **「パッケージ化されていない拡張機能を読み込む」** をクリック
4. クローンしたリポジトリの `dist/` フォルダを選択

## Usage / 使い方

1. テキストを抽出したいページを開く（Xのツイート、記事、ブログなど）
2. ツールバーのPageGrabアイコンをクリック
3. **「Extract Text」** ボタンを押す
4. `~/Downloads/pagegrab/` にファイルが保存される
   - `text/` - Markdownファイル
   - `images/` - ページごとにフォルダ分けされた画像

### Claude Codeとの連携

```bash
# 抽出したテキストを読む
claude "Read ~/Downloads/pagegrab/text/x.com_user_status_123_2025-01-01.md"

# 記事内の画像を読む（Claude Codeは画像も読み取り可能）
claude "Read ~/Downloads/pagegrab/images/x.com_user_status_123_2025-01-01/img_001.jpg"
```

## Output Format / 出力形式

```markdown
---
source: x.com
type: x-article
author: "@username"
url: https://x.com/user/status/123
extracted_at: 2025-01-01T00:00:00Z
---

# Article Title

Article content in Markdown...

![image](~/Downloads/pagegrab/images/.../img_001.jpg)

---

## Images (local paths)

- ~/Downloads/pagegrab/images/.../img_001.jpg
- ~/Downloads/pagegrab/images/.../img_002.png
```

## Tech Stack

- Chrome Extension Manifest V3
- TypeScript (strict mode)
- esbuild
- No external runtime dependencies

## Development

```bash
npm install
npm run build        # Build once
npm run watch        # Watch mode
npm run type-check   # TypeScript check
```

## License

MIT
