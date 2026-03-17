#!/usr/bin/env node
/**
 * RSS取得スクリプト (Node.js版) - Vercelビルド / GitHub Actions用
 *
 * 各省庁のRSSフィードを取得し public/data/items.json へマージ保存する。
 * Python不要。Node.js >=18 の fetch API を使用。
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, "..");

const MINISTRIES_PATH = join(PROJECT_ROOT, "src/config/ministries.json");
const OUTPUT_DIR = join(PROJECT_ROOT, "public/data");
const OUTPUT_FILE = join(OUTPUT_DIR, "items.json");

/* ─── helpers ─── */

function md5(str) {
  return createHash("md5").update(str, "utf-8").digest("hex");
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function cleanText(raw) {
  let t = raw.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  t = decodeEntities(t);
  t = t.replace(/<[^>]*>/g, "");
  return t.trim();
}

function resolveUrl(href, base) {
  try {
    return new URL(decodeEntities(href.trim()), base).toString();
  } catch {
    return null;
  }
}

/** 日付文字列 → ISO string。パース不可なら null */
function parseDate(raw) {
  if (!raw) return null;
  const s = raw.trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString();
  // ISO 8601 の +0900 形式
  const d2 = new Date(s.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  if (!isNaN(d2.getTime())) return d2.toISOString();
  return null;
}

/* ─── fetch with timeout & retry ─── */

async function fetchText(url, forcedEncoding = null, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
        },
        signal: AbortSignal.timeout(15_000),
        redirect: "follow",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();

      // 1. Use forced encoding from source config if provided
      if (forcedEncoding) {
        try {
          return new TextDecoder(forcedEncoding).decode(buf);
        } catch {
          // fall through to auto-detection
        }
      }

      // 2. Check HTTP Content-Type header for charset
      const ct = res.headers.get("content-type") || "";
      const ctMatch = ct.match(/charset\s*=\s*([^\s;]+)/i);
      if (ctMatch) {
        const ctEnc = ctMatch[1].toLowerCase().replace(/^["']|["']$/g, "");
        if (ctEnc !== "utf-8" && ctEnc !== "utf8") {
          try {
            return new TextDecoder(ctEnc).decode(buf);
          } catch { /* fall through */ }
        }
      }

      // 3. Detect encoding from XML declaration (<?xml ... encoding="Shift_JIS"?>)
      const head = new TextDecoder("latin1").decode(new Uint8Array(buf).slice(0, 512));
      const encMatch = head.match(/encoding\s*=\s*["']([^"']+)["']/i);
      if (encMatch) {
        const declaredEnc = encMatch[1].toLowerCase();
        if (declaredEnc !== "utf-8" && declaredEnc !== "utf8") {
          try {
            return new TextDecoder(declaredEnc).decode(buf);
          } catch { /* fall through */ }
        }
      }

      // 4. Default: UTF-8
      return new TextDecoder("utf-8").decode(buf);
    } catch (e) {
      if (i === retries) {
        console.error(`  FAIL ${url}: ${e.message}`);
        return null;
      }
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  return null;
}

/* ─── RSS/Atom parsing ─── */

function parseItems(xml) {
  const items = [];

  // RSS 1.0 (RDF) の <channel> と <image> ブロックを除去してから解析
  // （チャンネル画像が <item> と誤認識されるのを防ぐ）
  const stripped = xml
    .replace(/<channel[\s>][\s\S]*?<\/channel>/gi, "")
    .replace(/<image[\s>][\s\S]*?<\/image>/gi, "");

  // RSS <item>
  for (const m of stripped.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi)) {
    const it = parseEntry(m[1], "rss");
    if (it) items.push(it);
  }

  // Atom <entry>
  if (items.length === 0) {
    for (const m of stripped.matchAll(/<entry[^>]*>([\s\S]*?)<\/entry>/gi)) {
      const it = parseEntry(m[1], "atom");
      if (it) items.push(it);
    }
  }

  // RDF <item> (older format)
  if (items.length === 0) {
    for (const m of stripped.matchAll(/<item\s[^>]*>([\s\S]*?)<\/item>/gi)) {
      const it = parseEntry(m[1], "rss");
      if (it) items.push(it);
    }
  }

  return items;
}

function parseEntry(block, type) {
  const titleM = block.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleM) return null;
  const title = cleanText(titleM[1]);
  if (!title) return null;

  let link = null;
  if (type === "atom") {
    const m = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i);
    if (m) link = decodeEntities(m[1].trim());
  } else {
    const m = block.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
    if (m) link = cleanText(m[1]);
  }
  if (!link) return null;

  // date
  const dateCandidates = [
    /<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i,
    /<dc:date[^>]*>([\s\S]*?)<\/dc:date>/i,
    /<published[^>]*>([\s\S]*?)<\/published>/i,
    /<updated[^>]*>([\s\S]*?)<\/updated>/i,
  ];
  let published_at = null;
  let date_estimated = true;
  for (const re of dateCandidates) {
    const dm = block.match(re);
    if (dm) {
      const parsed = parseDate(dm[1].trim());
      if (parsed) {
        published_at = parsed;
        date_estimated = false;
        break;
      }
    }
  }
  if (!published_at) {
    published_at = new Date().toISOString();
    date_estimated = true;
  }

  return { title, url: link, published_at, date_estimated };
}

/* ─── RSS discovery (HTML → feed links) ─── */

