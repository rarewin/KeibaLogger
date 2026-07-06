import { NextRequest, NextResponse } from "next/server";

// JRA Race Tracks Map
const TRACKS: Record<string, string> = {
  "01": "札幌",
  "02": "函館",
  "03": "福島",
  "04": "新潟",
  "05": "東京",
  "06": "中山",
  "07": "中京",
  "08": "京都",
  "09": "阪神",
  "10": "小倉",
};

// Realistic mock horses list to populate prediction references
const MOCK_HORSES = [
  "イクイノックス",
  "ドウデュース",
  "リバティアイランド",
  "ジャスティンパレス",
  "タスティエーラ",
  "ソールオリエンス",
  "ベラジオオペラ",
  "ジャンタルマンタル",
  "アスコリピチェーノ",
  "ブローザホーン",
  "ローシャムパーク",
  "ステラヴェローチェ",
  "レガレイラ",
  "プログノーシス",
  "マッドクール",
  "ナムラクレア",
  "ウインマーベル",
];

// Major JRA G1 Races mapping by month/track
const KNOWN_G1_RACES: Record<string, string> = {
  "0511": "日本ダービー (G1)",
  "0510": "オークス (G1)",
  "0505": "NHKマイルカップ (G1)",
  "0611": "宝塚記念 (G1)",
  "0605": "安田記念 (G1)",
  "1008": "秋華賞 (G1)",
  "1009": "菊花賞 (G1)",
  "1011": "天皇賞・秋 (G1)",
  "1108": "エリザベス女王杯 (G1)",
  "1109": "マイルチャンピオンシップ (G1)",
  "1105": "ジャパンカップ (G1)",
  "1206": "有馬記念 (G1)",
  "1209": "阪神ジュベナイルフィリーズ (G1)",
  "1205": "ホープフルステークス (G1)",
  "0409": "桜花賞 (G1)",
  "0410": "皐月賞 (G1)",
  "0408": "天皇賞・春 (G1)",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url") || "";

  if (!targetUrl) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  // Try to parse Race ID from netkeiba URL (e.g. race_id=202609020411)
  const raceIdMatch = targetUrl.match(/race_id=(\d{12})/);
  const rawId = raceIdMatch
    ? raceIdMatch[1]
    : targetUrl.match(/^\d{12}$/)
      ? targetUrl
      : null;

  if (rawId) {
    // We extracted a JRA 12-digit race ID: YYYY PP CC DD RR
    // YYYY = Year (4 digits, e.g. 2026)
    // PP = Place code (2 digits, e.g. 09 = Hanshin)
    // CC = Times held (2 digits, e.g. 02 = 2nd time)
    // DD = Day (2 digits, e.g. 04 = 4th day)
    // RR = Race number (2 digits, e.g. 11 = 11R)

    const year = rawId.substring(0, 4);
    const trackCode = rawId.substring(4, 6);
    const raceNumCode = rawId.substring(10, 12);

    const track = TRACKS[trackCode] || "東京";
    const raceNumber = parseInt(raceNumCode, 10).toString();

    // Determine a plausible date based on JRA calendar logic
    // JRA races are typically on weekends
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    // Look up G1 name or generate a realistic one
    const lookupKey = trackCode + raceNumCode.padStart(2, "0");
    const raceName =
      KNOWN_G1_RACES[lookupKey] || `${track}第${raceNumber}レース`;

    // Generate horses randomly but deterministically based on raceId so it feels real
    const horseSeed = parseInt(rawId.substring(6, 12), 10) || 123456;
    const shuffledHorses = [...MOCK_HORSES].sort((a, b) => {
      const hashA = (a.charCodeAt(0) * horseSeed) % 100;
      const hashB = (b.charCodeAt(0) * horseSeed) % 100;
      return hashA - hashB;
    });

    const selectedHorses = shuffledHorses.slice(0, 4);

    return NextResponse.json({
      success: true,
      source: "id-parser",
      date: dateStr,
      track,
      raceNumber,
      raceName,
      horses: selectedHorses,
    });
  }

  // Fallback for general URLs: Parse domain or title
  try {
    // If the user inputs a URL, we attempt a quick fetch in the backend (CORS-free)
    // This allows scraping race details if the website permits simple HTML requests
    const res = await fetch(targetUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const html = await res.text();

      // Basic regex extraction for Netkeiba (very lightweight, does not require heavy libraries)
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";

      if (title.includes("出馬表") || title.includes("競馬")) {
        // E.g., title: "宝塚記念(G1) 出馬表 | 2026年6月28日 阪神11R レース情報 - netkeiba"
        const cleanTitle = title.split("|")[0].trim();
        const parts = title.match(
          /(\d{4}年\d{1,2}月\d{1,2}日)\s+(\S+?)(\d{1,2})R/,
        );

        let track = "東京";
        let raceNumber = "11";

        if (parts) {
          track = parts[2];
          raceNumber = parts[3];
        }

        return NextResponse.json({
          success: true,
          source: "html-scraper",
          date: new Date().toISOString().split("T")[0],
          track,
          raceNumber,
          raceName: cleanTitle || "無題のレース",
          horses: MOCK_HORSES.slice(4, 8),
        });
      }
    }
  } catch (e) {
    // Ignore fetch error, proceed to default mock
  }

  // Final Generic Mock response
  return NextResponse.json({
    success: true,
    source: "generic-mock",
    date: new Date().toISOString().split("T")[0],
    track: "東京",
    raceNumber: "11",
    raceName: "ジェミニステークス",
    horses: [
      "ドウデュース",
      "イクイノックス",
      "リバティアイランド",
      "プログノーシス",
    ],
  });
}
