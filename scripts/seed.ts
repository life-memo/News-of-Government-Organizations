/**
 * デモ用シードデータ投入スクリプト
 * npx tsx scripts/seed.ts
 */

import { getScriptPrisma } from "./db.js";
import { createHash } from "crypto";

function generateHash(title: string, url: string, publishedAt: string): string {
  return createHash("sha256")
    .update(`${title}||${url}||${publishedAt}`)
    .digest("hex");
}

const SEED_DATA = [
  // === 2026-02-14 (今日) ===
  { ministry: "経済産業省", sourceName: "ニュースリリース", title: "「DX投資促進税制」の適用期限延長について", url: "https://www.meti.go.jp/press/2025/02/20260214001/20260214001.html", publishedAt: "2026-02-14T01:00:00Z", summaryRaw: "DX投資促進税制の適用期限を2年間延長する方針を公表しました。" },
  { ministry: "経済産業省", sourceName: "新着情報", title: "令和8年度「ものづくり補助金」の公募開始について", url: "https://www.meti.go.jp/press/2025/02/20260214002/20260214002.html", publishedAt: "2026-02-14T02:00:00Z", summaryRaw: "中小企業の設備投資を支援するものづくり補助金の新たな公募を開始します。" },
  { ministry: "国土交通省", sourceName: "報道発表", title: "自動運転車の公道走行に関する新ガイドライン策定", url: "https://www.mlit.go.jp/report/press/jidosha07_hh_000001_00001.html", publishedAt: "2026-02-14T00:30:00Z", summaryRaw: "レベル4自動運転車の公道走行に関する安全基準ガイドラインを策定。" },
  { ministry: "国土交通省", sourceName: "報道発表", title: "令和8年1月の建設工事受注動態統計（速報値）", url: "https://www.mlit.go.jp/report/press/joho04_hh_000001_00006.html", publishedAt: "2026-02-14T05:00:00Z", summaryRaw: "1月の建設工事受注額は前年同月比4.1%増。公共工事が堅調。" },
  { ministry: "厚生労働省", sourceName: "新着情報", title: "インフルエンザの発生状況について（第7週）", url: "https://www.mhlw.go.jp/stf/newpage_00010.html", publishedAt: "2026-02-14T05:00:00Z", summaryRaw: "令和8年第7週のインフルエンザ定点当たり報告数は前週比減少。" },
  { ministry: "厚生労働省", sourceName: "新着情報", title: "「働き方改革推進支援助成金」の拡充について", url: "https://www.mhlw.go.jp/stf/newpage_00011.html", publishedAt: "2026-02-14T03:00:00Z", summaryRaw: "中小企業の働き方改革を支援する助成金制度を拡充しました。" },
  { ministry: "外務省", sourceName: "新着情報", title: "日EU首脳電話会談について", url: "https://www.mofa.go.jp/mofaj/ecm/ec/pageit_000001_00003.html", publishedAt: "2026-02-14T09:00:00Z", summaryRaw: "日EU首脳が電話会談を実施し、経済安全保障やグリーン・アライアンスについて協議。" },
  { ministry: "防衛省", sourceName: "新着情報", title: "令和8年度 自衛隊統合演習の実施について", url: "https://www.mod.go.jp/j/press/news/2026/02/14a.html", publishedAt: "2026-02-14T01:30:00Z", summaryRaw: "陸海空自衛隊の統合演習を実施。サイバー防衛能力の強化を確認。" },
  { ministry: "総務省", sourceName: "報道資料", title: "「デジタル田園都市国家構想」推進交付金の採択結果", url: "https://www.soumu.go.jp/menu_news/s-news/01ryutsu06_02000001_00003.html", publishedAt: "2026-02-14T02:30:00Z", summaryRaw: "デジタル田園都市国家構想推進交付金の令和8年度第1次採択結果を公表。" },
  { ministry: "文部科学省", sourceName: "新着情報", title: "大学発スタートアップ創出支援事業の採択結果", url: "https://www.mext.go.jp/b_menu/houdou/2026/02/1413004_00001.htm", publishedAt: "2026-02-14T06:00:00Z", summaryRaw: "大学発スタートアップ創出支援事業の令和8年度採択結果を公表。15大学を採択。" },
  { ministry: "農林水産省", sourceName: "報道発表", title: "食品ロス削減推進法に基づく基本方針の改定", url: "https://www.maff.go.jp/j/press/shokuhin/recycle/260214.html", publishedAt: "2026-02-14T01:00:00Z", summaryRaw: "食品ロス削減推進法に基づく基本方針を改定。2030年度目標の達成に向けた施策を強化。" },
  { ministry: "内閣府", sourceName: "新着情報", title: "経済財政諮問会議（令和8年第3回）議事要旨", url: "https://www.cao.go.jp/keizai3/shimon/2026/0214shimon/main.html", publishedAt: "2026-02-14T07:00:00Z", summaryRaw: "経済財政諮問会議の議事要旨を公表。2026年度経済見通しについて議論。" },
  { ministry: "法務省", sourceName: "新着情報", title: "技能実習制度に代わる「育成就労制度」の施行準備状況", url: "https://www.moj.go.jp/isa/publications/press/07_00002.html", publishedAt: "2026-02-14T00:00:00Z", summaryRaw: "育成就労制度の施行に向けた準備状況と今後のスケジュールを公表。" },

  // === 2026-02-13 ===
  { ministry: "経済産業省", sourceName: "ニュースリリース", title: "「AI事業者ガイドライン」の改定案に関する意見公募の結果について", url: "https://www.meti.go.jp/press/2025/02/20260213001/20260213001.html", publishedAt: "2026-02-13T10:00:00Z", summaryRaw: "AI事業者ガイドラインの改定案に対するパブリックコメントの結果を公表しました。" },
  { ministry: "経済産業省", sourceName: "ニュースリリース", title: "令和6年度補正予算「中小企業等事業再構築促進事業」の公募について", url: "https://www.meti.go.jp/press/2025/02/20260213002/20260213002.html", publishedAt: "2026-02-13T11:00:00Z", summaryRaw: "事業再構築補助金の新たな公募を開始します。" },
  { ministry: "国土交通省", sourceName: "報道発表", title: "令和7年地価公示の概要について", url: "https://www.mlit.go.jp/report/press/tochi_fudousan_kensetsugyo04_hh_000001_00001.html", publishedAt: "2026-02-13T09:30:00Z", summaryRaw: "令和7年1月1日時点の地価公示結果を取りまとめました。全国平均で4年連続の上昇。" },
  { ministry: "厚生労働省", sourceName: "新着情報", title: "新型コロナウイルス感染症の定点報告数について（第6週）", url: "https://www.mhlw.go.jp/stf/newpage_00001.html", publishedAt: "2026-02-13T14:00:00Z", summaryRaw: "令和8年第6週（2月3日～9日）の新型コロナウイルス感染症の定点当たり報告数を公表。" },
  { ministry: "外務省", sourceName: "新着情報", title: "日米首脳電話会談について", url: "https://www.mofa.go.jp/mofaj/na/na1/us/pageit_000001_00001.html", publishedAt: "2026-02-13T18:00:00Z", summaryRaw: "岸田総理大臣はバイデン米国大統領と電話会談を行い、ウクライナ情勢等について意見交換。" },
  { ministry: "防衛省", sourceName: "新着情報", title: "令和8年度防衛白書の公表について", url: "https://www.mod.go.jp/j/press/news/2026/02/13a.html", publishedAt: "2026-02-13T10:30:00Z", summaryRaw: "令和8年版防衛白書を公表しました。周辺の安全保障環境の変化を分析。" },
  { ministry: "総務省", sourceName: "報道資料", title: "「自治体DX推進計画」の改定について", url: "https://www.soumu.go.jp/menu_news/s-news/01gyosei07_02000001_00001.html", publishedAt: "2026-02-13T11:30:00Z", summaryRaw: "自治体のデジタル・トランスフォーメーション推進計画を改定しました。" },
  { ministry: "文部科学省", sourceName: "新着情報", title: "「GIGAスクール構想」の進捗状況について", url: "https://www.mext.go.jp/b_menu/houdou/2026/02/1413001_00001.htm", publishedAt: "2026-02-13T15:00:00Z", summaryRaw: "GIGAスクール構想の進捗と今後の方向性を取りまとめました。" },
  { ministry: "農林水産省", sourceName: "報道発表", title: "令和7年産米の作況指数について", url: "https://www.maff.go.jp/j/press/tokei/seiryu/260213.html", publishedAt: "2026-02-13T10:00:00Z", summaryRaw: "全国の作況指数は「やや良」の103。" },
  { ministry: "内閣府", sourceName: "新着情報", title: "月例経済報告（令和8年2月）", url: "https://www.cao.go.jp/keizai3/getsurei/2026/0213getsurei/main.html", publishedAt: "2026-02-13T16:00:00Z", summaryRaw: "景気は、一部に足踏みもみられるが、緩やかに回復している。" },
  { ministry: "法務省", sourceName: "新着情報", title: "入管法改正に関する説明会の開催について", url: "https://www.moj.go.jp/isa/publications/press/07_00001.html", publishedAt: "2026-02-13T09:00:00Z", summaryRaw: "改正入管法の施行に向けた説明会を全国で開催します。" },
  { ministry: "経済産業省", sourceName: "ニュースリリース", title: "半導体・デジタル産業戦略の改定について", url: "https://www.meti.go.jp/press/2025/02/20260212001/20260212001.html", publishedAt: "2026-02-12T10:00:00Z", summaryRaw: "半導体・デジタル産業戦略を改定し、国内生産基盤強化の方向性を示しました。" },
  { ministry: "国土交通省", sourceName: "報道発表", title: "建設工事受注動態統計調査（令和8年1月分）", url: "https://www.mlit.go.jp/report/press/joho04_hh_000001_00002.html", publishedAt: "2026-02-12T14:00:00Z", summaryRaw: "令和8年1月の建設工事受注額を公表。前年同月比3.2%増。" },
  { ministry: "厚生労働省", sourceName: "新着情報", title: "雇用保険制度の見直しに関する報告書", url: "https://www.mhlw.go.jp/stf/newpage_00002.html", publishedAt: "2026-02-12T11:00:00Z", summaryRaw: "労働政策審議会雇用保険部会における議論の取りまとめを公表。" },
  { ministry: "外務省", sourceName: "新着情報", title: "G7外相会合の結果概要", url: "https://www.mofa.go.jp/mofaj/ecm/ec/pageit_000001_00002.html", publishedAt: "2026-02-12T20:00:00Z", summaryRaw: "G7外相会合がオンラインで開催され、国際情勢について議論。" },
  { ministry: "総務省", sourceName: "報道資料", title: "「携帯電話料金の透明化に関するガイドライン」の改定", url: "https://www.soumu.go.jp/menu_news/s-news/01kiban03_02000001_00002.html", publishedAt: "2026-02-12T10:30:00Z", summaryRaw: "携帯電話料金の透明化を促進するためのガイドラインを改定。" },
  { ministry: "内閣府", sourceName: "新着情報", title: "景気動向指数（令和8年1月分速報）の公表", url: "https://www.cao.go.jp/keizai3/shihyo/2026/0212shihyo/main.html", publishedAt: "2026-02-12T14:00:00Z", summaryRaw: "一致指数は前月比1.2ポイント上昇。基調判断は「改善を示している」。" },
  { ministry: "防衛省", sourceName: "新着情報", title: "日豪防衛相会談について", url: "https://www.mod.go.jp/j/press/news/2026/02/11a.html", publishedAt: "2026-02-11T17:00:00Z", summaryRaw: "木原防衛大臣はオーストラリアのマールズ副首相兼国防大臣と会談。" },
  { ministry: "農林水産省", sourceName: "報道発表", title: "「みどりの食料システム戦略」の進捗報告", url: "https://www.maff.go.jp/j/press/kanbo/kankyo/260211.html", publishedAt: "2026-02-11T10:00:00Z", summaryRaw: "みどりの食料システム戦略に基づく各種施策の進捗状況を報告。" },
  { ministry: "文部科学省", sourceName: "新着情報", title: "科学技術・学術審議会の議事録公開", url: "https://www.mext.go.jp/b_menu/shingi/gijyutu/gijyutu0/001/gijiroku/1413002_00001.htm", publishedAt: "2026-02-11T09:00:00Z", summaryRaw: "科学技術・学術審議会の最新の議事録を公開しました。" },
  { ministry: "法務省", sourceName: "新着情報", title: "法制審議会家族法制部会の議事概要", url: "https://www.moj.go.jp/shingi1/housei02_003001_00001.html", publishedAt: "2026-02-11T10:00:00Z", summaryRaw: "法制審議会家族法制部会第30回会議の議事概要を公表。" },
  { ministry: "経済産業省", sourceName: "新着情報", title: "中小企業白書・小規模企業白書の概要公表", url: "https://www.meti.go.jp/press/2025/02/20260211001/20260211001.html", publishedAt: "2026-02-11T11:00:00Z", summaryRaw: "2026年版中小企業白書・小規模企業白書の概要を公表。" },
  { ministry: "厚生労働省", sourceName: "新着情報", title: "毎月勤労統計調査（令和8年1月分結果速報）", url: "https://www.mhlw.go.jp/toukei/itiran/roudou/monthly/r08/2601p/dl/pdf2601p.html", publishedAt: "2026-02-10T09:00:00Z", summaryRaw: "実質賃金は前年同月比0.8%増。名目賃金は2.3%増。" },
  { ministry: "国土交通省", sourceName: "報道発表", title: "訪日外国人旅行者数（令和8年1月推計値）", url: "https://www.mlit.go.jp/kankocho/news02_000001_00003.html", publishedAt: "2026-02-10T16:00:00Z", summaryRaw: "1月の訪日外客数は380万人（推計値）で過去最高を更新。" },
  { ministry: "総務省", sourceName: "報道資料", title: "家計調査報告（令和8年1月分）", url: "https://www.soumu.go.jp/menu_news/s-news/01toukei07_01000001_00003.html", publishedAt: "2026-02-10T08:30:00Z", summaryRaw: "二人以上の世帯の消費支出は実質前年同月比1.5%増。" },
  { ministry: "外務省", sourceName: "新着情報", title: "ODA白書2026の公表", url: "https://www.mofa.go.jp/mofaj/gaiko/oda/shiryo/hakusho/2026/index.html", publishedAt: "2026-02-10T14:00:00Z", summaryRaw: "2026年版ODA白書を公表。重点分野と実績を総括。" },
  { ministry: "内閣府", sourceName: "新着情報", title: "GDP速報（令和7年10-12月期・2次速報）", url: "https://www.cao.go.jp/keizai3/sokuhou/2026/0210sokuhou/main.html", publishedAt: "2026-02-10T08:50:00Z", summaryRaw: "実質GDP成長率は前期比年率+2.1%（2次速報）。" },
  { ministry: "経済産業省", sourceName: "ニュースリリース", title: "エネルギー基本計画の見直しに向けた中間整理", url: "https://www.meti.go.jp/press/2025/02/20260207001/20260207001.html", publishedAt: "2026-02-07T10:00:00Z", summaryRaw: "エネルギー基本計画見直しの中間整理を公表。再エネ・原子力のバランスを検討。" },
  { ministry: "防衛省", sourceName: "新着情報", title: "北朝鮮による弾道ミサイルの発射について", url: "https://www.mod.go.jp/j/press/news/2026/02/07a.html", publishedAt: "2026-02-07T08:00:00Z", summaryRaw: "北朝鮮が弾道ミサイルを発射。我が国のEEZ外に落下したと推定。" },
  { ministry: "農林水産省", sourceName: "報道発表", title: "食料・農業・農村基本計画の見直し状況", url: "https://www.maff.go.jp/j/press/kanbo/anpo/260207.html", publishedAt: "2026-02-07T11:00:00Z", summaryRaw: "食料・農業・農村基本計画の見直しに関する検討状況を報告。" },
  { ministry: "文部科学省", sourceName: "新着情報", title: "令和8年度大学入学共通テストの結果概要", url: "https://www.mext.go.jp/b_menu/houdou/2026/02/1413003_00001.htm", publishedAt: "2026-02-07T15:00:00Z", summaryRaw: "令和8年度大学入学共通テストの受験者数・平均点等を公表。" },
  { ministry: "法務省", sourceName: "新着情報", title: "「法務省デジタル・ガバメント実行計画」の更新", url: "https://www.moj.go.jp/hisho/jouhou/hisho09_00001_00001.html", publishedAt: "2026-02-05T10:00:00Z", summaryRaw: "法務省のデジタル・ガバメント実行計画を更新しました。" },
  { ministry: "厚生労働省", sourceName: "新着情報", title: "介護報酬改定の告示について", url: "https://www.mhlw.go.jp/stf/newpage_00005.html", publishedAt: "2026-02-05T14:00:00Z", summaryRaw: "令和8年度介護報酬改定に関する告示を公布。" },
  { ministry: "内閣府", sourceName: "新着情報", title: "消費者物価指数に関する特別報告", url: "https://www.cao.go.jp/keizai3/cpi/2026/0203report/main.html", publishedAt: "2026-02-03T10:00:00Z", summaryRaw: "消費者物価の動向と今後の見通しについて特別報告を公表。" },
  { ministry: "国土交通省", sourceName: "報道発表", title: "住宅着工統計（令和8年1月分）", url: "https://www.mlit.go.jp/report/press/joho04_hh_000001_00005.html", publishedAt: "2026-02-03T14:00:00Z", summaryRaw: "令和8年1月の新設住宅着工戸数は前年同月比2.1%増。" },
  { ministry: "総務省", sourceName: "報道資料", title: "完全失業率（令和8年1月分）", url: "https://www.soumu.go.jp/menu_news/s-news/01toukei04_01000001_00003.html", publishedAt: "2026-02-03T08:30:00Z", summaryRaw: "令和8年1月の完全失業率は2.4%。前月比0.1ポイント低下。" },
];

async function main() {
  const prisma = await getScriptPrisma();

  console.log("=== シードデータ投入開始 ===");

  await prisma.dailySummary.deleteMany();
  await prisma.item.deleteMany();
  console.log("既存データクリア完了");

  let count = 0;
  for (const data of SEED_DATA) {
    const hash = generateHash(data.title, data.url, data.publishedAt);
    await prisma.item.create({
      data: {
        ministry: data.ministry,
        sourceName: data.sourceName,
        title: data.title,
        url: data.url,
        publishedAt: new Date(data.publishedAt),
        summaryRaw: data.summaryRaw,
        hash,
        dateEstimated: false,
      },
    });
    count++;
  }

  console.log(`${count}件 のシードデータを投入しました`);
  console.log("=== 完了 ===");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("エラー:", e);
  process.exit(1);
});
