# PageGrab - Product Hunt Launch Strategy
# Target: Top 3 Product of the Day

Updated: 2026-03-06

---

## 1. 戦況分析

### PageGrabの競合優位性（Product Hunt文脈）

| 軸 | PageGrab | FireShot | DivMagic |
|---|---|---|---|
| 価格 | 無料 | 無料/有料 | $49/月 |
| スクリーンショット | 全ページ | 全ページ | なし |
| テキスト抽出 | Markdown出力 | なし | なし |
| デザインシステム逆引き | **独自機能** | なし | なし |
| コンポーネントPicker | あり | なし | あり |
| サーバー/データ収集 | **ゼロ（ローカル処理）** | なし | クラウド |

**Product Hunt受けする最大の訴求点は2つ:**
1. デザインシステム逆引き = 競合ゼロの独自カテゴリ
2. 完全ローカル処理 = プライバシー訴求（開発者コミュニティに刺さる）

### 上位3位に必要なupvote数（2025-2026実績）

- 1位: 800-1,200 upvotes（競合の多い日は1,500+）
- 3位以内: 500-800 upvotes
- Featured（掲載）される最低ライン: 明確な数字なし（品質審査あり）

**2025年アルゴリズム変更後の重要事項:**
- Featured（ホームページ掲載）されないと、upvote数に関係なく圏外
- 1時間目のupvotesは4倍の重みで計算される
- コメントはupvotesより高いランキング影響力を持つ
- 新規アカウントのupvotesはほぼカウントされない（既存アカウント必須）

---

## 2. Featured獲得のための品質基準

Product Huntが手動でFeatured判定に使う4基準:

| 基準 | PageGrabの状況 | 対策 |
|---|---|---|
| **Useful** | 5機能すべて即戦力 | 具体的ユースケースを説明文に |
| **Novel** | デザインシステム逆引きは唯一無二 | この機能を前面に押し出す |
| **High Craft** | Product Pageの見た目で決まる | GIF/動画を高品質に |
| **Creative** | 訴求方法の独創性 | "5 tools, 0 servers, $0 forever" |

**Featured獲得の実績ある方法:**
- 本物のmaker story（なぜ作ったか）
- 実際に動くデモGIF（スクリーンレコーディングが有効）
- 明確な差別化 = 既存解決策の何が問題か

---

## 3. ローンチ設定

### 投稿タイミング
- **日時**: 火〜木曜日の 12:01 AM PST（太平洋標準時）
- **理由**: リーダーボードがリセット → 24時間フル活用
- 1時間早めるごとに +8.7% upvotes（実績データ）
- 火〜木は競合多いが、developer tools目的のユーザーも多い

### Product Pageの必須要素

```
タイトル: PageGrab
タグライン（40字以内）: PageGrab – Extract, Analyze, and Inspect Any Webpage
サブタイトル: 5 tools in one Chrome extension. Text, Screenshots, Design Systems, Components, LP Analysis. All local. No data ever leaves your browser.
カテゴリ: Chrome Extensions / Developer Tools / Design Tools
タグ: chrome-extension, design-tools, developer-tools, productivity, screenshot
```

**Gallery構成（推奨順）:**
1. カバー画像（2400x1200px）: 5機能を1枚に視覚化
2. GIF 1: Design System逆引きのデモ（最も差別化される機能）
3. GIF 2: Full Screenshot → Markdown Export の流れ
4. GIF 3: Component Picker + LP Analysis
5. スクリーンショット: Before/After（DivMagicとの比較）
6. スクリーンショット: Privacy badge（No server, No tracking）

**動画（オプションだが強力）:**
- 2〜3分のスクリーンレコーディング
- 製作者自身のナレーション（エージェンシー制作より高評価の実績あり）
- "This is what I built and why" のトーン

---

## 4. コミュニティ動員計画

### ターゲット・サポーター属性（2025年アルゴリズム対応）

**重要**: 新規アカウントのupvotesは無価値。以下の属性のサポーターを集める:
- Product Huntアカウント歴6ヶ月以上
- 過去に他のプロダクトをupvoteしている
- 本名/本物のプロフィールあり

### 動員チャネルと目標人数

| チャネル | 目標人数 | 特徴 |
|---|---|---|
| 個人ネットワーク（リアル知人） | 50人 | 最高品質のupvotes |
| Twitter/X フォロワー | 100人 | 速攻性あり |
| 開発者コミュニティ（Discord/Slack） | 80人 | 質が高い |
| Dev.to / Hacker News | 50人 | 開発者特化 |
| Reddit（r/webdev等） | 30人 | 慎重に（自己宣伝禁止） |
| **合計目標** | **310人** | 500 upvotes達成に必要 |

