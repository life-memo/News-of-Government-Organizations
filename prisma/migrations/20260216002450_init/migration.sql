-- CreateTable
CREATE TABLE "items" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministry" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "published_at" DATETIME NOT NULL,
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary_raw" TEXT,
    "content_text" TEXT,
    "hash" TEXT NOT NULL,
    "updated_flag" BOOLEAN NOT NULL DEFAULT false,
    "date_estimated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "sources" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministry" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'rss',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "last_fetched_at" DATETIME,
    "last_error" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "daily_summaries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "ministry" TEXT,
    "summary" TEXT NOT NULL,
    "item_count" INTEGER NOT NULL,
    "items_hash" TEXT NOT NULL,
    "generated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "fetch_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ministry" TEXT NOT NULL,
    "source_name" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "item_count" INTEGER,
    "error" TEXT,
    "duration" INTEGER,
    "fetched_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "items_hash_key" ON "items"("hash");

-- CreateIndex
CREATE INDEX "items_ministry_idx" ON "items"("ministry");

-- CreateIndex
CREATE INDEX "items_published_at_idx" ON "items"("published_at");

-- CreateIndex
CREATE INDEX "items_ministry_published_at_idx" ON "items"("ministry", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "sources_ministry_name_key" ON "sources"("ministry", "name");

-- CreateIndex
CREATE INDEX "daily_summaries_date_idx" ON "daily_summaries"("date");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_date_ministry_key" ON "daily_summaries"("date", "ministry");

-- CreateIndex
CREATE INDEX "fetch_logs_fetched_at_idx" ON "fetch_logs"("fetched_at");
