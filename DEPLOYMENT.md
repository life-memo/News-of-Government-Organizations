# Vercelデプロイメントガイド

## 重要な注意事項

このアプリケーションは **SQLite (better-sqlite3)** を使用しているため、Vercelのサーバーレス環境では**そのままデプロイできません**。

Vercelでデプロイする場合は、以下のいずれかの方法を選択してください。

---

## オプション1: Turso（推奨）

[Turso](https://turso.tech/) は libSQL（SQLiteフォーク）のマネージドサービスで、Vercelと相性が良いです。

### 手順

1. **Tursoアカウント作成**
   ```bash
   # Turso CLIインストール
   curl -sSfL https://get.tur.so/install.sh | bash
   
   # ログイン
   turso auth login
   
   # データベース作成
   turso db create gov-news-db
   
   # 接続情報取得
   turso db show gov-news-db
   ```

2. **Prismaスキーマ更新**
   
   `prisma/schema.prisma` を以下のように変更:
   ```prisma
   datasource db {
     provider = "sqlite"
     url      = env("DATABASE_URL")
   }
   
   generator client {
     provider = "prisma-client-js"
     previewFeatures = ["driverAdapters"]
   }
   ```

3. **依存関係追加**
   ```bash
   pnpm add @libsql/client
   ```

4. **Prismaクライアント更新**
   
   `src/lib/prisma.ts` を以下のように変更:
   ```typescript
   import { PrismaClient } from "@prisma/client";
   import { PrismaLibSQL } from "@prisma/adapter-libsql";
   import { createClient } from "@libsql/client";
   
   const libsql = createClient({
     url: process.env.DATABASE_URL!,
     authToken: process.env.DATABASE_AUTH_TOKEN,
   });
   
   const adapter = new PrismaLibSQL(libsql);
   export const prisma = new PrismaClient({ adapter });
   ```

5. **Vercel環境変数設定**
   - `DATABASE_URL`: Tursoの接続URL（例: `libsql://your-db.turso.io`）
   - `DATABASE_AUTH_TOKEN`: Tursoの認証トークン

6. **マイグレーション実行**
   ```bash
   # ローカルでマイグレーション生成
   npx prisma migrate dev --name init
   
   # Tursoにマイグレーション適用
   turso db shell gov-news-db < prisma/migrations/*/migration.sql
   ```

---

## オプション2: Vercel Postgres

Vercelが提供するPostgreSQLサービスを使用する方法です。

### 手順

1. **Vercel Postgresセットアップ**
   - Vercelダッシュボードで Storage → Create Database → Postgres を選択
   - 環境変数が自動的に設定されます

2. **Prismaスキーマ更新**
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

3. **スキーマ調整**
   - SQLiteとPostgreSQLでは型が異なるため、スキーマを調整
   - `DATETIME` → `TIMESTAMP`
   - `BOOLEAN` → `BOOLEAN`（そのまま）
   - `TEXT` → `TEXT`（そのまま）

4. **マイグレーション実行**
   ```bash
   npx prisma migrate dev --name init
   ```

---

## オプション3: ローカル開発のみ

Vercelにデプロイせず、ローカル環境またはVPS（Hetzner、DigitalOceanなど）でホスティングする方法です。

### 手順

1. **VPSセットアップ**
   - Ubuntu 22.04 LTSなどをインストール
   - Node.js 22.x をインストール

2. **アプリケーションデプロイ**
   ```bash
   git clone <repository>
   cd News-of-Government-Organizations
   pnpm install
   pnpm run db:init
   pnpm run db:seed
   pnpm run build
   pnpm start
   ```

3. **Nginx リバースプロキシ設定**
   ```nginx
   server {
     listen 80;
     server_name your-domain.com;
     
     location / {
       proxy_pass http://localhost:3000;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection 'upgrade';
       proxy_set_header Host $host;
       proxy_cache_bypass $http_upgrade;
     }
   }
   ```

4. **PM2でプロセス管理**
   ```bash
   npm install -g pm2
   pm2 start pnpm --name "gov-news" -- start
   pm2 startup
   pm2 save
   ```

---

## 現在のビルド設定

### package.json
```json
{
  "scripts": {
    "build": "next build",
    "db:init": "tsx scripts/init-db.ts",
    "db:seed": "tsx scripts/seed.ts"
  }
}
```

**重要**: `build` スクリプトから `init-db` と `seed` を削除しました。これらはローカル環境でのみ実行してください。

### .vercelignore
以下のファイルはVercelにアップロードされません:
- `prisma/*.db`
- `scripts/init-db.ts`
- `scripts/seed.ts`
- `scripts/fetch.ts`
- `scripts/backfill.ts`

---

## RSS取得の自動化

### Vercel Cron Jobs（Turso使用時のみ）

1. **vercel.json に追加**
   ```json
   {
     "crons": [
       {
         "path": "/api/fetch",
         "schedule": "0 * * * *"
       }
     ]
   }
   ```

2. **APIルート作成**
   
   `src/app/api/fetch/route.ts` を作成:
   ```typescript
   import { NextResponse } from "next/server";
   import { headers } from "next/headers";
   
   export async function POST() {
     // Vercel Cronからのリクエストか確認
     const headersList = await headers();
     const authHeader = headersList.get("authorization");
     
     if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
     }
     
     // RSS取得処理を実行
     // ...
     
     return NextResponse.json({ success: true });
   }
   ```

3. **環境変数設定**
   - `CRON_SECRET`: ランダムな文字列

### 外部Cron（VPS使用時）

```bash
# crontab -e
0 * * * * cd /path/to/app && pnpm run fetch >> /var/log/gov-news-fetch.log 2>&1
```

---

## トラブルシューティング

### ビルドエラー: "Could not locate the bindings file"

**原因**: better-sqlite3 のネイティブモジュールがビルドされていない

**解決策**: 
- Turso または Vercel Postgres に移行
- または VPS でホスティング

### データベースが空

**原因**: Vercel環境ではデータベースファイルが永続化されない

**解決策**:
- Turso または Vercel Postgres を使用
- RSS取得を定期実行してデータを蓄積

---

## 推奨デプロイメント

**本番環境**: Vercel + Turso + Vercel Cron Jobs
- フロントエンド: Vercel（無料プラン可）
- データベース: Turso（無料プラン: 500MB、月間10億行読み取り）
- RSS取得: Vercel Cron Jobs（1時間ごと）

**開発環境**: ローカル + SQLite
- `pnpm dev` で開発
- `pnpm run fetch` で手動RSS取得