### チャネル別戦術

**Twitter/X（最重要）:**
- ローンチ6週前からbuild in publicを3投稿/週
- ハッシュタグ: #buildinpublic #devtools #webdev
- インフルエンサーへのタギング（@MichaelBacina等のdev community voices）
- ローンチ当日: 12:01 AM PST直後に第1投稿

**開発者Discord/Slack:**
- 対象コミュニティ: Indie Hackers、Changelog、Reactiflux、Design Systems Slack、Figma Community
- 投稿タイミング: D-7からティーザー、D-Day当日に本投稿

**Reddit（慎重に）:**
- r/webdev: "I built a tool" スタイルで価値提供型投稿
- r/chrome_extensions: 機能紹介
- r/Frontend: デザインシステム逆引き機能の技術的説明
- 絶対NG: "Please upvote my PH launch" の直接依頼

**Dev.to:**
- D-14: "How I built PageGrab: extracting design tokens from any website" 記事
- ローンチ当日にPH URLをコメントで追記

---

## 5. Hunter戦略

### Hunter vs セルフハント判断

**推奨: セルフハント**

根拠:
- 成功ローンチの60%はセルフハント（Demand Curve調査）
- 有名Hunterに依頼しても成果は不安定（Chris Messina経由でも100 upvotesを下回る例多数）
- developer toolsカテゴリはコミュニティの質の方が重要
- セルフハントの方がメッセージングをコントロールしやすい

**有名Hunterを使う場合の条件（当てはまれば検討）:**
- 相手が技術系/デザイン系コミュニティに特化している
- 相手のフォロワーがPageGrabのターゲットと重なる
- 相手が事前にプロダクトを試した上でHuntしてくれる

---

## 6. Maker First Comment（必須・事前作成）

ローンチ当日 00:05 AMに投稿する最初のコメント。70%の受賞プロダクトがMakerコメントで1位を取っている。

### テンプレート（300-400字、事前に日本語で起草してから英訳）

```
Hi Product Hunt!

I'm [Name], and I built PageGrab after spending hours of every week hunting through
browser DevTools trying to reverse-engineer design systems on websites I admired.

The problem: there was no fast way to extract the full design system of any page—
colors, typography, spacing, components—without manually digging through minified CSS.

So I built 5 tools into one free Chrome extension:

- Design System Extractor: Instantly surfaces color palettes, type scales, spacing tokens
- Text Extractor: Copies any page as clean Markdown
- LP Analyzer: Breaks down landing page structure and CTA hierarchy
- Component Picker: Inspect and copy any element's computed CSS
- Full Page Screenshot: Pixel-perfect full-page capture, no server needed

Everything runs locally in your browser. No data ever leaves your machine.

I'd love feedback on two things:
1. Which feature do you find most useful day-to-day?
2. What's missing that would make this a daily driver?

Thanks for checking it out. I'll be here all day answering questions.
```

**コメント投稿のルール:**
- upvotesを直接頼むのは禁止（ルール違反 + アルゴリズム的にもペナルティ）
- 「check out」「feedback」「thoughts」と頼む
- コメントへの返信は5分以内（3時間以降は1コメント未回答=ランク5位分のロス）

---

## 7. ローンチ当日 タイムライン（PST基準）

| 時刻（PST） | アクション | 担当 |
|---|---|---|
| 12:01 AM | Product Huntに投稿 | CEO |
| 12:05 AM | Maker First Commentを投稿（事前作成） | CEO |
| 12:10 AM | Twitter/X 第1投稿（PH URL + 3機能GIF） | CEO |
| 12:15 AM | Discord/Slackコミュニティへ投稿 | CEO |
| 12:30 AM | 個人ネットワークにWhatsApp/SMS通知 | CEO |
| 01:00 AM | メール購読者にローンチ告知（あれば） | CEO |
| 06:00 AM | LinkedIn投稿（フィードバック依頼スタイル） | CEO |
| 08:00 AM | Twitter/X 第2投稿（機能デモGIF） | CEO |
| 12:00 PM | Reddit投稿（r/webdev, r/Frontend） | CEO |
| 12:00 PM | 15分 Twitter Space AMA（可能なら） | CEO |
| 15:00 PM | コメント返信の総チェック + Twitter 第3投稿 | CEO |
| 18:00 PM | Dev.to記事にPH URLを追記 | CEO |
| 20:00 PM | 「ラスト4時間」ツイート | CEO |
| 23:55 PM | 感謝ツイート + 結果共有 | CEO |