function discoverFeedUrls(html, baseUrl) {
  const urls = new Set();

  // <link rel="alternate" type="application/rss+xml" href="...">
  for (const m of html.matchAll(/<link[^>]+>/gi)) {
    const tag = m[0];
    if (!/rel\s*=\s*["']alternate["']/i.test(tag)) continue;
    if (
      !/type\s*=\s*["']application\/(rss|atom)\+xml["']/i.test(tag) &&
      !/type\s*=\s*["']text\/xml["']/i.test(tag)
    )
      continue;
    const hrefM = tag.match(/href\s*=\s*["']([^"']+)["']/i);
    if (hrefM) {
      const resolved = resolveUrl(hrefM[1], baseUrl);
      if (resolved) urls.add(resolved);
    }
  }

  // <a href="...rdf|xml|atom">
  for (const m of html.matchAll(/<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const href = m[1];
    if (/\.(rdf|xml|atom)(\?|#|$)/i.test(href)) {
      const resolved = resolveUrl(href, baseUrl);
      if (resolved) urls.add(resolved);
    }
  }

  return [...urls];
}

/* ─── main ─── */

async function main() {
  console.log("=".repeat(60));
  console.log("RSS Feed Fetcher (Node.js)");
  console.log("=".repeat(60));

  const ministries = JSON.parse(readFileSync(MINISTRIES_PATH, "utf-8"));
  console.log(`\nLoaded ${ministries.length} ministries`);

  // 既存データ読み込み
  let existing = {};
  if (existsSync(OUTPUT_FILE)) {
    try {
      const arr = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));
      for (const item of arr) {
        if (item.id) existing[item.id] = item;
      }
    } catch {}
  }
  console.log(`Existing items: ${Object.keys(existing).length}`);

  const fetched = {};
  const now = new Date().toISOString();

  for (const ministry of ministries) {
    const name = ministry.ministry;
    const siteUrl = ministry.siteUrl || "";
    console.log(`\n${name}`);
    console.log("-".repeat(40));

    for (const source of ministry.sources) {
      const { name: srcName, url: srcUrl, type: srcType = "rss", encoding: srcEncoding = null } = source;
      console.log(`  [${srcName}] Fetching... (${srcType}${srcEncoding ? ", " + srcEncoding : ""})`);

      let items = [];

      if (srcType === "rss-discovery") {
        const html = await fetchText(srcUrl, srcEncoding);
        if (html) {
          const feedUrls = discoverFeedUrls(html, siteUrl);
          console.log(`  [${srcName}] Discovered ${feedUrls.length} feed(s)`);
          for (const feedUrl of feedUrls) {
            const xml = await fetchText(feedUrl, srcEncoding);
            if (xml) {
              const parsed = parseItems(xml);
              console.log(`    ${feedUrl} → ${parsed.length} items`);
              items.push(...parsed);
            }
          }
        }
      } else {
        const xml = await fetchText(srcUrl, srcEncoding);
        if (xml) items = parseItems(xml);
      }

      console.log(`  [${srcName}] Found ${items.length} items`);

      for (const item of items) {
        item.url = resolveUrl(item.url, siteUrl) || item.url;

        // ホームページ直リンク・画像URLはゴミアイテムとしてスキップ
        try {
          const u = new URL(item.url);
          if (u.pathname === "/" || u.pathname === "") continue;
          if (/\.(gif|jpg|jpeg|png|svg|webp|ico)(\?|#|$)/i.test(u.pathname)) continue;
        } catch { continue; }

        // URL のみで重複排除（タイトルが変化しても同一記事として扱い、再取得で上書き可能にする）
        const hash = md5(item.url);
        if (fetched[hash]) continue;
        fetched[hash] = {
          ...item,
          id: hash,
          ministry: name,
          source_name: srcName,
          fetched_at: now,
        };
      }
    }
  }

  // merge（90日以上前のアイテムは除外）
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString();

  const merged = { ...existing, ...fetched };

  // URL-based deduplication: keep the most recently fetched item per URL
  // This handles the case where old items have md5(title+url) IDs and new ones have md5(url) IDs
  const byUrl = new Map();
  for (const item of Object.values(merged)) {
    const url = item.url;
    const existing_for_url = byUrl.get(url);
    if (!existing_for_url || (item.fetched_at || "") >= (existing_for_url.fetched_at || "")) {
      byUrl.set(url, item);
    }
  }

  const all = Array.from(byUrl.values())
    .filter((item) => !item.date_estimated && (item.published_at || "") >= cutoffStr)
    .sort(
      (a, b) => (b.published_at || "").localeCompare(a.published_at || ""),
    );

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_FILE, JSON.stringify(all, null, 2), "utf-8");

  console.log("\n" + "=".repeat(60));
  console.log(`New items fetched : ${Object.keys(fetched).length}`);
  console.log(`Total items saved : ${all.length}`);
  console.log(`Output: ${OUTPUT_FILE}`);
  console.log("=".repeat(60));

  // summary
  const counts = {};
  for (const item of all) {
    const m = item.ministry || "unknown";
    counts[m] = (counts[m] || 0) + 1;
  }
  console.log("\nSummary by ministry:");
  for (const [m, c] of Object.entries(counts).sort()) {
    console.log(`  ${m}: ${c} items`);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  // ビルドを失敗させない（既存のitems.jsonでフォールバック）
  process.exit(0);
});
