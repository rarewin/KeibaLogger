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

// Modern JRA Sprinters Mock Pool (For 1000m - 1400m races)
const MOCK_SPRINTERS = [
  "ナムラクレア",
  "マッドクール",
  "トウシンマカオ",
  "ママコチャ",
  "ウインマーベル",
  "ルガル",
  "ピューロマジック",
  "サトノレーヴ",
  "ビッグシーザー",
  "アサカラキング",
  "ジャスティンミラノ",
  "エイシンスポッター",
  "モズメイメイ",
];

// Modern JRA Middle/Long Distance Mock Pool (For 1600m+ races)
const MOCK_MID_LONG = [
  "ドウデュース",
  "ジャスティンパレス",
  "ベラジオオペラ",
  "ブローザホーン",
  "ソールオリエンス",
  "タスティエーラ",
  "レガレイラ",
  "ローシャムパーク",
  "ステラヴェローチェ",
  "プログノーシス",
  "ダノンデサイル",
  "アスコリピチェーノ",
];

// Major JRA 11R Races by Track Code
const MAIN_RACES_BY_TRACK: Record<string, string[]> = {
  "01": [
    "札幌記念 (G2)",
    "クイーンステークス (G3)",
    "エルムステークス (G3)",
    "キーンランドカップ (G3)",
  ],
  "02": [
    "函館記念 (G3)",
    "函館スプリントステークス (G3)",
    "函館2歳ステークス (G3)",
  ],
  "03": [
    "七夕賞 (G3)",
    "ラジオNIKKEI賞 (G3)",
    "福島記念 (G3)",
    "福島牝馬ステークス (G3)",
  ],
  "04": ["新潟記念 (G3)", "関屋記念 (G3)", "アイビスサマーダッシュ (G3)"],
  "05": [
    "日本ダービー (G1)",
    "ジャパンカップ (G1)",
    "天皇賞・秋 (G1)",
    "安田記念 (G1)",
    "オークス (G1)",
    "NHKマイルカップ (G1)",
    "フェブラリーステークス (G1)",
    "ヴィクトリアマイル (G1)",
  ],
  "06": [
    "有馬記念 (G1)",
    "皐月賞 (G1)",
    "スプリンターズステークス (G1)",
    "ホープフルステークス (G1)",
    "中山記念 (G2)",
  ],
  "07": [
    "高松宮記念 (G1)",
    "チャンピオンズカップ (G1)",
    "金鯱賞 (G2)",
    "プロキオンステークス (G3)",
    "中京記念 (G3)",
  ],
  "08": [
    "天皇賞・春 (G1)",
    "菊花賞 (G1)",
    "秋華賞 (G1)",
    "エリザベス女王杯 (G1)",
    "マイルチャンピオンシップ (G1)",
  ],
  "09": [
    "宝塚記念 (G1)",
    "桜花賞 (G1)",
    "阪神ジュベナイルフィリーズ (G1)",
    "朝日杯フューチュリティステークス (G1)",
    "大阪杯 (G1)",
  ],
  "10": ["小倉記念 (G3)", "北九州記念 (G3)", "小倉2歳ステークス (G3)"],
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url") || "";

  if (!target) {
    return NextResponse.json(
      { error: "URL or ID is required" },
      { status: 400 },
    );
  }

  // 1. Determine JRA 12-digit race ID
  const raceIdMatch = target.match(/race_id=(\d{12})/);
  const raceId = raceIdMatch
    ? raceIdMatch[1]
    : target.match(/^\d{12}$/)
      ? target
      : null;

  // 2. Formulate URL to scrape
  let fetchUrl = target;
  if (raceId) {
    fetchUrl = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`;
  }

  let scrapedData: {
    success: boolean;
    source: string;
    date: string;
    track: string;
    raceNumber: string;
    raceName: string;
    horses: string[];
  } | null = null;

  // 3. Try real HTML Scraping (CORS-free on Next.js server side)
  try {
    const res = await fetch(fetchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(6000), // 6 seconds timeout
    });

    if (res.ok) {
      const html = await res.text();

      // Scrape Title Tag
      const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "";

      // Scrape Horse Names from standard netkeiba HTML markup
      // Pattern 1: class="HorseName" (Standard race page) extracting from title attribute
      const horseMatches = [
        ...html.matchAll(
          /class=["']HorseName["'][^>]*><a[^>]*title=["']([^"']+)["']/g,
        ),
      ];
      let horses = Array.from(new Set(horseMatches.map((m) => m[1].trim())));

      // Pattern 2: Fallback to general database horse profile links extracting from title attribute
      if (horses.length === 0) {
        const altMatches = [
          ...html.matchAll(
            /href=["'][^"']*db\.netkeiba\.com\/horse\/\d+\/?[^"']*["'][^>]*title=["']([^"']+)["']/g,
          ),
        ];
        horses = Array.from(new Set(altMatches.map((m) => m[1].trim())));
      }

      // Filter out meta values or table header texts
      horses = horses.filter(
        (h) => h && h.length > 1 && !h.includes("<") && h !== "馬名",
      );

      if (
        title &&
        (title.includes("出馬表") ||
          title.includes("結果") ||
          title.includes("レース"))
      ) {
        // Extract pure race name by removing trailing website info
        const raceName = title
          .split("|")[0]
          .replace("出馬表", "")
          .replace("結果", "")
          .trim();

        // Extract track and race number
        let track = "東京";
        let raceNumber = "11";
        const metaMatch = title.match(
          /(\d{4}年\d{1,2}月\d{1,2}日)\s+(\S+?)(\d{1,2})R/,
        );

        if (metaMatch) {
          track = metaMatch[2];
          raceNumber = metaMatch[3];
        } else if (raceId) {
          const trackCode = raceId.substring(4, 6);
          track = TRACKS[trackCode] || "東京";
          raceNumber = parseInt(raceId.substring(10, 12), 10).toString();
        }

        if (horses.length > 0) {
          scrapedData = {
            success: true,
            source: "scraped-netkeiba",
            date: new Date().toISOString().split("T")[0],
            track,
            raceNumber,
            raceName,
            horses: horses.slice(0, 18), // return full field (up to 18 horses)
          };
        }
      }
    }
  } catch (e) {
    console.warn(
      "Real-time scraping failed, falling back to smart mock generator:",
      e,
    );
  }

  // 4. If scraping succeeded, return it immediately
  if (scrapedData) {
    return NextResponse.json(scrapedData);
  }

  // 5. Smart Generative Fallback Mock (If offline or blocked)
  if (raceId) {
    const trackCode = raceId.substring(4, 6);
    const raceNumCode = raceId.substring(10, 12);

    const track = TRACKS[trackCode] || "東京";
    const raceNumber = parseInt(raceNumCode, 10).toString();
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    // Determine if this is a sprint race (usually <= 1400m)
    // Kokura 11R (Kitakyushu Kinen, etc.) and Niigata 11R (Ibis Summer Dash, etc.) are heavily sprints.
    const isSprint =
      (trackCode === "10" && raceNumber === "11") ||
      (trackCode === "04" && raceNumber === "11") ||
      (trackCode === "02" && raceNumber === "11");

    const pool = isSprint ? MOCK_SPRINTERS : MOCK_MID_LONG;

    // Generate deterministic shuffled horse names based on race ID seed
    const seed = parseInt(raceId.substring(6, 12), 10) || 123456;
    const shuffledHorses = [...pool].sort((a, b) => {
      const hashA = (a.charCodeAt(0) * seed) % 100;
      const hashB = (b.charCodeAt(0) * seed) % 100;
      return hashA - hashB;
    });

    const selectedHorses = shuffledHorses.slice(0, 8);

    // Determine race name deterministically from track main races
    let raceName = `${track}第${raceNumber}レース`;
    if (raceNumber === "11") {
      const candidates = MAIN_RACES_BY_TRACK[trackCode];
      if (candidates && candidates.length > 0) {
        const seedVal = parseInt(raceId.substring(6, 10), 10) || 0; // CC DD
        const idx = (seedVal + 1) % candidates.length;
        raceName = candidates[idx];
      }
    }

    return NextResponse.json({
      success: true,
      source: "id-parser-mock",
      date: dateStr,
      track,
      raceNumber,
      raceName,
      horses: selectedHorses,
    });
  }

  // Default Mock Response (General fallback)
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
