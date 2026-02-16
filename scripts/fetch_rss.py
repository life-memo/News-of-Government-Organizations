#!/usr/bin/env python3
"""
RSS取得スクリプト - GitHub Actions用

省庁のRSSフィードを取得し、JSONファイルとして保存します。
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

def fetch_rss(url: str) -> list[dict]:
    """RSSフィードを取得してパースする"""
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as response:
            rss_bytes = response.read()
            
            # エンコーディングを試行
            for encoding in ['utf-8', 'shift_jis', 'euc-jp', 'iso-2022-jp']:
                try:
                    rss_text = rss_bytes.decode(encoding)
                    break
                except:
                    continue
            else:
                rss_text = rss_bytes.decode('utf-8', errors='ignore')
        
        # アイテムを抽出（RSS/Atom両対応）
        items = []
        
        # RSS形式
        for match in re.finditer(r'<item[^>]*>(.*?)</item>', rss_text, re.DOTALL):
            item_xml = match.group(1)
            item = parse_item(item_xml, 'rss')
            if item:
                items.append(item)
        
        # Atom形式
        if not items:
            for match in re.finditer(r'<entry[^>]*>(.*?)</entry>', rss_text, re.DOTALL):
                item_xml = match.group(1)
                item = parse_item(item_xml, 'atom')
                if item:
                    items.append(item)
        
        return items
    
    except Exception as e:
        print(f"  Error fetching {url}: {e}")
        return []

def parse_item(item_xml: str, feed_type: str) -> dict | None:
    """アイテムXMLをパースする"""
    try:
        # タイトル
        title_match = re.search(r'<title[^>]*>(.*?)</title>', item_xml, re.DOTALL)
        if not title_match:
            return None
        title = clean_text(title_match.group(1))
        
        # リンク
        if feed_type == 'atom':
            link_match = re.search(r'<link[^>]*href=["\']([^"\']+)["\']', item_xml)
        else:
            link_match = re.search(r'<link[^>]*>(.*?)</link>', item_xml, re.DOTALL)
        
        if not link_match:
            return None
        link = clean_text(link_match.group(1))
        
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
                except:
                    try:
                        # ISO 8601形式も試す
                        dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                        published_at = dt.isoformat()
                        date_estimated = False
                        break
                    except:
                        continue
        
        # 日付が取得できない場合は現在時刻
        if not published_at:
            published_at = datetime.now(timezone.utc).isoformat()
            date_estimated = True
        
        return {
            'title': title,
            'url': link,
            'published_at': published_at,
            'date_estimated': date_estimated
        }
    
    except Exception as e:
        print(f"  Error parsing item: {e}")
        return None

def clean_text(text: str) -> str:
    """テキストをクリーンアップ"""
    # CDATA除去
    text = re.sub(r'<!\[CDATA\[(.*?)\]\]>', r'\1', text, flags=re.DOTALL)
    # HTMLエンティティをデコード
    text = html.unescape(text)
    # 前後の空白を削除
    text = text.strip()
    return text

def normalize_url(url: str) -> str:
    """URLを正規化"""
    # HTMLエンティティをデコード
    url = html.unescape(url)
    # 前後の空白を削除
    url = url.strip()
    return url

def main():
    """メイン処理"""
    print("=" * 60)
    print("RSS Feed Fetcher")
    print("=" * 60)
    
    # 設定ファイルを読み込み
    with open(MINISTRIES_PATH, 'r', encoding='utf-8') as f:
        ministries = json.load(f)
    
    print(f"\nLoaded {len(ministries)} ministries")
    
    # 全アイテムを格納
    all_items = []
    seen_hashes = set()
    
    # 各省庁のRSSを取得
    for ministry in ministries:
        ministry_name = ministry['ministry']
        print(f"\n{ministry_name}")
        print("-" * 40)
        
        for source in ministry['sources']:
            source_name = source['name']
            source_url = source['url']
            source_type = source.get('type', 'rss')
            
            # rss-discoveryタイプはスキップ（将来的に実装）
            if source_type == 'rss-discovery':
                print(f"  [{source_name}] Skipped (rss-discovery not implemented)")
                continue
            
            print(f"  [{source_name}] Fetching...")
            
            items = fetch_rss(source_url)
            print(f"  [{source_name}] Found {len(items)} items")
            
            # アイテムを処理
            for item in items:
                # URLを正規化
                item['url'] = normalize_url(item['url'])
                
                # ハッシュを生成（重複チェック用）
                item_hash = hashlib.md5(
                    f"{item['title']}{item['url']}".encode('utf-8')
                ).hexdigest()
                
                # 重複チェック
                if item_hash in seen_hashes:
                    continue
                
                seen_hashes.add(item_hash)
                
                # メタデータを追加
                item['id'] = item_hash
                item['ministry'] = ministry_name
                item['source_name'] = source_name
                item['fetched_at'] = datetime.now(timezone.utc).isoformat()
                
                all_items.append(item)
    
    # 日付でソート（新しい順）
    all_items.sort(key=lambda x: x['published_at'], reverse=True)
    
    # JSONファイルに保存
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(all_items, f, ensure_ascii=False, indent=2)
    
    print("\n" + "=" * 60)
    print(f"Total items: {len(all_items)}")
    print(f"Output: {OUTPUT_FILE}")
    print("=" * 60)
    
    # サマリーを表示
    print("\nSummary by ministry:")
    ministry_counts = {}
    for item in all_items:
        ministry = item['ministry']
        ministry_counts[ministry] = ministry_counts.get(ministry, 0) + 1
    
    for ministry, count in sorted(ministry_counts.items()):
        print(f"  {ministry}: {count} items")

if __name__ == '__main__':
    main()
