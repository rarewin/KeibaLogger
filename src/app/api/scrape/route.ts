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

// Modern JRA Sprinters Mock Pool
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

// Modern JRA Middle/Long Distance Mock Pool
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

interface HorseDetail {
  waku: number;
  umaban: number;
  horseName: string;
}

// Helper: Scrape horse names with Waku and Umaban details
function extractHorsesWithDetails(html: string): HorseDetail[] {
  const list: HorseDetail[] = [];
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];

  for (const trMatch of trMatches) {
    const row = trMatch[1];

    // 1. Try shutuba.html parsing style (Waku1-8, Umaban)
    const wakuMatch = row.match(/class=["']Waku(\d+)[^"']*["']/i);
    const umabanMatch = row.match(
      /class=["']Umaban[^"']*["'][^>]*>[\s\S]*?(\d+)/i,
    );
    const horseMatch = row.match(
      /class=["']HorseName["'][^>]*><a[^>]*title=["']([^"']+)["']/i,
    );

    if (wakuMatch && umabanMatch && horseMatch) {
      list.push({
        waku: parseInt(wakuMatch[1], 10),
        umaban: parseInt(umabanMatch[1], 10),
        horseName: horseMatch[1].trim(),
      });
      continue;
    }

    // 2. Try result.html parsing style (Waku1-8 class, Num Txt_C, Horse_Name)
    const wakuResultMatch = row.match(/class=["']Num Waku(\d+)[^"']*["']/i);
    const numResultMatch = row.match(
      /class=["']Num Txt_C["'][^>]*>[\s\S]*?(\d+)/i,
    );
    const horseResultMatch = row.match(
      /class=["']Horse_Name["'][\s\S]*?title=["']([^"']+)["']/i,
    );

    if (wakuResultMatch && numResultMatch && horseResultMatch) {
      list.push({
        waku: parseInt(wakuResultMatch[1], 10),
        umaban: parseInt(numResultMatch[1], 10),
        horseName: horseResultMatch[1].trim(),
      });
    }
  }

  // Deduplicate by horse number and sort ascending
  const uniqueMap = new Map<number, HorseDetail>();
  for (const item of list) {
    uniqueMap.set(item.umaban, item);
  }
  return Array.from(uniqueMap.values()).sort((a, b) => a.umaban - b.umaban);
}

// Helper: Scrape title tag from HTML
function extractTitle(html: string): string {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  return titleMatch ? titleMatch[1].trim() : "";
}

// Helper: Scrape dividends and payouts table
function extractPayouts(
  html: string,
): Record<string, { selection: string; amount: number }[]> {
  const payoutMap: Record<string, any[]> = {};
  const ticketTypes = [
    { key: "単勝", className: "Tansho", chunkSize: 1 },
    { key: "複勝", className: "Fukusho", chunkSize: 1 },
    { key: "枠連", className: "Wakuren", chunkSize: 2 },
    { key: "馬連", className: "Umaren", chunkSize: 2 },
    { key: "馬単", className: "Umatan", chunkSize: 2 },
    { key: "ワイド", className: "Wide", chunkSize: 2 },
    { key: "3連複", className: "Sanrenpuku", chunkSize: 3 },
    { key: "3連単", className: "Sanrentan", chunkSize: 3 },
  ];

  for (const type of ticketTypes) {
    const trRegex = new RegExp(
      `<tr class=["']${type.className}["']>([\\s\\S]*?)<\/tr>`,
      "i",
    );
    const trMatch = html.match(trRegex);
    if (trMatch) {
      const block = trMatch[1];
      const resultMatch = block.match(
        /<td class=["']Result["']>([\s\S]*?)<\/td>/i,
      );
      const payoutMatch = block.match(
        /<td class=["']Payout["']>([\s\S]*?)<\/td>/i,
      );

      if (resultMatch && payoutMatch) {
        // Strip tags and split horse numbers into rows
        const rawResultText = resultMatch[1]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/div>/gi, "\n")
          .replace(/<[^>]+>/g, "")
          .trim();

        const rawSelections = rawResultText
          .split("\n")
          .map((x) => x.trim())
          .filter(Boolean);

        // Group selections (e.g. Exacta horse numbers combined into 1 selection like "6-15")
        const selections = [];
        for (let i = 0; i < rawSelections.length; i += type.chunkSize) {
          const chunk = rawSelections.slice(i, i + type.chunkSize);
          selections.push(chunk.join("-"));
        }

        // Parse payouts (split on linebreaks inside span/br)
        const rawPayoutText = payoutMatch[1].replace(/<[^>]+>/g, "\n");
        const amounts = rawPayoutText
          .split("\n")
          .map((x) => x.trim().replace(/,/g, "").replace("円", ""))
          .filter(Boolean);

        payoutMap[type.key] = selections.map((sel, idx) => ({
          selection: sel,
          amount: parseInt(amounts[idx], 10) || 0,
        }));
      }
    }
  }
  return payoutMap;
}

// Helper: Scrape finishing order results (Ranks 1 to 5)
function extractResults(
  html: string,
): { rank: number; horseNumber: string; horseName: string }[] {
  const results: { rank: number; horseNumber: string; horseName: string }[] =
    [];
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];

  for (const trMatch of trMatches) {
    const row = trMatch[1];
    const rankMatch = row.match(/class=["']Rank["'][^>]*>[\s\S]*?(\d+)/i);

    if (rankMatch) {
      const rank = parseInt(rankMatch[1], 10);

      // Only extract top 5 positions
      if (rank >= 1 && rank <= 5) {
        const numMatch = row.match(
          /class=["']Num Txt_C["'][^>]*>[\s\S]*?(\d+)/i,
        );
        const horseMatch = row.match(
          /class=["']Horse_Name["'][\s\S]*?title=["']([^"']+)["']/i,
        );

        if (numMatch && horseMatch) {
          results.push({
            rank,
            horseNumber: numMatch[1].trim(),
            horseName: horseMatch[1].trim(),
          });
        }
      }
    }
  }
  return results.sort((a, b) => a.rank - b.rank);
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url") || "";

  if (!target) {
    return NextResponse.json(
      { error: "URL or ID is required" },
      { status: 400 },
    );
  }

  const raceIdMatch = target.match(/race_id=(\d{12})/);
  const raceId = raceIdMatch
    ? raceIdMatch[1]
    : target.match(/^\d{12}$/)
      ? target
      : null;

  // Default to fetching result page first to check if race is finished and get payouts
  let fetchUrl = target;
  let isResultFetch = false;
  if (raceId) {
    fetchUrl = `https://race.netkeiba.com/race/result.html?race_id=${raceId}`;
    isResultFetch = true;
  }

  let scrapedData: {
    success: boolean;
    source: string;
    date: string;
    track: string;
    raceNumber: string;
    raceName: string;
    horses: HorseDetail[];
    payouts?: Record<string, { selection: string; amount: number }[]>;
    results?: { rank: number; horseNumber: string; horseName: string }[];
  } | null = null;

  try {
    const fetchOptions = {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(6000),
    };

    let res = await fetch(fetchUrl, fetchOptions);
    let html = "";
    if (res.ok) {
      html = await res.text();
    }

    let horses = extractHorsesWithDetails(html);
    let title = extractTitle(html);
    let payouts: Record<string, { selection: string; amount: number }[]> = {};
    let resultsList: {
      rank: number;
      horseNumber: string;
      horseName: string;
    }[] = [];

    // If result page failed to return horses (e.g. race not yet held, page doesn't exist), fallback to entries page
    if (horses.length === 0 && isResultFetch && raceId) {
      isResultFetch = false;
      fetchUrl = `https://race.netkeiba.com/race/shutuba.html?race_id=${raceId}`;
      const retryRes = await fetch(fetchUrl, fetchOptions);
      if (retryRes.ok) {
        const retryHtml = await retryRes.text();
        horses = extractHorsesWithDetails(retryHtml);
        title = extractTitle(retryHtml);
      }
    } else if (isResultFetch && html) {
      payouts = extractPayouts(html);
      resultsList = extractResults(html);
    }

    if (
      title &&
      (title.includes("出馬表") ||
        title.includes("結果") ||
        title.includes("レース"))
    ) {
      const raceName = title
        .split("|")[0]
        .replace("出馬表", "")
        .replace("結果", "")
        .trim();
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
          source: isResultFetch
            ? "scraped-netkeiba-result"
            : "scraped-netkeiba-entries",
          date: new Date().toISOString().split("T")[0],
          track,
          raceNumber,
          raceName,
          horses,
          payouts: Object.keys(payouts).length > 0 ? payouts : undefined,
          results: resultsList.length > 0 ? resultsList : undefined,
        };
      }
    }
  } catch (e) {
    console.warn("Real-time scraping failed, falling back to mock:", e);
  }

  if (scrapedData) {
    return NextResponse.json(scrapedData);
  }

  // Smart Fallback Mock Generator
  if (raceId) {
    const trackCode = raceId.substring(4, 6);
    const raceNumCode = raceId.substring(10, 12);

    const track = TRACKS[trackCode] || "東京";
    const raceNumber = parseInt(raceNumCode, 10).toString();
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    const isSprint =
      (trackCode === "10" && raceNumber === "11") ||
      (trackCode === "04" && raceNumber === "11") ||
      (trackCode === "02" && raceNumber === "11");

    const pool = isSprint ? MOCK_SPRINTERS : MOCK_MID_LONG;

    const seed = parseInt(raceId.substring(6, 12), 10) || 123456;
    const shuffledHorses = [...pool].sort((a, b) => {
      const hashA = (a.charCodeAt(0) * seed) % 100;
      const hashB = (b.charCodeAt(0) * seed) % 100;
      return hashA - hashB;
    });

    const selectedHorses = shuffledHorses.slice(0, 8);
    const mockHorsesWithDetails = selectedHorses.map((name, index) => {
      const umaban = index + 1;
      const waku = umaban <= 8 ? umaban : Math.min(8, Math.ceil(umaban / 2));
      return {
        waku,
        umaban,
        horseName: name,
      };
    });

    let raceName = `${track}第${raceNumber}レース`;
    if (raceNumber === "11") {
      const candidates = MAIN_RACES_BY_TRACK[trackCode];
      if (candidates && candidates.length > 0) {
        const seedVal = parseInt(raceId.substring(6, 10), 10) || 0;
        const idx = (seedVal + 1) % candidates.length;
        raceName = candidates[idx];
      }
    }

    const mockResults = [
      {
        rank: 1,
        horseNumber: "1",
        horseName: selectedHorses[0] || "ドウデュース",
      },
      {
        rank: 2,
        horseNumber: "2",
        horseName: selectedHorses[1] || "イクイノックス",
      },
      {
        rank: 3,
        horseNumber: "3",
        horseName: selectedHorses[2] || "リバティアイランド",
      },
    ];

    return NextResponse.json({
      success: true,
      source: "id-parser-mock",
      date: dateStr,
      track,
      raceNumber,
      raceName,
      horses: mockHorsesWithDetails,
      results: mockResults,
    });
  }

  return NextResponse.json({
    success: true,
    source: "generic-mock",
    date: new Date().toISOString().split("T")[0],
    track: "東京",
    raceNumber: "11",
    raceName: "ジェミニステークス",
    horses: [
      { waku: 1, umaban: 1, horseName: "ドウデュース" },
      { waku: 2, umaban: 2, horseName: "イクイノックス" },
      { waku: 3, umaban: 3, horseName: "リバティアイランド" },
      { waku: 4, umaban: 4, horseName: "プログノーシス" },
    ],
  });
}