**ローンチ中の最優先事項:** Productの全コメントに5分以内返信。他は全部後回し。

---

## 8. D-30〜D+7 日単位アクションカレンダー

### Phase 1: 基盤構築（D-30〜D-22）

**D-30（今日）**
- [ ] Product Huntアカウント作成・本人確認完了
- [ ] Coming Soon pageを作成・公開
- [ ] Twitterで「PageGrabを作っています」build-in-public第1投稿

**D-29**
- [ ] Product Huntで5プロダクトにupvote + コメント（アカウント育成）
- [ ] Dev.to / Hacker Newsアカウント作成

**D-28**
- [ ] ターゲットDiscordサーバー（Indie Hackers、Design Systems Slack等）に参加
- [ ] Twitter build-in-public第2投稿：「なぜ作ったか」ストーリー

**D-27〜D-25**
- [ ] Product Huntで毎日3-5プロダクトにコメント（コミュニティ存在感の構築）
- [ ] 今後30日で動員する個人ネットワーク100人のリストアップ

**D-24〜D-22**
- [ ] デモGIF制作開始（Design System逆引きのデモが最優先）
- [ ] Twitter第3投稿：「今日気づいたデザインシステム逆引きの活用法」

### Phase 2: 露出準備（D-21〜D-14）

**D-21**
- [ ] Product Page草稿作成（タグライン、説明文、Gallery構成）
- [ ] カバー画像（2400x1200px）制作開始

**D-18〜D-15**
- [ ] Twitter: build-in-public週3投稿を継続
- [ ] 開発者Discordで自然な会話に参加（宣伝はまだしない）
- [ ] 個人ネットワークへの事前告知開始（「近々PH出します」）

**D-14**
- [ ] Dev.to記事公開: "How I reverse-engineer design systems with PageGrab"
  - 記事末尾に「launching on PH in 2 weeks」のティーザーを追加
- [ ] Product Hunt Coming Soon pageにティーザー画像追加

**D-12〜D-10**
- [ ] Maker First Comment完成・英語校正
- [ ] Gallery用GIF 3本完成（Design System, Screenshot, Component Picker）
- [ ] Twitter: デモGIFつき「What's your biggest pain with CSS inspection?」質問投稿

### Phase 3: サポーター確定（D-9〜D-2）

**D-9〜D-7**
- [ ] 個人ネットワーク50人に直接メッセージ送信
  - 件名: 「来週木曜、Product Huntに出します。見てもらえますか？」
  - 内容: ローンチ日時、具体的お願い（「upvoteじゃなくてコメントを」と伝える）
- [ ] Hacker News「Show HN」投稿の草稿作成

**D-6〜D-5**
- [ ] 開発者Discord/Slackで「D-5前にフィードバックほしい」と投稿（ソフトティーザー）
- [ ] Product HuntのComing Soon pageを友人にシェアしてフォロワー増加を促す

**D-4〜D-3**
- [ ] ローンチ日時の最終確認（火〜木の 12:01 AM PST）
- [ ] サポーター用「当日何をしてほしいか」の説明文を準備
  - 例: 「PH URLを開いて、コメントを残してくれるだけで大きな助けになります」
- [ ] Twitter: 「明後日ローンチします」カウントダウン投稿

**D-2**
- [ ] Product Huntページの全コンテンツを完成・最終確認
  - タグライン、Gallery、説明文、タグ、リンク
- [ ] Maker First Commentの最終版確定
- [ ] サポーター全員に最終リマインド（ローンチURLは明日送ると伝える）

**D-1**
- [ ] Product Huntページをスケジュール投稿設定（12:01 AM PST）
- [ ] サポーター全員にローンチURL事前送付
- [ ] Twitter: 「明日ローンチ」投稿
- [ ] Dev.toコミュニティへの事前告知コメント
- [ ] 当日の全SNS投稿を事前作成・スケジュール設定
- [ ] 早めに就寝（深夜〜早朝の対応のため）

### Phase 4: ローンチ日（D-Day）

Section 7「ローンチ当日タイムライン」を参照。

**追加アクション:**
- [ ] コメントへの返信を24時間継続（5分ルール）
- [ ] Reddit投稿: r/webdev「I built a free Chrome extension to reverse-engineer design systems」
- [ ] Hacker News「Show HN: PageGrab – Extract design systems, text, and screenshots from any page」
- [ ] 上位に入った場合: Twitterでリアルタイム更新投稿（「現在2位！」等）

### Phase 5: ローンチ後（D+1〜D+7）

**D+1**
- [ ] 結果の公開（順位、upvote数、コメント数、流入数）
- [ ] 感謝ツイート（具体的コメントを引用）
- [ ] 上位3位以内: Hacker News「Show HN」投稿（PH掲載をレバレッジ）

