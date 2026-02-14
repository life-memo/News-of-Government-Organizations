# 省庁新着ダッシュボード

日本の10省庁の「新着情報」をRSSから集約し、カレンダーで俯瞰・検索・日別要約が読めるWebアプリケーション。

## 対象省庁

内閣府 / 法務省 / 経済産業省 / 国土交通省 / 防衛省 / 外務省 / 総務省 / 厚生労働省 / 文部科学省 / 農林水産省

## 機能

- **カレンダービュー**: 月表示カレンダーで日付ごとの新着件数・省庁別バッジを表示
- **日付詳細ページ**: その日の全体要約＋省庁別要約＋アイテム一覧（原文リンク付き）
- **検索**: キーワード検索、省庁フィルタ、並び替え
- **RSS自動取得**: 定期ジョブで各省庁のRSSフィードを取得・重複排除・更新検知
- **要約生成**: ダミー実装 + OpenAI API対応（APIキー設定時）

## 技術スタック

- **Next.js 16** (App Router) + TypeScript
- **SQLite** (Prisma + better-sqlite3)
- **Tailwind CSS v4**
- **rss-parser** (RSS/Atom取得)

## セットアップ

```bash
# 依存関係インストール
npm install

# 環境変数設定
cp .env.example .env

# データベース初期化
npm run db:init

# デモデータ投入
npm run db:seed

# 開発サーバー起動
npm run dev
```

ブラウザで http://localhost:3000 を開く。

## 定期取得（RSS Fetch）

```bash
# 手動実行
npm run fetch

# API経由（サーバー起動中）
curl -X POST http://localhost:3000/api/fetch
```

本番環境では cron や Vercel Cron Jobs で定期実行を推奨（15分〜1時間間隔）。

## 環境変数

| 変数 | 必須 | 説明 |
|------|------|------|
| `DATABASE_URL` | Yes | SQLiteファイルパス（例: `file:./dev.db`） |
| `OPENAI_API_KEY` | No | OpenAI APIキー（設定するとAI要約が有効化） |

## ディレクトリ構成

```
├── prisma/
│   └── schema.prisma          # Prismaスキーマ
├── scripts/
│   ├── init-db.ts              # DB初期化
│   ├── seed.ts                 # デモデータ投入
│   ├── fetch.ts                # RSS取得スクリプト
│   └── db.ts                   # スクリプト用Prismaヘルパー
├── src/
│   ├── app/
│   │   ├── page.tsx            # カレンダーダッシュボード
│   │   ├── date/[date]/page.tsx # 日付詳細
│   │   ├── search/page.tsx     # 検索
│   │   └── api/                # APIルート
│   ├── config/
│   │   └── ministries.json     # 省庁・RSSソース定義
│   └── lib/
│       ├── prisma.ts           # Prismaクライアント
│       ├── summary.ts          # 要約生成
│       └── constants.ts        # 定数
└── README.md
```

## RSSソース設定

`src/config/ministries.json` で省庁ごとのRSSフィードURLを定義。
各省庁は複数のソースを持てる（例：プレスリリース、新着情報）。

## 拡張アイデア

### 重要度スコア
- Itemモデルに `importance: Int?` フィールドを追加（スキーマにコメントで準備済み）
- SummaryProviderインターフェースを拡張し、要約生成時にスコアも返す
- カレンダーセルで重要度の高いアイテムをハイライト表示

### 更新差分表示
- Itemモデルに `diffText: String?` フィールドを追加
- 更新検知時に旧内容と新内容のdiffを保存
- 日付詳細ページで「更新」バッジクリック時にdiffを表示

### 通知機能
- Itemモデルに `notified: Boolean` フィールドを追加
- Webhook / Slack / Email通知プロバイダーインターフェースを定義
- 取得ジョブの最後に未通知アイテムを送信

### iCal購読
- `/api/ical` エンドポイントを追加
- 省庁フィルタ付きのiCalフィード（.ics）を生成
- カレンダーアプリ（Google Calendar等）から購読可能に

### HTMLスクレイピングフォールバック
- `Source.type = "scrape"` の場合にjsdom + @mozilla/readabilityで処理
- 省庁の新着一覧ページのHTML構造に合わせたパーサーを実装
