# PageGrab Monetization Strategy
# 統合レポート: Kenji (Marketing) + Mei (Business) + Rina (Finance)

Updated: 2026-03-06

---

## Executive Summary

3つの専門分析を統合した結論:

1. **Product Huntで上位3位を取ることが最大のレバー** -- 標準vs保守的シナリオのARR差の大部分がPH成否で決まる
2. **$29ワンタイムPro版が最適** -- サブスクはローカル処理拡張に不適。DivMagicの3.49評価が反面教師
3. **最初の3ヶ月は完全無料** -- 信頼構築とフィードバック収集が最優先
4. **ローンチ目標日: 4月第2週（火〜木）** -- D-30の準備期間を確保

### 12ヶ月の収益予測（期待値）

| 指標 | 保守的 | 標準 | 楽観的 | 期待値 |
|------|--------|------|--------|--------|
| M12 MRR相当 | $426 | $1,557 | $4,211 | $1,691 |
| 12ヶ月累計 | $3,244 | $9,712 | $22,038 | $10,500 |
| ARR換算 | $5,112 | $18,684 | $50,532 | $20,292 |

---

## Phase 0: 完全無料期間（M1〜M3）

### 目的
- Chrome Web Storeでの評価・レビュー獲得
- 使用データ収集（どの機能に最も価値を感じるか）
- Product Hunt準備

### やること
- 全5機能を無料で提供
- chrome.storage.localで匿名使用カウント（機能別）
- build-in-publicをTwitter/Xで開始
- Product Huntアカウント育成

### 撤退ライン
- 3ヶ月でインストール500未満 → マーケティング見直し
- WAU 50未満 → プロダクト問題。開発中止検討

---

## Phase 1: Pro版導入（M3〜M6）

### 価格
- **Pro Lifetime: $29**（期間限定 → 200人到達で$49に値上げ）
- 決済: LemonSqueezy（インフラ不要）
- ライセンスキー方式

### ゲート設計

| ティア | 機能 |
|--------|------|
| Free | Text Extract + Full Screenshot（月30回制限） |
| Pro $29 | LP Analysis + Design System + Component Picker + 無制限 |

**ゲートの鉄則**: Pro機能は「結果のプレビュー」を見せてからゲート。DivMagicの「何も見せずペイウォール」は絶対にやらない。
- LP Analysis: 最初の3色 + 1フォントだけ無料表示
- Design System: 「Token数: 42個検出」だけ表示、中身はPro

### Pro限定の新機能（開発優先順）
1. **Tailwind Config生成** -- 既にtailwind.config.js出力はあるがPro限定に
2. **Figma Export** -- デザインシステムをFigma Variables/Stylesとして出力
3. **比較モード** -- 2サイトのデザインシステム差分表示
4. **AI向けプロンプト生成** -- 抽出結果をClaude/ChatGPTに渡す最適化プロンプト

### 撤退ライン
- 6ヶ月でPro購入10件未満 → 全機能無料化、OSSブランディングに転用
- 累計売上$300未満 → 同上

---

## Phase 2: 価格最適化（M6〜M12）

### 価格改定
- Pro Lifetime: $29 → $49（200人到達トリガー）
- サブスク追加: $9/mo or $79/yr（ワンタイム購入者300人超えトリガー）
- チームライセンス: 5人 $99、10人 $149

### 既存購入者の保護
- ワンタイム購入者は永続的にPro機能を利用可能（信頼維持）

---

## Product Hunt Launch Strategy

### 最重要ファクト
- 2025年アルゴリズム変更: **Featured（掲載）されるかどうかが全て**
- Featured判定: Useful / Novel / High Craft / Creative の4基準（手動審査）
- 1時間目のupvotesは**4倍の重み**
- **コメント > upvotes**（ランキング影響力）
- 上位3位に必要: 500-800 upvotes

### ローンチ設定
- **セルフハント推奨**（成功の60%がセルフハント）
- **火〜木 12:01 AM PST**
- **目標日: 4月第2週**

### 動員目標: 310人

| チャネル | 人数 |
|----------|------|
| 個人ネットワーク | 50 |
| Twitter/X | 100 |
| 開発者Discord/Slack | 80 |
| Dev.to / HN | 50 |
| Reddit | 30 |

### Gallery構成
1. カバー画像 2400x1200px
2. GIF: Design System逆引きデモ（最優先）
3. GIF: Screenshot + Markdown Export
4. GIF: Component Picker + LP Analysis

### キラーメッセージ
> "5 tools, 0 servers, $0 forever"

---

## D-30 Action Calendar

詳細は `docs/producthunt-launch-strategy.md` を参照。

### 今週（D-30）
- [ ] Product Huntアカウント作成 + Coming Soon page
- [ ] Twitter build-in-public開始
- [ ] 動員リスト50人作成
- [ ] デモ動画撮影（Issue #7）

### D-14
- [ ] デモGIF 3本完成
- [ ] Dev.to技術記事公開
- [ ] Maker First Comment完成

### D-3
- [ ] Product Page全コンテンツ完成
- [ ] サポーター全員への事前告知
- [ ] SNS投稿スケジュール済み

### D-Day
- [ ] 全コメントに5分以内返信（最優先）
- [ ] ローンチ日は他の全業務を止める

---

## 競合比較（なぜPageGrabが勝てるか）

| | PageGrab | DivMagic | CSS Scan | FireShot | GoFullPage |
|--|----------|----------|----------|----------|------------|
| 価格 | Free + $29 Pro | $49/mo | $80 | Free + $100 Pro | Free + $6/mo |
| 機能数 | 5 | 1 | 1 | 1 | 1 |
| Design System | **独自** | -- | -- | -- | -- |
| LP Analysis | **独自** | -- | -- | -- | -- |
| サーバー | なし | あり | なし | なし | なし |
| ユーザー評価 | TBD | 3.49/5 | 高い | 高い | 高い |

**ポジショニング**: 「競合の半額以下で、機能は5倍」

---

## リスクマトリックス

| リスク | 確率 | 対策 |
|--------|------|------|
| PH Featuredされない | 中 | 4基準を全て満たすPage作り込み |
| PH当日に強い競合 | 中 | D-Day朝にGo/NoGo判断、1日延期オプション |
| Chrome Web Store削除 | 低 | debugger権限の正当性ドキュメント化済み |
| 競合が無料化 | 中 | 先行者優位 + レビュー数で防御 |
| ライセンスクラック | 高 | 受容する。正当ユーザーの体験を優先 |

---

## KPI

| KPI | 最低 | 目標 | ストレッチ |
|-----|------|------|-----------|
| PH順位 | Top 5 | Top 3 | 1位 |
| 当日upvotes | 300 | 600 | 1,000+ |
| D-Day Install | 100 | 400 | 1,000 |
| M6 Pro購入累計 | 30件 | 100件 | 300件 |
| M12 月間売上 | $400 | $1,500 | $4,000 |

---

Sources:
- CSS Scan $100K+ AMA (Indie Hackers)
- Easy Folders $3,700 MRR case study
- DivMagic reviews 3.49/5 (Chrome Web Store)
- Product Hunt algorithm changes 2025
- ExtensionFast / ExtensionRadar monetization guides
- Product Hunt featuring guidelines
- Stripe fee structure 2025-2026
