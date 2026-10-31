import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import iconv from "iconv-lite";

// Fast DNS resolver that avoids stalling if the primary OS nameserver is unresponsive
const fastResolver = new dns.promises.Resolver({ timeout: 1500, tries: 1 });
try {
  const currentServers = dns.getServers();
  const preferredServers = ["1.1.1.1", "8.8.8.8"];
  const merged = [
    ...preferredServers,
    ...currentServers.filter((s) => !preferredServers.includes(s)),
  ];
  fastResolver.setServers(merged);
} catch {
  // Ignore resolver initialization errors and fall back to OS lookup
}

function customDnsLookup(
  hostname: string,
  options: dns.LookupOptions | ((err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void),
  callback?: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
) {
  const cb = typeof options === "function" ? options : callback!;
  const opts: dns.LookupOptions = typeof options === "function" ? {} : options || {};

  fastResolver
    .resolve4(hostname)
    .then((addresses) => {
      if (!addresses || addresses.length === 0) {
        dns.lookup(hostname, opts, cb as any);
        return;
      }
      if (opts.all) {
        cb(
          null,
          addresses.map((address) => ({ address, family: 4 })),
        );
      } else {
        cb(null, addresses[0], 4);
      }
    })
    .catch(() => {
      dns.lookup(hostname, opts, cb as any);
    });
}

async function fetchHttpBuffer(
  urlStr: string,
  timeoutMs = 8000,
  redirectCount = 0,
): Promise<{
  ok: boolean;
  status: number;
  headers: http.IncomingHttpHeaders;
  buffer: Buffer;
}> {
  if (redirectCount > 5) {
    throw new Error("Too many redirects");
  }

  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlStr);
    const client = parsedUrl.protocol === "https:" ? https : http;

    const req = client.get(
      parsedUrl,
      {
        lookup: customDnsLookup as any,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ja,en-US;q=0.9,en;q=0.8",
        },
        timeout: timeoutMs,
      },
      (res) => {
        const statusCode = res.statusCode || 0;
        if (
          statusCode >= 300 &&
          statusCode < 400 &&
          res.headers.location
        ) {
          const nextUrl = new URL(res.headers.location, urlStr).toString();
          res.resume();
          fetchHttpBuffer(nextUrl, timeoutMs, redirectCount + 1).then(
            resolve,
            reject,
          );
          return;
        }

        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          resolve({
            ok: statusCode >= 200 && statusCode < 300,
            status: statusCode,
            headers: res.headers,
            buffer: Buffer.concat(chunks),
          });
        });
      },
    );

    req.on("timeout", () => {
      req.destroy(new Error(`Request timed out after ${timeoutMs}ms: ${urlStr}`));
    });
    req.on("error", reject);
  });
}

function decodeHtmlBuffer(
  buffer: Buffer,
  contentTypeHeader?: string | string[],
): string {
  const ct = Array.isArray(contentTypeHeader)
    ? contentTypeHeader.join("; ")
    : contentTypeHeader || "";
  if (/euc-jp/i.test(ct)) {
    return iconv.decode(buffer, "euc-jp");
  }
  const headAscii = buffer.subarray(0, 1024).toString("ascii");
  if (/charset=["']?\s*euc-jp/i.test(headAscii)) {
    return iconv.decode(buffer, "euc-jp");
  }
  return buffer.toString("utf-8");
}

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
  "58": "札幌(地方)",
  "59": "函館(地方)",
  "60": "新潟(地方)",
  "61": "中京(地方)",
  "62": "春木",
  "63": "北見(地方)",
  "64": "岩見沢(地方)",
  "65": "ばんえい帯広",
};

const ALL_TRACKS: Record<string, string> = {
  ...NAR_TRACKS,
  ...JRA_TRACKS,
};

// Reverse map from track name to track code (JRA takes priority over NAR)
const TRACK_NAME_TO_CODE: Record<string, string> = {};
for (const [code, name] of Object.entries(NAR_TRACKS)) {
  TRACK_NAME_TO_CODE[name] = code;
}
for (const [code, name] of Object.entries(JRA_TRACKS)) {
  TRACK_NAME_TO_CODE[name] = code;
}
TRACK_NAME_TO_CODE["帯広"] = "65";
TRACK_NAME_TO_CODE["帯広(ば)"] = "65";
TRACK_NAME_TO_CODE["ばんえい"] = "65";

function normalizeTrackName(track: string): string {
  if (track.includes("帯広") || track.includes("ばんえい")) return "ばんえい帯広";
  return track.replace(/競馬場/g, "").trim();
}

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

