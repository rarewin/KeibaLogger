import { NextRequest, NextResponse } from "next/server";

// JRA Race Tracks Map
const JRA_TRACKS: Record<string, string> = {
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

// NAR (地方競馬) Race Tracks Map
const NAR_TRACKS: Record<string, string> = {
  "30": "門別",
  "31": "北見",
  "32": "岩見沢",
  "33": "帯広",
  "34": "旭川",
  "35": "盛岡",
  "36": "水沢",
  "37": "上山",
  "38": "三条",
  "39": "足利",
  "40": "宇都宮",
  "41": "高崎",
  "42": "浦和",
  "43": "船橋",
  "44": "大井",
  "45": "川崎",
  "46": "金沢",
  "47": "笠松",
  "48": "名古屋",
  "49": "紀三井寺",
  "50": "園田",
  "51": "姫路",
  "52": "益田",
  "53": "福山",
  "54": "高知",
  "55": "佐賀",
  "56": "荒尾",
  "57": "中津",
  "58": "札幌",
  "59": "函館",
  "60": "新潟",
  "61": "中京",
  "62": "春木",
  "63": "北見",
  "64": "岩見沢",
  "65": "ばんえい帯広",
};

const ALL_TRACKS: Record<string, string> = {
  ...JRA_TRACKS,
  ...NAR_TRACKS,
};

function isNarTarget(target: string, raceId: string | null): boolean {
  if (
    target.includes("nar.netkeiba.com") ||
    target.includes("nar.sp.netkeiba.com")
  ) {
    return true;
  }
  if (raceId) {
    const trackCode = raceId.substring(4, 6);
    if (NAR_TRACKS[trackCode] || parseInt(trackCode, 10) >= 30) {
      return true;
    }
  }
  return false;
}

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
  jockey?: string;
}

