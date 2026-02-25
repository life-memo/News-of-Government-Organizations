#!/usr/bin/env python3
"""
RSS取得スクリプト - GitHub Actions用

省庁のRSSフィードを取得し、JSONファイルとして保存します。
既存データとマージして履歴を保持します。
"""

import json
import urllib.request
import re
import html
from datetime import datetime, timezone
from pathlib import Path
from email.utils import parsedate_to_datetime
import hashlib

# プロジェクトルート
PROJECT_ROOT = Path(__file__).parent.parent

# 設定ファイルを読み込み
MINISTRIES_PATH = PROJECT_ROOT / "src/config/ministries.json"
OUTPUT_DIR = PROJECT_ROOT / "public/data"
OUTPUT_FILE = OUTPUT_DIR / "items.json"


def fetch_url(url: str) -> str | None:
    """URLのコンテンツを取得する"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response:
            raw_bytes = response.read()
            for encoding in ['utf-8', 'shift_jis', 'euc-jp', 'iso-2022-jp']:
                try:
                    return raw_bytes.decode(encoding)
                except Exception:
                    continue
            return raw_bytes.decode('utf-8', errors='ignore')
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return None


def discover_feed_urls(html_text: str, base_url: str) -> list[str]:
    """HTMLページからRSS/Atomフィードのリンクを探す"""
    urls = []
    seen = set()

    # <link rel="alternate" type="application/rss+xml" ...>
    link_re = re.compile(r'<link[^>]+>', re.IGNORECASE)
    for tag in link_re.findall(html_text):
        if not re.search(r'rel\s*=\s*["\']alternate["\']', tag, re.IGNORECASE):
            continue
        if not re.search(
            r'type\s*=\s*["\']application/(rss|atom)\+xml["\']', tag, re.IGNORECASE
        ):
            continue
        m = re.search(r'href\s*=\s*["\']([^"\']+)["\']', tag, re.IGNORECASE)
        if m:
            url = normalize_url(m.group(1), base_url)
            if url and url not in seen:
                seen.add(url)
                urls.append(url)

    # <a href="...rdf|...xml|...atom">
    anchor_re = re.compile(r'<a[^>]+href\s*=\s*["\']([^"\']+)["\'][^>]*>', re.IGNORECASE)
    for m in anchor_re.finditer(html_text):
        href = m.group(1)
        if re.search(r'\.(rdf|xml|atom)(\?|$)', href, re.IGNORECASE):
            url = normalize_url(href, base_url)
            if url and url not in seen:
                seen.add(url)
                urls.append(url)

    return urls


def normalize_url(url: str, base_url: str) -> str | None:
    """相対URLを絶対URLに変換する"""
    url = html.unescape(url).strip()
    if not url:
        return None
    if url.startswith('http://') or url.startswith('https://'):
        return url
    # 相対URL処理
    if url.startswith('//'):
        scheme = base_url.split('://')[0] if '://' in base_url else 'https'
        return f"{scheme}:{url}"
    if url.startswith('/'):
        m = re.match(r'(https?://[^/]+)', base_url)
        if m:
            return m.group(1) + url
        return None
    # 相対パス
    base = re.sub(r'/[^/]*$', '/', base_url)
    return base + url


def fetch_rss(url: str) -> list[dict]:
    """RSSフィードを取得してパースする"""
    text = fetch_url(url)
    if text is None:
        return []

    items = []

    # RSS形式
    for match in re.finditer(r'<item[^>]*>(.*?)</item>', text, re.DOTALL):
        item = parse_item(match.group(1), 'rss')
        if item:
            items.append(item)

    # Atom形式
    if not items:
        for match in re.finditer(r'<entry[^>]*>(.*?)</entry>', text, re.DOTALL):
            item = parse_item(match.group(1), 'atom')
            if item:
                items.append(item)

    return items


def fetch_rss_discovery(discovery_url: str, site_url: str) -> list[dict]:
    """HTMLページからRSSフィードURLを発見して取得する"""
    print(f"  Discovering feeds from: {discovery_url}")
    html_text = fetch_url(discovery_url)
    if html_text is None:
        return []

    feed_urls = discover_feed_urls(html_text, site_url)
    print(f"  Found {len(feed_urls)} feed(s): {feed_urls}")

    all_items = []
    for feed_url in feed_urls:
        items = fetch_rss(feed_url)
        print(f"    [{feed_url}] {len(items)} items")
        all_items.extend(items)

    return all_items


def parse_item(item_xml: str, feed_type: str) -> dict | None:
    """アイテムXMLをパースする"""
    try:
        # タイトル
        title_match = re.search(r'<title[^>]*>(.*?)</title>', item_xml, re.DOTALL)
        if not title_match:
            return None
        title = clean_text(title_match.group(1))
        if not title:
            return None

        # リンク
        if feed_type == 'atom':
            link_match = re.search(r'<link[^>]*href=["\']([^"\']+)["\']', item_xml)
        else:
            link_match = re.search(r'<link[^>]*>(.*?)</link>', item_xml, re.DOTALL)

        if not link_match:
            return None
        link = clean_text(link_match.group(1))
        if not link:
            return None

        # 日付
        date_patterns = [
            r'<pubDate[^>]*>(.*?)</pubDate>',
            r'<dc:date[^>]*>(.*?)</dc:date>',
            r'<published[^>]*>(.*?)</published>',
            r'<updated[^>]*>(.*?)</updated>',
        ]

        published_at = None
        date_estimated = True

        for pattern in date_patterns:
            date_match = re.search(pattern, item_xml, re.DOTALL)
            if date_match:
                date_str = date_match.group(1).strip()
                try:
                    published_at = parsedate_to_datetime(date_str).isoformat()
                    date_estimated = False
                    break
                except Exception:
                    try:
                        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        published_at = dt.isoformat()
                        date_estimated = False
                        break
                    except Exception:
                        continue

        # 日付が取得できない場合は現在時刻
        if not published_at:
            published_at = datetime.now(timezone.utc).isoformat()
            date_estimated = True

        return {
            'title': title,
            'url': link,
            'published_at': published_at,
            'date_estimated': date_estimated,
        }

    except Exception as e:
        print(f"  Error parsing item: {e}")
        return None


def clean_text(text: str) -> str:
    """テキストをクリーンアップ"""
    text = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', text, flags=re.DOTALL)
    text = html.unescape(text)
    text = text.strip()
    return text


def make_item_hash(title: str, url: str) -> str:
    return hashlib.md5(f"{title}{url}".encode('utf-8')).hexdigest()


def load_existing_items() -> dict[str, dict]:
    """既存のitems.jsonを読み込む（id → item の辞書）"""
    if not OUTPUT_FILE.exists():
        return {}
    try:
        with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
            items = json.load(f)
        return {item['id']: item for item in items if 'id' in item}
    except Exception as e:
        print(f"Warning: could not load existing items: {e}")
        return {}


def main():
    """メイン処理"""
    print("=" * 60)
    print("RSS Feed Fetcher")
    print("=" * 60)

    # 設定ファイルを読み込み
    with open(MINISTRIES_PATH, 'r', encoding='utf-8') as f:
        ministries = json.load(f)

    print(f"\nLoaded {len(ministries)} ministries")

    # 既存データをロード（マージ用）
    existing_items = load_existing_items()
    print(f"Existing items: {len(existing_items)}")

    # 新規フェッチしたアイテムを格納
    new_items: dict[str, dict] = {}
    fetched_at = datetime.now(timezone.utc).isoformat()

    # 各省庁のRSSを取得
    for ministry in ministries:
        ministry_name = ministry['ministry']
        site_url = ministry.get('siteUrl', '')
        print(f"\n{ministry_name}")
        print("-" * 40)

        for source in ministry['sources']:
            source_name = source['name']
            source_url = source['url']
            source_type = source.get('type', 'rss')

            print(f"  [{source_name}] Fetching... ({source_type})")

            if source_type == 'rss-discovery':
                items = fetch_rss_discovery(source_url, site_url)
            else:
                items = fetch_rss(source_url)

            print(f"  [{source_name}] Found {len(items)} items")

            for item in items:
                item['url'] = html.unescape(item['url']).strip()
                item_hash = make_item_hash(item['title'], item['url'])

                if item_hash in new_items:
                    continue

                item['id'] = item_hash
                item['ministry'] = ministry_name
                item['source_name'] = source_name
                item['fetched_at'] = fetched_at
                new_items[item_hash] = item

    # 既存データとマージ（既存を保持しつつ新規で上書き）
    merged: dict[str, dict] = {**existing_items, **new_items}

    all_items = sorted(
        merged.values(),
        key=lambda x: x.get('published_at', ''),
        reverse=True,
    )

    # JSONファイルに保存
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_items, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 60)
    print(f"New items fetched : {len(new_items)}")
    print(f"Total items saved : {len(all_items)}")
    print(f"Output: {OUTPUT_FILE}")
    print("=" * 60)

    # サマリー
    print("\nSummary by ministry:")
    ministry_counts: dict[str, int] = {}
    for item in all_items:
        m = item.get('ministry', 'unknown')
        ministry_counts[m] = ministry_counts.get(m, 0) + 1
    for m, count in sorted(ministry_counts.items()):
        print(f"  {m}: {count} items")


if __name__ == '__main__':
    main()
