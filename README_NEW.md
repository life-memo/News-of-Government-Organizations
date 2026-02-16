# 省庁新着ダッシュボード

日本の省庁が発表する新着情報を一覧表示するダッシュボードアプリケーション。

## 特徴

- **完全無料**: GitHub Actions + Vercel/GitHub Pagesで運用
- **データベース不要**: JSONファイルベースのシンプルな設計
- **自動更新**: GitHub Actionsで定期的にRSSフィードを取得
- **レスポンシブデザイン**: PC・スマートフォン対応

## アーキテクチャ

```
GitHub Actions (定期実行)
  ↓
RSSフィードを取得 (Python)
  ↓
JSONファイルに保存 (public/data/items.json)
  ↓
GitHubリポジトリにコミット
  ↓
Vercel/GitHub Pagesが自動デプロイ
  ↓
Next.jsアプリがJSONを読み込んで表示
```

## セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/life-memo/News-of-Government-Organizations.git
cd News-of-Government-Organizations
```

### 2. 依存関係をインストール

```bash
npm install
# または
pnpm install
```

### 3. RSS取得を実行

```bash
npm run fetch
# または
pnpm fetch
```

### 4. 開発サーバーを起動

```bash
npm run dev
# または
pnpm dev
```

ブラウザで http://localhost:3000 を開く

## デプロイ

### Vercel（推奨）

1. Vercelアカウントにログイン
2. リポジトリをインポート
3. 自動デプロイされる

### GitHub Pages

1. リポジトリ設定 → Pages
2. Source: GitHub Actions
3. `.github/workflows/deploy.yml` を作成（Next.js静的エクスポート用）

## GitHub Actions

### RSS取得ワークフロー

`.github/workflows/fetch-rss.yml`

- **実行頻度**: 毎日 JST 6:00, 12:00, 18:00
- **手動実行**: GitHub Actions画面から実行可能
- **処理内容**:
  1. Pythonスクリプトで各省庁のRSSフィードを取得
  2. JSONファイルに保存
  3. GitHubにコミット・プッシュ
  4. Vercelが自動的に再デプロイ

### 手動実行方法

1. GitHubリポジトリページを開く
2. "Actions" タブをクリック
3. "Fetch RSS Feeds" ワークフローを選択
4. "Run workflow" ボタンをクリック

## 対応省庁

現在、以下の省庁のRSSフィードに対応しています:

1. 内閣府
2. 法務省
3. 経済産業省
4. 国土交通省
5. 防衛省
6. 外務省
7. 総務省
8. 厚生労働省
9. 文部科学省（RSS Discovery - 未実装）
10. 農林水産省（RSS Discovery - 未実装）

## 省庁の追加方法

`src/config/ministries.json` に新しい省庁を追加:

```json
{
  "key": "MOF",
  "ministry": "財務省",
  "short": "財務",
  "color": "#10b981",
  "siteUrl": "https://www.mof.go.jp",
  "sources": [
    { 
      "name": "新着", 
      "url": "https://www.mof.go.jp/rss.xml", 
      "type": "rss" 
    }
  ]
}
```

## 技術スタック

- **フロントエンド**: Next.js 15 + React 19 + TypeScript
- **スタイリング**: Tailwind CSS
- **RSS取得**: Python 3
- **CI/CD**: GitHub Actions
- **ホスティング**: Vercel / GitHub Pages

## ライセンス

MIT License

## 貢献

プルリクエストを歓迎します！