// Helper: Scrape horse names with Waku, Umaban and Jockey details
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
    const horseMatch =
      row.match(
        /class=["']Horse_?Name["'][^>]*><a[^>]*title=["']([^"']+)["']/i,
      ) ||
      row.match(
        /class=["']Horse_?Name["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i,
      );
    const jockeyMatch =
      row.match(
        /<td[^>]*class=["']Jockey["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i,
      ) ||
      row.match(/<td[^>]*class=["']Jockey["'][^>]*>([\s\S]*?)<\/td>/i) ||
      row.match(/class=["']Jockey["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
      row.match(/class=["']Jockey["'][^>]*>([\s\S]*?)<\/td>/i);

    let jockey = "";
    if (jockeyMatch) {
      jockey = jockeyMatch[1]
        .replace(/<[^>]+>/g, "")
        .trim()
        .replace(/\s+/g, " ");
    }

    if (wakuMatch && umabanMatch && horseMatch) {
      list.push({
        waku: parseInt(wakuMatch[1], 10),
        umaban: parseInt(umabanMatch[1], 10),
        horseName: horseMatch[1].trim(),
        jockey: jockey || undefined,
      });
      continue;
    }

    // 2. Try result.html parsing style (Waku1-8 class, Num Txt_C / Num Waku, Horse_Name)
    const wakuResultMatch = row.match(
      /class=["'](?:Num\s+)?Waku(\d+)[^"']*["']/i,
    );
    const numResultMatch =
      row.match(
        /class=["']Num(?:\s+Txt_C|\s+Waku)?["'][^>]*>[\s\S]*?(\d+)/i,
      ) ||
      row.match(/class=["']Umaban[^"']*["'][^>]*>[\s\S]*?(\d+)/i);
    const horseResultMatch =
      row.match(
        /class=["']Horse_?Name["'][^>]*><a[^>]*title=["']([^"']+)["']/i,
      ) ||
      row.match(
        /class=["']Horse_?Name["'][\s\S]*?title=["']([^"']+)["']/i,
      ) ||
      row.match(
        /class=["']Horse_?Name["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i,
      );
    const jockeyResultMatch =
      row.match(
        /<td[^>]*class=["']Jockey["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i,
      ) ||
      row.match(/<td[^>]*class=["']Jockey["'][^>]*>([\s\S]*?)<\/td>/i) ||
      row.match(/class=["']Jockey["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i) ||
      row.match(/class=["']Jockey["'][^>]*>([\s\S]*?)<\/td>/i);

    let resultJockey = "";
    if (jockeyResultMatch) {
      resultJockey = jockeyResultMatch[1]
        .replace(/<[^>]+>/g, "")
        .trim()
        .replace(/\s+/g, " ");
    }

    if (wakuResultMatch && numResultMatch && horseResultMatch) {
      list.push({
        waku: parseInt(wakuResultMatch[1], 10),
        umaban: parseInt(numResultMatch[1], 10),
        horseName: horseResultMatch[1].trim(),
        jockey: resultJockey || undefined,
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
    { key: "3連複", className: "(?:Fuku3|Sanrenpuku)", chunkSize: 3 },
    { key: "3連単", className: "(?:Tan3|Sanrentan)", chunkSize: 3 },
  ];

  for (const type of ticketTypes) {
    const trRegex = new RegExp(
      `<tr[^>]*class=["'](?:[^"']*\\s+)?${type.className}(?:\\s+[^"']*)?["'][^>]*>([\\s\\S]*?)<\/tr>`,
      "i",
    );
    const trMatch = html.match(trRegex);
    if (trMatch) {
      const block = trMatch[1];
      const resultMatch = block.match(
        /<td\s+[^>]*class=["']Result["'][^>]*>([\s\S]*?)<\/td>/i,
      );
      const payoutMatch = block.match(
        /<td\s+[^>]*class=["']Payout["'][^>]*>([\s\S]*?)<\/td>/i,
      );

      if (resultMatch && payoutMatch) {
        // Strip tags and split horse numbers into rows
        const rawResultText = resultMatch[1]
          .replace(/<br\s*\/?>/gi, "\n")
          .replace(/<\/div>/gi, "\n")
          .replace(/<\/li>/gi, "\n")
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
): { rank: number; horseNumber: string; horseName: string; jockey?: string }[] {
  const results: {
    rank: number;
    horseNumber: string;
    horseName: string;
    jockey?: string;
  }[] = [];
  const trMatches = [...html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)];

  for (const trMatch of trMatches) {
    const row = trMatch[1];
    const rankMatch =
      row.match(/class=["'](?:Result_Num|Rank)["'][^>]*>[\s\S]*?(\d+)/i) ||
      row.match(/<div class=["']Rank["'][^>]*>[\s\S]*?(\d+)/i);

    if (rankMatch) {
      const rank = parseInt(rankMatch[1], 10);

      // Only extract top 5 positions
      if (rank >= 1 && rank <= 5) {
        const numMatch =
          row.match(
            /class=["']Num(?:\s+Txt_C|\s+Waku)?["'][^>]*>[\s\S]*?(\d+)/i,
          ) ||
          row.match(/class=["']Umaban[^"']*["'][^>]*>[\s\S]*?(\d+)/i);
        const horseMatch =
          row.match(
            /class=["']Horse_?Name["'][\s\S]*?title=["']([^"']+)["']/i,
          ) ||
          row.match(
            /class=["']Horse_?Name["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i,
          );
        const jockeyMatch =
          row.match(
            /<td[^>]*class=["']Jockey["'][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/i,
          ) ||
          row.match(/<td[^>]*class=["']Jockey["'][^>]*>([\s\S]*?)<\/td>/i);

        let jockey = "";
        if (jockeyMatch) {
          jockey = jockeyMatch[1]
            .replace(/<[^>]+>/g, "")
            .trim()
            .replace(/\s+/g, " ");
        }

        if (numMatch && horseMatch) {
          results.push({
            rank,
            horseNumber: numMatch[1].trim(),
            horseName: horseMatch[1].trim(),
            jockey: jockey || undefined,
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

  const raceIdMatch =
    target.match(/race_id=(\d{12})/) || target.match(/\/race\/(\d{12})\b/);
  const raceId = raceIdMatch
    ? raceIdMatch[1]
    : target.match(/^\d{12}$/)
      ? target
      : null;

  const isNar = isNarTarget(target, raceId);
  const domain = isNar
    ? "https://nar.netkeiba.com"
    : "https://race.netkeiba.com";

  // Default to fetching result page first to check if race is finished and get payouts
  let fetchUrl = target;
  let isResultFetch = false;
  if (raceId) {
    fetchUrl = `${domain}/race/result.html?race_id=${raceId}`;
    isResultFetch = true;
  } else if (target.includes("result.html")) {
    isResultFetch = true;
  }

  let scrapedData: {
    success: boolean;
    source: string;
    url: string;
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
      fetchUrl = `${domain}/race/shutuba.html?race_id=${raceId}`;
      const retryRes = await fetch(fetchUrl, fetchOptions);
      if (retryRes.ok) {
        const retryHtml = await retryRes.text();
        horses = extractHorsesWithDetails(retryHtml);
        const retryTitle = extractTitle(retryHtml);
        if (retryTitle) {
          title = retryTitle;
        }
      }
    } else if (isResultFetch && html) {
      payouts = extractPayouts(html);
      resultsList = extractResults(html);
    }

    if (
      title &&
      (title.includes("出馬表") ||
        title.includes("結果") ||
        title.includes("レース") ||
        title.includes("netkeiba"))
    ) {
      const raceName = title
        .split("|")[0]
        .replace("出馬表", "")
        .replace("結果・払戻", "")
        .replace("結果", "")
        .replace("払戻", "")
        .trim();
      let track = isNar ? "大井" : "東京";
      let raceNumber = "11";
      let dateVal = new Date().toISOString().split("T")[0];
      const metaMatch = title.match(
        /(\d{4}年\d{1,2}月\d{1,2}日)\s+(\S+?)(\d{1,2})R/,
      );

      if (metaMatch) {
        track = metaMatch[2];
        raceNumber = metaMatch[3];
        const dateMatch = metaMatch[1].match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (dateMatch) {
          const yyyy = dateMatch[1];
          const mm = dateMatch[2].padStart(2, "0");
          const dd = dateMatch[3].padStart(2, "0");
          dateVal = `${yyyy}-${mm}-${dd}`;
        }
      } else if (raceId) {
        const trackCode = raceId.substring(4, 6);
        track = ALL_TRACKS[trackCode] || (isNar ? "大井" : "東京");
        raceNumber = parseInt(raceId.substring(10, 12), 10).toString();
        const yyyy = raceId.substring(0, 4);
        if (isNar) {
          const mm = raceId.substring(6, 8);
          const dd = raceId.substring(8, 10);
          dateVal = `${yyyy}-${mm}-${dd}`;
        } else {
          const today = new Date();
          const mm = String(today.getMonth() + 1).padStart(2, "0");
          const dd = String(today.getDate()).padStart(2, "0");
          dateVal = `${yyyy}-${mm}-${dd}`;
        }
      }

      if (horses.length > 0) {
        scrapedData = {
          success: true,
          source: isResultFetch
            ? isNar
              ? "scraped-nar-result"
              : "scraped-netkeiba-result"
            : isNar
              ? "scraped-nar-entries"
              : "scraped-netkeiba-entries",
          url: `${domain}/race/${isResultFetch ? "result" : "shutuba"}.html?race_id=${raceId || ""}`,
          date: dateVal,
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
    const isNar = isNarTarget(target, raceId);

    const track = ALL_TRACKS[trackCode] || (isNar ? "大井" : "東京");
    const raceNumber = parseInt(raceNumCode, 10).toString();
    const yyyy = raceId.substring(0, 4);

    let dateStr = "";
    if (isNar) {
      const mm = raceId.substring(6, 8);
      const dd = raceId.substring(8, 10);
      dateStr = `${yyyy}-${mm}-${dd}`;
    } else {
      const today = new Date();
      const mm = String(today.getMonth() + 1).padStart(2, "0");
      const dd = String(today.getDate()).padStart(2, "0");
      dateStr = `${yyyy}-${mm}-${dd}`;
    }

    const isSprint =
      (trackCode === "10" && raceNumber === "11") ||
      (trackCode === "04" && raceNumber === "11") ||
      (trackCode === "02" && raceNumber === "11");

    const pool = isNar
      ? [
          "ミックファイア",
          "ウシュバテソーロ",
          "メイショウハリオ",
          "ウィルソンテソーロ",
          "クラウンプライド",
          "ディクテオン",
          "デルマソトガケ",
          "フォーエバーヤング",
          "ライトウォーリア",
          "キングズソード",
        ]
      : isSprint
        ? MOCK_SPRINTERS
        : MOCK_MID_LONG;

    const mockJockeys = isNar
      ? [
          "笹川翼",
          "森泰斗",
          "矢野貴之",
          "吉原寛人",
          "御神本訓",
          "赤岡修次",
          "本田正重",
          "町田直希",
        ]
      : [
          "ルメール",
          "川田将雅",
          "武豊",
          "戸崎圭太",
          "坂井瑠星",
          "横山武史",
          "松山弘平",
          "デムーロ",
        ];

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
        jockey: mockJockeys[index % mockJockeys.length],
      };
    });

    let raceName = `${track}第${raceNumber}レース`;
    if (raceNumber === "11" && !isNar) {
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
        horseName: selectedHorses[0] || (isNar ? "ミックファイア" : "ドウデュース"),
        jockey: mockJockeys[0],
      },
      {
        rank: 2,
        horseNumber: "2",
        horseName: selectedHorses[1] || (isNar ? "ウシュバテソーロ" : "イクイノックス"),
        jockey: mockJockeys[1],
      },
      {
        rank: 3,
        horseNumber: "3",
        horseName: selectedHorses[2] || (isNar ? "メイショウハリオ" : "リバティアイランド"),
        jockey: mockJockeys[2],
      },
    ];

    return NextResponse.json({
      success: true,
      source: "id-parser-mock",
      url: `${domain}/race/result.html?race_id=${raceId}`,
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
    url: "https://race.netkeiba.com/race/result.html?race_id=202405040811",
    date: new Date().toISOString().split("T")[0],
    track: "東京",
    raceNumber: "11",
    raceName: "ジェミニステークス",
    horses: [
      { waku: 1, umaban: 1, horseName: "ドウデュース", jockey: "武豊" },
      { waku: 2, umaban: 2, horseName: "イクイノックス", jockey: "ルメール" },
      {
        waku: 3,
        umaban: 3,
        horseName: "リバティアイランド",
        jockey: "川田将雅",
      },
      { waku: 4, umaban: 4, horseName: "プログノーシス", jockey: "戸崎圭太" },
    ],
  });
}