**D+2〜D+3**
- [ ] コメントからフィードバックを分類（機能要望、バグ報告、賞賛）
- [ ] 「PH launch振り返り」記事の執筆開始（Dev.to / Zenn / note）
- [ ] Product Hunt結果をChrome Web Storeのキャプションに使用

**D+4〜D+7**
- [ ] 上位入賞なら: Tech系メディアへのプレスリリース送付
  - 対象: Product Hunt自体のニュースレター、The Browser Company、Chrome拡張専門メディア
- [ ] Dev.to「PH launch case study」記事公開
- [ ] 「Product of the Day #X」バッジをサイト・拡張ストアページに掲載
- [ ] Redditでのフォローアップ: r/webdev「The response to PageGrab after 1 week」

---

## 9. リスクと対策

### リスク1: Featured（掲載）されない
- **対策**: D-7にProduct HuntサポートへのDMで「プロダクトのフィードバックを求める」形で事前関係構築
- **対策**: 4基準（Useful/Novel/High Craft/Creative）すべてに対応したPageの作り込み

### リスク2: 1時間目のupvotesが少ない
- **対策**: 深夜にサポートしてくれる人（海外在住の知人、海外の開発者コミュニティ）を事前確保
- **対策**: 米国時間帯のコミュニティ（IndieHackers等）に事前から投資

### リスク3: 競合の強い日に当たる
- **対策**: ローンチ当日の朝4-5 AM PSTに既存ランクを確認し、上位にAI/viral productがいる場合は一日延期を検討
- **実行**: D-1の段階でスケジュール済みにして、D-Day朝に最終Go/NoGoを決断

### リスク4: コメントへの返信が追いつかない
- **対策**: ローンチ日は他の全業務を止める。可能なら友人1人をコメント監視に巻き込む

---

## 10. Product Hunt後の資産化

### 直接的な活用
- Chrome Web Store掲載ページに「Product Hunt Top 3」バッジ追加
- GitHubリポジトリのREADMEに追加
- 個人サイト・ポートフォリオに掲載

### メディア露出の狙い方
- Product Hunt Golden Kitty Awards（年次）: 上位3位以内の実績があれば自薦可能
- The Changelog podcast: 開発者向け、Chrome拡張でユニーク機能は好まれる
- CSS-Tricks / Smashing Magazine: デザインシステム逆引き機能は記事ネタになる

### SEO効果
- Product Huntのプロフィールページ自体がSEOバリューを持つ
- "PageGrab chrome extension" で上位表示を狙うためのアンカー
- PH投稿後にDevToolsカテゴリで長期的に発見される

---

## 11. KPI設定

| KPI | 最低目標 | 達成目標 | ストレッチ目標 |
|---|---|---|---|
| Product Hunt順位 | Top 5 | Top 3 | 1位 |
| 当日upvote数 | 300 | 600 | 1,000+ |
| コメント数 | 30 | 80 | 150 |
| Chrome Web Store流入 | 500 | 2,000 | 5,000 |
| Install数（D-Day） | 100 | 400 | 1,000 |

---

## 12. 実行チェックリスト（優先順）

### 今週中（D-30〜D-25）
- [ ] Product Huntアカウント作成・Coming Soon page公開
- [ ] Twitter build-in-public開始
- [ ] 動員する個人ネットワークのリストアップ（最低50人）

### D-14まで
- [ ] デモGIF 3本完成
- [ ] Dev.to記事公開
- [ ] Maker First Comment完成

### D-3まで
- [ ] Product Pageの全コンテンツ完成
- [ ] サポーター全員への事前告知完了
- [ ] ローンチ当日SNS投稿を全てスケジュール済み

### D-1
- [ ] PH投稿をスケジュール設定
- [ ] サポーターへのURL事前送付
- [ ] 当日の全準備が完了していることを確認

---

参照:
- [How we ranked #1 - Flexprice](https://flexprice.io/blog/how-we-ranked-product-of-the-day-on-product-hunt)
- [#1 Developer Tool of Week - Corbado](https://www.corbado.com/blog/launch-developer-tool-product-hunt)
- [Product Hunt launch guide - Flo Merian](https://hackmamba.io/developer-marketing/how-to-launch-on-product-hunt/)
- [No-fluff 2025 guide - Flowjam](https://www.flowjam.com/blog/how-to-get-featured-on-product-hunt-2025-guide)
- [Featuring Guidelines - Product Hunt](https://help.producthunt.com/en/articles/9883485-product-hunt-featuring-guidelines)