// Helper: Resolve race ID from date (YYYY-MM-DD), track name, and race number
async function resolveRaceId(
  dateStr: string,
  trackName: string,
  raceNumberStr: string,
): Promise<{
  raceId: string;
  isNar: boolean;
  url: string;
  track: string;
  raceNumber: string;
} | null> {
  const yyyymmdd = dateStr.replace(/[-/]/g, "").trim();
  if (yyyymmdd.length !== 8) return null;
  const year = yyyymmdd.substring(0, 4);
  const mmdd = yyyymmdd.substring(4, 8);
  const raceNum = parseInt(raceNumberStr, 10);
  if (isNaN(raceNum) || raceNum < 1 || raceNum > 12) return null;
  const raceNumPadded = String(raceNum).padStart(2, "0");

  const normalizedTrack = normalizeTrackName(trackName);
  const trackCode = TRACK_NAME_TO_CODE[normalizedTrack];
  const jraTrackName = trackCode ? JRA_TRACKS[trackCode] : undefined;

  // 1. If it's a known NAR track, construct predictable NAR race ID
  if (trackCode && parseInt(trackCode, 10) >= 30) {
    const narId = `${year}${trackCode}${mmdd}${raceNumPadded}`;
    return {
      raceId: narId,
      isNar: true,
      url: `https://nar.netkeiba.com/race/result.html?race_id=${narId}`,
      track: ALL_TRACKS[trackCode] || normalizedTrack,
      raceNumber: String(raceNum),
    };
  }

  // 2. Query race.netkeiba.com/top/race_list_sub.html?kaisai_date=YYYYMMDD (JRA live/recent/archive, UTF-8)
  try {
    const subUrl = `https://race.netkeiba.com/top/race_list_sub.html?kaisai_date=${yyyymmdd}`;
    const res = await fetchHttpBuffer(subUrl, 8000);
    if (res.ok) {
      const html = decodeHtmlBuffer(res.buffer, res.headers["content-type"]);

      // 2A. Direct pattern match by year + trackCode + kai/day + raceNumPadded
      if (trackCode) {
        const directIdRegex = new RegExp(
          `race_id=(${year}${trackCode}\\d{4}${raceNumPadded})\\b`,
        );
        const directMatch = html.match(directIdRegex);
        if (directMatch) {
          const foundId = directMatch[1];
          const isNar = parseInt(foundId.substring(4, 6), 10) >= 30;
          const domain = isNar
            ? "https://nar.netkeiba.com"
            : "https://race.netkeiba.com";
          return {
            raceId: foundId,
            isNar,
            url: `${domain}/race/result.html?race_id=${foundId}`,
            track: ALL_TRACKS[trackCode] || normalizedTrack,
            raceNumber: String(raceNum),
          };
        }
      }

      // 2B. Fallback: Match by RaceList_DataList section header
      const dlMatches = [
        ...html.matchAll(
          /<dl class=["']RaceList_DataList[^"']*["'][^>]*>([\s\S]*?)<\/dl>/g,
        ),
      ];
      for (const dlMatch of dlMatches) {
        const block = dlMatch[1];
        const headerMatch = block.match(
          /<dt class=["']RaceList_DataHeader["'][^>]*>([\s\S]*?)<\/dt>/,
        );
        const headerText = headerMatch
          ? headerMatch[1].replace(/<[^>]+>/g, "").trim()
          : "";

        const matchesTrack =
          Boolean(headerText) &&
          ((Boolean(normalizedTrack) && headerText.includes(normalizedTrack)) ||
            (Boolean(jraTrackName) && headerText.includes(jraTrackName!)));

        if (matchesTrack) {
          const raceItemMatches = [
            ...block.matchAll(
              /<li[^>]*class=["']RaceList_DataItem[^"']*["'][\s\S]*?<\/li>/g,
            ),
          ];
          for (const itemMatch of raceItemMatches) {
            const item = itemMatch[0];
            const rNumMatch =
              item.match(/class=["']Race_Num["'][^>]*>[\s\S]*?(\d+)R/i) ||
              item.match(/(\d+)\s*R/i);
            if (rNumMatch && parseInt(rNumMatch[1], 10) === raceNum) {
              const idMatch = item.match(/race_id=(\d{12})/);
              if (idMatch) {
                const foundId = idMatch[1];
                const isNar = parseInt(foundId.substring(4, 6), 10) >= 30;
                const domain = isNar
                  ? "https://nar.netkeiba.com"
                  : "https://race.netkeiba.com";
                return {
                  raceId: foundId,
                  isNar,
                  url: `${domain}/race/result.html?race_id=${foundId}`,
                  track: trackCode
                    ? ALL_TRACKS[trackCode] || normalizedTrack
                    : normalizedTrack,
                  raceNumber: String(raceNum),
                };
              }
            }
          }
        }
      }
    }
  } catch (e) {
    // continue to db.netkeiba
  }

  // 3. Query db.netkeiba.com/race/list/YYYYMMDD/ (JRA/NAR archive, EUC-JP)
  try {
    const dbUrl = `https://db.netkeiba.com/race/list/${yyyymmdd}/`;
    const res = await fetchHttpBuffer(dbUrl, 8000);
    if (res.ok) {
      const html = iconv.decode(res.buffer, "euc-jp");

      // 3A. Direct pattern match by year + trackCode + kai/day + raceNumPadded
      if (trackCode) {
        const directDbRegex = new RegExp(
          `\\/race\\/(${year}${trackCode}\\d{4}${raceNumPadded})\\/`,
        );
        const directDbMatch = html.match(directDbRegex);
        if (directDbMatch) {
          const foundId = directDbMatch[1];
          const isNar = parseInt(foundId.substring(4, 6), 10) >= 30;
          const domain = isNar
            ? "https://nar.netkeiba.com"
            : "https://race.netkeiba.com";
          return {
            raceId: foundId,
            isNar,
            url: `${domain}/race/result.html?race_id=${foundId}`,
            track: ALL_TRACKS[trackCode] || normalizedTrack,
            raceNumber: String(raceNum),
          };
        }
      }

      // 3B. Fallback: Match by race_top_hold_list section header
      const holdSections = html.split('<dl class="race_top_hold_list">');
      for (let i = 1; i < holdSections.length; i++) {
        const section = holdSections[i];
        const headerMatch = section.match(
          /<dt class="race_top_hold_data">[\s\S]*?<p>([\s\S]*?)<\/p>/,
        );
        const sectionTrack = headerMatch
          ? headerMatch[1].replace(/<[^>]+>/g, "").trim()
          : "";

        const matchesTrack =
          Boolean(sectionTrack) &&
          ((Boolean(normalizedTrack) &&
            (sectionTrack.includes(normalizedTrack) ||
              normalizedTrack.includes(sectionTrack))) ||
            (Boolean(jraTrackName) && sectionTrack.includes(jraTrackName!)));

        if (matchesTrack) {
          const racePattern = new RegExp(
            `<dt>\\s*${raceNum}R\\s*<\\/dt>[\\s\\S]*?\\/race\\/(\\d{12})\\/`,
            "i",
          );
          const rMatch = section.match(racePattern);
          if (rMatch) {
            const foundId = rMatch[1];
            const isNar = parseInt(foundId.substring(4, 6), 10) >= 30;
            const domain = isNar
              ? "https://nar.netkeiba.com"
              : "https://race.netkeiba.com";
            return {
              raceId: foundId,
              isNar,
              url: `${domain}/race/result.html?race_id=${foundId}`,
              track: trackCode
                ? ALL_TRACKS[trackCode] || normalizedTrack
                : normalizedTrack,
              raceNumber: String(raceNum),
            };
          }
        }
      }
    }
  } catch (e) {
    // search failed
  }

  return null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let target = searchParams.get("url") || "";
  const paramDate = searchParams.get("date") || "";
  const paramTrack = searchParams.get("track") || "";
  const paramRaceNumber = searchParams.get("raceNumber") || "";

  let resolvedTrack = paramTrack;
  let resolvedRaceNumber = paramRaceNumber;
  let resolvedDate = paramDate;

  // If no direct URL/ID is given, attempt to resolve from date, track, and raceNumber
  if (!target && paramDate && paramTrack && paramRaceNumber) {
    const resolved = await resolveRaceId(
      paramDate,
      paramTrack,
      paramRaceNumber,
    );
    if (resolved) {
      target = resolved.url;
      resolvedTrack = resolved.track;
      resolvedRaceNumber = resolved.raceNumber;
    } else {
      return NextResponse.json(
        {
          error: `「${paramDate} ${paramTrack} ${paramRaceNumber}R」のレース情報が見つかりませんでした。開催日や開催場をご確認ください。`,
        },
        { status: 404 },
      );
    }
  }

  if (!target) {
    return NextResponse.json(
      { error: "URLまたは日付・開催場・レース番号を指定してください" },
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
    const res = await fetchHttpBuffer(fetchUrl, 8000);
    let html = "";
    if (res.ok) {
      html = decodeHtmlBuffer(res.buffer, res.headers["content-type"]);
    }

    let horses = extractHorsesWithDetails(html);
    let title = extractTitle(html);
    let payouts: Record<string, { selection: string; amount: number }[]> = {};
    let resultsList: {
      rank: number;
      horseNumber: string;
      horseName: string;
    }[] = [];

    // If result page failed to return horses (e.g. race not yet held), fallback to entries page
    if (horses.length === 0 && isResultFetch && raceId) {
      isResultFetch = false;
      fetchUrl = `${domain}/race/shutuba.html?race_id=${raceId}`;
      const retryRes = await fetchHttpBuffer(fetchUrl, 8000);
      if (retryRes.ok) {
        const retryHtml = decodeHtmlBuffer(
          retryRes.buffer,
          retryRes.headers["content-type"],
        );
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
      let track = resolvedTrack || (isNar ? "大井" : "東京");
      let raceNumber = resolvedRaceNumber || "11";
      let dateVal = resolvedDate || new Date().toISOString().split("T")[0];
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
        track =
          resolvedTrack || ALL_TRACKS[trackCode] || (isNar ? "大井" : "東京");
        raceNumber =
          resolvedRaceNumber ||
          parseInt(raceId.substring(10, 12), 10).toString();
        const yyyy = raceId.substring(0, 4);
        if (resolvedDate) {
          dateVal = resolvedDate;
        } else if (isNar) {
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
    console.warn("Real-time scraping failed:", e);
  }

  if (scrapedData) {
    return NextResponse.json(scrapedData);
  }

  return NextResponse.json(
    {
      error:
        "レース情報の取得に失敗しました。開催日・開催場・レース番号またはURLをご確認ください。",
    },
    { status: 404 },
  );
}
