"use client";

import { useState, useEffect } from "react";
import {
  getMemos,
  saveMemo,
  deleteMemo,
  type MemoData,
  type TicketData,
  type RaceResult,
} from "./actions";
import styles from "./page.module.css";

interface ScrapedHorse {
  waku: number;
  umaban: number;
  horseName: string;
}

// JRA standard bracket color styling map
const WAKU_COLORS: Record<
  number,
  { bg: string; text: string; border: string }
> = {
  1: { bg: "#ffffff", text: "#000000", border: "#cccccc" }, // 1枠: 白
  2: { bg: "#1f2937", text: "#ffffff", border: "transparent" }, // 2枠: 黒
  3: { bg: "#ef4444", text: "#ffffff", border: "transparent" }, // 3枠: 赤
  4: { bg: "#3b82f6", text: "#ffffff", border: "transparent" }, // 4枠: 青
  5: { bg: "#eab308", text: "#000000", border: "transparent" }, // 5枠: 黄
  6: { bg: "#10b981", text: "#ffffff", border: "transparent" }, // 6枠: 緑
  7: { bg: "#f97316", text: "#ffffff", border: "transparent" }, // 7枠: 橙
  8: { bg: "#ec4899", text: "#ffffff", border: "transparent" }, // 8枠: 桃
};

// --- Combinations Expansion Helpers ---
function getCombinations(array: string[], size: number): string[][] {
  const result: string[][] = [];
  function p(t: string[], a: string[], n: number) {
    if (n === 0) {
      result.push(t);
      return;
    }
    for (let i = 0, l = a.length; i <= l - n; i++) {
      p(t.concat([a[i]]), a.slice(i + 1), n - 1);
    }
  }
  p([], array, size);
  return result;
}

function getPermutations(array: string[], size: number): string[][] {
  const result: string[][] = [];
  function p(t: string[], a: string[]) {
    if (t.length === size) {
      result.push(t);
      return;
    }
    for (let i = 0, l = a.length; i < l; i++) {
      const rest = a.slice();
      rest.splice(i, 1);
      p(t.concat([a[i]]), rest);
    }
  }
  p([], array);
  return result;
}

function parseNumList(str: string): string[] {
  return str
    .split(/[,、\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// Expands racing notations (BOX, Nagashi, Formations) into discrete tickets (e.g. "3-6", "3-4")
export function expandTicketSelection(
  type: string,
  selection: string,
): string[] {
  const clean = selection.trim().toUpperCase();
  if (!clean) return [];

  const targetSizeMap: Record<string, number> = {
    単勝: 1,
    複勝: 1,
    応援馬券: 1,
    枠連: 2,
    馬連: 2,
    馬単: 2,
    ワイド: 2,
    "3連複": 3,
    "3連単": 3,
  };
  const size = targetSizeMap[type] || 1;
  const isOrderSensitive = type === "馬単" || type === "3連単";

  // 1. BOX Notation (e.g., "BOX 3,5,6" or "3,5,6 BOX")
  const isBox = clean.includes("BOX") || clean.includes("ボックス");
  if (isBox) {
    const rawNums = clean.replace(/BOX|ボックス/gi, "");
    const nums = parseNumList(rawNums);
    if (nums.length < size) return [];

    if (isOrderSensitive) {
      return getPermutations(nums, size).map((arr) => arr.join("-"));
    }
    return getCombinations(nums, size).map((arr) =>
      arr.sort((a, b) => Number(a) - Number(b)).join("-"),
    );
  }

  // 2. Nagashi (流し) & Formation (フォーメーション)
  // Splits sections by "-", "=>", "→", "⇒" or "★"
  const sections = clean.split(/[-ー=➔→⇒★]+/g).map((s) => parseNumList(s));

  if (sections.length > 1) {
    // 2.1 Formation (e.g., "1,2 - 3,4 - 5,6")
    if (sections.length === size) {
      const results: string[] = [];

      function helper(currentIndex: number, currentCombination: string[]) {
        if (currentIndex === size) {
          if (new Set(currentCombination).size === size) {
            if (isOrderSensitive) {
              results.push(currentCombination.join("-"));
            } else {
              results.push(
                [...currentCombination]
                  .sort((a, b) => Number(a) - Number(b))
                  .join("-"),
              );
            }
          }
          return;
        }
        for (const num of sections[currentIndex]) {
          helper(currentIndex + 1, currentCombination.concat([num]));
        }
      }

      helper(0, []);
      return Array.from(new Set(results));
    }

    // 2.2 Nagashi (流し) (e.g., "1 - 2,3,4")
    if (sections.length === 2) {
      const axis = sections[0];
      const opponents = sections[1];
      const axisCount = axis.length;

      // 2-Horse wagers (Quinella/Exacta/Wide) -> axis must be 1 horse
      if (size === 2 && axisCount === 1) {
        const results: string[] = [];
        const singleAxis = axis[0];
        for (const opp of opponents) {
          if (singleAxis === opp) continue;
          if (isOrderSensitive) {
            results.push(`${singleAxis}-${opp}`);
          } else {
            results.push(
              [singleAxis, opp].sort((a, b) => Number(a) - Number(b)).join("-"),
            );
          }
        }
        return results;
      }

      // 3-Horse wagers (Trio/Trifecta) -> axis can be 1 or 2 horses
      if (size === 3) {
        const results: string[] = [];
        if (axisCount === 1) {
          // 1-Horse Axis (needs 2 from opponents)
          const singleAxis = axis[0];
          const oppCombos = getCombinations(opponents, 2);
          for (const combo of oppCombos) {
            if (combo.includes(singleAxis)) continue;
            if (isOrderSensitive) {
              results.push(`${singleAxis}-${combo[0]}-${combo[1]}`);
              results.push(`${singleAxis}-${combo[1]}-${combo[0]}`);
            } else {
              results.push(
                [singleAxis, ...combo]
                  .sort((a, b) => Number(a) - Number(b))
                  .join("-"),
              );
            }
          }
        } else if (axisCount === 2) {
          // 2-Horse Axis (needs 1 from opponents)
          const axis1 = axis[0];
          const axis2 = axis[1];
          for (const opp of opponents) {
            if (opp === axis1 || opp === axis2) continue;
            if (isOrderSensitive) {
              results.push(`${axis1}-${axis2}-${opp}`);
            } else {
              results.push(
                [axis1, axis2, opp]
                  .sort((a, b) => Number(a) - Number(b))
                  .join("-"),
              );
            }
          }
        }
        return results;
      }
    }
  }

  // 3. Plain single bet (e.g. "15" or "6-15")
  if (isOrderSensitive) {
    return [clean];
  }
  const sorted = clean
    .split(/[-ー]+/g)
    .sort((a, b) => Number(a) - Number(b))
    .join("-");
  return [sorted];
}

// Initial dummy data with nested tickets and results
const INITIAL_MEMOS: Omit<MemoData, "id">[] = [
  {
    date: "2026-06-28",
    track: "阪神",
    raceNumber: "11",
    raceName: "宝塚記念 (G1)",
    prediction: {
      honmei: "15 ドウデュース",
      taiko: "6 ジャスティンパレス",
      anago: "4 ベラジオオペラ",
      renge: "3 ソールオリエンス",
    },
    memoText:
      "重馬場想定。内側の傷みが激しいため外差しが決まる展開とみる。本命ドウデュースは武豊騎手の神騎乗に期待。結果はドウデュースが素晴らしい末脚で差し切り勝ち。対抗のジャスティンパレスは惜しくも届かず4着だったが、3連複が的中して快勝！",
    result: "hit",
    resultList: [
      { rank: 1, horseNumber: "15", horseName: "ドウデュース" },
      { rank: 2, horseNumber: "6", horseName: "ジャスティンパレス" },
      { rank: 3, horseNumber: "4", horseName: "ベラジオオペラ" },
    ],
    tickets: [
      {
        type: "3連複",
        selection: "4-6-15",
        investment: 5000,
        payout: 18500,
        isHit: true,
      },
    ],
  },
  {
    date: "2026-05-24",
    track: "東京",
    raceNumber: "11",
    raceName: "日本ダービー (G1)",
    prediction: {
      honmei: "15 ジャスティンミラノ",
      taiko: "12 レガレイラ",
      anago: "6 シックスペンス",
      renge: "2 ダノンデサイル",
    },
    memoText:
      "スローペース濃厚。先行できるジャスティンミラノを軸にする。ダノンデサイルは馬場状態が合えば一発あると思い連下に。結果はダノンデサイルがインを突いて快勝。本命ジャスティンミラノが2着で馬連はハズレ。ダービーの難しさを改めて実感。",
    result: "miss",
    resultList: [
      { rank: 1, horseNumber: "12", horseName: "ダノンデサイル" },
      { rank: 2, horseNumber: "15", horseName: "ジャスティンミラノ" },
      { rank: 3, horseNumber: "13", horseName: "シンエンペラー" },
    ],
    tickets: [
      {
        type: "馬連",
        selection: "12-15",
        investment: 3000,
        payout: 0,
        isHit: false,
      },
    ],
  },
];

export default function Home() {
  const [memos, setMemos] = useState<MemoData[]>([]);
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchedHorses, setFetchedHorses] = useState<ScrapedHorse[]>([]);

  // Scraped results data
  const [scrapedPayouts, setScrapedPayouts] = useState<
    Record<string, { selection: string; amount: number }[]>
  >({});
  const [scrapedResults, setScrapedResults] = useState<RaceResult[]>([]);

  // Form states
  const [date, setDate] = useState("");
  const [track, setTrack] = useState("東京");
  const [raceNumber, setRaceNumber] = useState("11");
  const [raceName, setRaceName] = useState("");
  const [honmei, setHonmei] = useState("");
  const [taiko, setTaiko] = useState("");
  const [anago, setAnago] = useState("");
  const [renge, setRenge] = useState("");
  const [memoText, setMemoText] = useState("");
  const [urlInput, setUrlInput] = useState("");

  // Multiple Tickets Form State (Default unit investment is now 100 Yen)
  const [tickets, setTickets] = useState<Omit<TicketData, "id">[]>([
    { type: "単勝", selection: "", investment: 100, payout: 0, isHit: false },
  ]);

  // Helper to load and sync data from DB
  const refreshMemos = async () => {
    const data = await getMemos();
    setMemos(data);
  };

  // Load memos on mount
  useEffect(() => {
    refreshMemos();
  }, []);

  // Toast handler
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Helper: Calculate actual investment for a single ticket (応援馬券 costs double)
  const getTicketCost = (t: Omit<TicketData, "id"> | TicketData) => {
    return t.type === "応援馬券" ? t.investment * 2 : t.investment;
  };

  // Calculate Aggregated Statistics
  const totalInvestment = memos.reduce((sum, memo) => {
    return sum + memo.tickets.reduce((tSum, t) => tSum + getTicketCost(t), 0);
  }, 0);

  const totalPayout = memos.reduce((sum, memo) => {
    return sum + memo.tickets.reduce((tSum, t) => tSum + t.payout, 0);
  }, 0);

  const totalIncome = totalPayout - totalInvestment;
  const recoveryRate =
    totalInvestment > 0 ? Math.round((totalPayout / totalInvestment) * 100) : 0;

  const totalRacesWithResult = memos.filter(
    (item) => item.result !== "pending",
  ).length;
  const hitRaces = memos.filter((item) => item.result === "hit").length;
  const hitRate =
    totalRacesWithResult > 0
      ? Math.round((hitRaces / totalRacesWithResult) * 100)
      : 0;

  // Toggle Accordion Detail
  const toggleDetail = (id: string) => {
    setActiveMemoId(activeMemoId === id ? null : id);
  };

  // Dynamic ticket row actions (Default investment is now 100 Yen)
  const handleAddTicket = () => {
    setTickets([
      ...tickets,
      { type: "単勝", selection: "", investment: 100, payout: 0, isHit: false },
    ]);
  };

  const handleRemoveTicket = (index: number) => {
    if (tickets.length === 1) return;
    setTickets(tickets.filter((_, i) => i !== index));
  };

  // Triggers updates for selections and auto-fills investment if combos are matched
  const handleTicketChange = (
    index: number,
    key: keyof Omit<TicketData, "id">,
    value: any,
  ) => {
    const newTickets = [...tickets];

    if (key === "selection") {
      newTickets[index].selection = value;
      // Auto-compute combinations count and fill total investment
      const combos = expandTicketSelection(newTickets[index].type, value);
      if (combos.length > 0) {
        const factor = newTickets[index].type === "応援馬券" ? 2 : 1;
        newTickets[index].investment = 100 * combos.length * factor;
      }
    } else if (key === "type") {
      newTickets[index].type = value;
      // Re-compute combos count on type change
      const combos = expandTicketSelection(value, newTickets[index].selection);
      if (combos.length > 0) {
        const factor = value === "応援馬券" ? 2 : 1;
        newTickets[index].investment = 100 * combos.length * factor;
      }
    } else {
      newTickets[index] = {
        ...newTickets[index],
        [key]:
          key === "investment" || key === "payout" ? Number(value) || 0 : value,
      };
    }

    setTickets(newTickets);
  };

  // Auto-calculate payouts based on scraped dividends (supports multi-hits for BOX/Formations)
  const handleAutoCalculatePayouts = () => {
    if (!scrapedPayouts || Object.keys(scrapedPayouts).length === 0) {
      showToast("払戻金データがありません。レース結果を取得してください。");
      return;
    }

    const normalize = (s: string) =>
      s
        .split(/[-ー]/)
        .map((x) => x.trim())
        .sort((a, b) => Number(a) - Number(b))
        .join("-");

    const updatedTickets = tickets.map((t) => {
      // 1. Check Special 応援馬券 Support Wagers
      if (t.type === "応援馬券") {
        const tanshoPayouts = scrapedPayouts["単勝"];
        const fukushoPayouts = scrapedPayouts["複勝"];

        let supportPayout = 0;
        let isSupportHit = false;
        const targetHorseNum = t.selection.trim();

        if (tanshoPayouts) {
          const matchedTansho = tanshoPayouts.find(
            (p) => p.selection === targetHorseNum,
          );
          if (matchedTansho) {
            supportPayout += Math.round(
              t.investment * (matchedTansho.amount / 100),
            );
            isSupportHit = true;
          }
        }
        if (fukushoPayouts) {
          const matchedFukusho = fukushoPayouts.find(
            (p) => p.selection === targetHorseNum,
          );
          if (matchedFukusho) {
            supportPayout += Math.round(
              t.investment * (matchedFukusho.amount / 100),
            );
            isSupportHit = true;
          }
        }

        return {
          ...t,
          isHit: isSupportHit,
          payout: supportPayout,
        };
      }

      // 2. BOX, Nagashi, Formations or Plain Single Bets
      const combos = expandTicketSelection(t.type, t.selection);
      if (combos.length === 0) return { ...t, isHit: false, payout: 0 };

      const typePayouts = scrapedPayouts[t.type];
      if (!typePayouts) return { ...t, isHit: false, payout: 0 };

      // Calculate investment unit cost per combination
      const unitInvestment = Math.round(t.investment / combos.length);
      const isOrderSensitive =
        t.type === "馬単" ||
        t.type === "3連単" ||
        t.type === "単勝" ||
        t.type === "複勝";

      let totalPayoutForTicket = 0;
      let isHit = false;

      for (const combo of combos) {
        const matched = typePayouts.find((p) => {
          if (isOrderSensitive) {
            return p.selection === combo;
          }
          return normalize(p.selection) === normalize(combo);
        });

        if (matched) {
          totalPayoutForTicket += Math.round(
            unitInvestment * (matched.amount / 100),
          );
          isHit = true;
        }
      }

      return {
        ...t,
        isHit,
        payout: totalPayoutForTicket,
      };
    });

    setTickets(updatedTickets);
    showToast("払戻金・的中状況を自動計算しました！");
  };

  // Handle URL fetch (scrapes entries or results + payouts + order of finish)
  const handleFetchRaceInfo = async () => {
    if (!urlInput) {
      showToast("レースURLまたはIDを入力してください");
      return;
    }

    setIsFetching(true);
    showToast("レース情報を検索中...");

    try {
      const response = await fetch(
        `/api/scrape?url=${encodeURIComponent(urlInput)}`,
      );
      if (!response.ok) throw new Error("取得に失敗しました");

      const data = await response.json();

      setDate(data.date || new Date().toISOString().split("T")[0]);
      setTrack(data.track || "東京");
      setRaceNumber(data.raceNumber || "11");
      setRaceName(data.raceName || "");

      // Reset predictions and load horses
      setHonmei("");
      setTaiko("");
      setAnago("");
      setRenge("");

      // Sort fetched horses by Umaban (in case API didn't sort, we double-check)
      const sortedHorses = (data.horses || []).sort(
        (a: ScrapedHorse, b: ScrapedHorse) => a.umaban - b.umaban,
      );
      setFetchedHorses(sortedHorses);

      // Load payouts and finishing order
      if (data.payouts) {
        setScrapedPayouts(data.payouts);
      } else {
        setScrapedPayouts({});
      }

      if (data.results) {
        setScrapedResults(data.results);
        showToast(
          `「${data.raceName}」の情報、結果、払戻金を自動取得しました！`,
        );
      } else {
        setScrapedResults([]);
        showToast(`「${data.raceName}」の出走馬情報を取得しました！`);
      }

      setUrlInput("");
    } catch (err) {
      // Fallback mock
      setTimeout(() => {
        setDate(new Date().toISOString().split("T")[0]);
        setTrack("中山");
        setRaceNumber("11");
        setRaceName("有馬記念 (G1)");

        setHonmei("");
        setTaiko("");
        setAnago("");
        setRenge("");
        setFetchedHorses([
          { waku: 1, umaban: 1, horseName: "イクイノックス" },
          { waku: 2, umaban: 2, horseName: "リバティアイランド" },
          { waku: 3, umaban: 3, horseName: "ドウデュース" },
          { waku: 4, umaban: 4, horseName: "タイトルホルダー" },
        ]);
        setScrapedPayouts({});
        setScrapedResults([]);
        showToast("有馬記念のモックデータを取得しました！(デモモード)");
      }, 1500);
    } finally {
      setTimeout(() => setIsFetching(false), 1500);
    }
  };

  // Assign horse name with horse number to specific prediction input
  const handleQuickMark = (
    horse: ScrapedHorse,
    markType: "honmei" | "taiko" | "anago" | "renge",
  ) => {
    const formattedVal = `${horse.umaban} ${horse.horseName}`;
    if (markType === "honmei") {
      setHonmei(formattedVal);
      showToast(`◎ (本命) に ${formattedVal} を設定しました`);
    } else if (markType === "taiko") {
      setTaiko(formattedVal);
      showToast(`◯ (対抗) に ${formattedVal} を設定しました`);
    } else {
      const currentVal = markType === "anago" ? anago : renge;
      const setter = markType === "anago" ? setAnago : setRenge;
      const label = markType === "anago" ? "▲ (単穴)" : "△ (連下)";

      if (!currentVal) {
        setter(formattedVal);
      } else {
        const list = currentVal.split(/[,、]\s*/).map((x) => x.trim());
        if (!list.includes(formattedVal)) {
          setter(`${currentVal}, ${formattedVal}`);
        }
      }
      showToast(`${label} に ${formattedVal} を追加しました`);
    }
  };

  // Handle Add Memo
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raceName) {
      showToast("レース名を入力してください");
      return;
    }

    const totalInvest = tickets.reduce((sum, t) => sum + getTicketCost(t), 0);
    const totalPay = tickets.reduce((sum, t) => sum + t.payout, 0);

    let finalResult: "hit" | "miss" | "pending" = "pending";
    if (totalInvest > 0) {
      if (totalPay > totalInvest) {
        finalResult = "hit";
      } else if (totalPay === 0) {
        finalResult = "miss";
      } else {
        finalResult = totalPay >= totalInvest ? "hit" : "miss";
      }
    }

    const memoPayload: Omit<MemoData, "id"> = {
      date: date || new Date().toISOString().split("T")[0],
      track,
      raceNumber,
      raceName,
      prediction: { honmei, taiko, anago, renge },
      memoText,
      result: finalResult,
      resultList: scrapedResults,
      tickets: tickets.map((t) => ({
        type: t.type,
        selection: t.selection,
        investment: t.investment,
        payout: t.payout,
        isHit: t.payout > 0,
      })),
    };

    const res = await saveMemo(memoPayload);
    if (res.success) {
      await refreshMemos();
      showToast("ログを保存しました");

      // Reset form fields
      setRaceName("");
      setHonmei("");
      setTaiko("");
      setAnago("");
      setRenge("");
      setMemoText("");
      setTickets([
        {
          type: "単勝",
          selection: "",
          investment: 100,
          payout: 0,
          isHit: false,
        },
      ]);
      setFetchedHorses([]);
      setScrapedPayouts({});
      setScrapedResults([]);
    } else {
      showToast(res.error || "保存に失敗しました");
    }
  };

  // Handle Delete Memo
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("このメモを削除してもよろしいですか？")) {
      const res = await deleteMemo(id);
      if (res.success) {
        await refreshMemos();
        if (activeMemoId === id) setActiveMemoId(null);
        showToast("メモを削除しました");
      } else {
        showToast(res.error || "削除に失敗しました");
      }
    }
  };

  return (
    <div className="container animate-fade-in">
      {/* Toast Notification */}
      {toastMessage && (
        <div className={styles.toast}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {toastMessage}
        </div>
      )}

      {/* Main Dashboard Layout */}
      <div className={styles.dashboard}>
        {/* Header Block */}
        <header className={styles.header}>
          <div className={styles.titleArea}>
            <h1>
              <span className="text-gradient">KeibaLogger</span>
              <span className={styles.tagline}>競馬予想＆収支ログ</span>
            </h1>
            <p
              style={{
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                display: "flex",
                gap: "0.5rem",
              }}
            >
              <span>🗄️ SQLite データベース接続中</span>
              <span>💾 BOX・流し・フォーメーション対応</span>
            </p>
          </div>

          {/* Quick Statistics Panels */}
          <div className={styles.statsGrid}>
            <div className={`${styles.statCard} ${styles.statCardIncome} card`}>
              <div className={styles.statLabel}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-emerald)"
                  strokeWidth="2.5"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
                通算収支
              </div>
              <div
                className={`${styles.statValue} ${totalIncome >= 0 ? styles.incomePositive : styles.incomeNegative}`}
              >
                {totalIncome >= 0 ? "+" : ""}
                {totalIncome.toLocaleString()} 円
              </div>
              <div className={styles.statSub}>
                投資: {totalInvestment.toLocaleString()}円 / 回収:{" "}
                {totalPayout.toLocaleString()}円
              </div>
            </div>

            <div
              className={`${styles.statCard} ${styles.statCardRecovery} card`}
            >
              <div className={styles.statLabel}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-gold)"
                  strokeWidth="2.5"
                >
                  <path d="M23 6l-9.5 9.5-5-5L1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
                回収率
              </div>
              <div className={`${styles.statValue} text-gold-gradient`}>
                {recoveryRate}%
              </div>
              <div className={styles.statSub}>目標: 100%超え</div>
            </div>

            <div
              className={`${styles.statCard} ${styles.statCardHitRate} card`}
            >
              <div className={styles.statLabel}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--color-blue)"
                  strokeWidth="2.5"
                >
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
                的中率
              </div>
              <div
                className={styles.statValue}
                style={{ color: "var(--color-blue)" }}
              >
                {hitRate}%
              </div>
              <div className={styles.statSub}>
                的中: {hitRaces}レース / 全 {totalRacesWithResult} レース
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard 2-Column Content */}
        <div className={styles.contentGrid}>
          {/* Left Column: Input Form */}
          <div className="card">
            <h2 className={styles.sectionTitle}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-emerald)"
                strokeWidth="2.5"
              >
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z" />
              </svg>
              予想・結果を記録する
            </h2>

            {/* Smart URL Fetch Input */}
            <div className={styles.fetchBox}>
              <div className={styles.fetchText}>
                <strong>ネット競馬等のURL・IDから自動入力</strong>
                <div
                  style={{
                    fontSize: "0.7rem",
                    opacity: 0.8,
                    marginTop: "0.15rem",
                  }}
                >
                  出走馬やレース後の払戻金、結果着順を自動取得できます
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.25rem",
                  width: "100%",
                  maxWidth: "160px",
                }}
              >
                <input
                  type="text"
                  className="input-control"
                  placeholder="URLまたはレースID"
                  style={{ padding: "0.4rem", fontSize: "0.75rem" }}
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-primary"
                  style={{
                    padding: "0.4rem 0.6rem",
                    fontSize: "0.75rem",
                    borderRadius: "8px",
                  }}
                  onClick={handleFetchRaceInfo}
                  disabled={isFetching}
                >
                  {isFetching ? "取得中..." : "取得"}
                </button>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className={styles.formGroup}>
                  <label htmlFor="date-input">日付</label>
                  <input
                    id="date-input"
                    type="date"
                    className="input-control"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="track-select">開催場</label>
                  <select
                    id="track-select"
                    className="input-control"
                    value={track}
                    onChange={(e) => setTrack(e.target.value)}
                  >
                    {[
                      "東京",
                      "中山",
                      "京都",
                      "阪神",
                      "新潟",
                      "中京",
                      "小倉",
                      "福島",
                      "函館",
                      "札幌",
                      "地方",
                      "海外",
                    ].map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div
                  className={styles.formGroup}
                  style={{ gridColumn: "span 1" }}
                >
                  <label htmlFor="race-number-select">レース番号</label>
                  <select
                    id="race-number-select"
                    className="input-control"
                    value={raceNumber}
                    onChange={(e) => setRaceNumber(e.target.value)}
                  >
                    {Array.from({ length: 12 }, (_, i) => String(i + 1)).map(
                      (n) => (
                        <option key={n} value={n}>
                          {n}R
                        </option>
                      ),
                    )}
                  </select>
                </div>
                <div
                  className={styles.formGroup}
                  style={{ gridColumn: "span 1" }}
                >
                  <label htmlFor="race-name-input">レース名</label>
                  <input
                    id="race-name-input"
                    type="text"
                    className="input-control"
                    placeholder="例: 有馬記念 (G1)"
                    value={raceName}
                    onChange={(e) => setRaceName(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Predictions */}
              <div className={styles.formGroup}>
                <label>自分の印・予想</label>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.5rem",
                  }}
                >
                  <div className={styles.markInputWrapper}>
                    <span className="mark-badge mark-honmei active">◎</span>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="本命馬名 / 馬番 (例: 15 ドウデュース)"
                      value={honmei}
                      onChange={(e) => setHonmei(e.target.value)}
                    />
                  </div>
                  <div className={styles.markInputWrapper}>
                    <span className="mark-badge mark-taiko active">◯</span>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="対抗馬名 / 馬番 (例: 6 ジャスティンパレス)"
                      value={taiko}
                      onChange={(e) => setTaiko(e.target.value)}
                    />
                  </div>
                  <div className={styles.markInputWrapper}>
                    <span className="mark-badge mark-anago active">▲</span>
                    <input
                      id="anago-input"
                      type="text"
                      className="input-control"
                      placeholder="単穴馬名 / 馬番 (複数可)"
                      value={anago}
                      onChange={(e) => setAnago(e.target.value)}
                    />
                  </div>
                  <div className={styles.markInputWrapper}>
                    <span className="mark-badge mark-renge active">△</span>
                    <input
                      id="renge-input"
                      type="text"
                      className="input-control"
                      placeholder="連下馬名 / 馬番 (複数可)"
                      value={renge}
                      onChange={(e) => setRenge(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Fetched Horses List */}
              {fetchedHorses.length > 0 && (
                <div className={styles.fetchedHorsesSection}>
                  <div className={styles.fetchedHorsesTitle}>
                    取得された出走馬 (馬番順・クリックで印にコピー)
                  </div>
                  <div className={styles.fetchedHorsesList}>
                    {fetchedHorses.map((horse) => {
                      const wakuStyle = WAKU_COLORS[horse.waku] || {
                        bg: "var(--bg-tertiary)",
                        text: "var(--text-primary)",
                        border: "transparent",
                      };

                      return (
                        <div
                          key={horse.umaban}
                          className={styles.fetchedHorseItem}
                        >
                          <div
                            style={{ display: "flex", alignItems: "center" }}
                          >
                            {/* Waku Badge */}
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "22px",
                                height: "22px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: "800",
                                backgroundColor: wakuStyle.bg,
                                color: wakuStyle.text,
                                border:
                                  wakuStyle.border !== "transparent"
                                    ? `1px solid ${wakuStyle.border}`
                                    : "none",
                                marginRight: "0.4rem",
                              }}
                            >
                              {horse.waku}
                            </span>
                            {/* Umaban Badge */}
                            <span
                              style={{
                                fontWeight: "700",
                                fontSize: "0.85rem",
                                marginRight: "0.5rem",
                                color: "var(--color-gold)",
                                minWidth: "16px",
                              }}
                            >
                              {horse.umaban}
                            </span>
                            <span className={styles.fetchedHorseName}>
                              {horse.horseName}
                            </span>
                          </div>

                          <div className={styles.quickMarkGroup}>
                            <button
                              type="button"
                              className={`${styles.quickMarkBtn} ${styles.quickMarkBtnHonmei}`}
                              onClick={() => handleQuickMark(horse, "honmei")}
                            >
                              ◎
                            </button>
                            <button
                              type="button"
                              className={`${styles.quickMarkBtn} ${styles.quickMarkBtnTaiko}`}
                              onClick={() => handleQuickMark(horse, "taiko")}
                            >
                              ◯
                            </button>
                            <button
                              type="button"
                              className={`${styles.quickMarkBtn} ${styles.quickMarkBtnAnago}`}
                              onClick={() => handleQuickMark(horse, "anago")}
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              className={`${styles.quickMarkBtn} ${styles.quickMarkBtnRenge}`}
                              onClick={() => handleQuickMark(horse, "renge")}
                            >
                              △
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Scraped Race Results Table */}
              {scrapedResults.length > 0 && (
                <div
                  className={styles.payoutDisplayBox}
                  style={{
                    borderColor: "rgba(16, 185, 129, 0.2)",
                    background: "rgba(16, 185, 129, 0.03)",
                  }}
                >
                  <div
                    className={styles.payoutDisplayTitle}
                    style={{ color: "var(--color-emerald)" }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                    </svg>
                    取得された確定結果 (1〜5着)
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                      fontSize: "0.8rem",
                    }}
                  >
                    {scrapedResults.map((res) => (
                      <div
                        key={res.rank}
                        style={{
                          background: "var(--bg-tertiary)",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "6px",
                          border: "1px solid var(--border-color)",
                          display: "flex",
                          gap: "0.35rem",
                        }}
                      >
                        <span
                          style={{
                            fontWeight: "800",
                            color:
                              res.rank === 1
                                ? "var(--color-gold)"
                                : res.rank === 2
                                  ? "var(--text-secondary)"
                                  : "var(--text-muted)",
                          }}
                        >
                          {res.rank}着
                        </span>
                        <span style={{ fontWeight: "600" }}>
                          {res.horseNumber}
                        </span>
                        <span>{res.horseName}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scraped Dividends Table */}
              {Object.keys(scrapedPayouts).length > 0 && (
                <div className={styles.payoutDisplayBox}>
                  <div className={styles.payoutDisplayTitle}>
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                    >
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    取得された確定払戻金 (100円あたり)
                  </div>
                  <div className={styles.payoutGrid}>
                    {Object.entries(scrapedPayouts).map(([type, list]) => (
                      <div key={type} className={styles.payoutItem}>
                        <div className={styles.payoutType}>{type}</div>
                        {list.slice(0, 3).map((item, idx) => (
                          <div key={idx} className={styles.payoutDetail}>
                            <span>{item.selection}</span>
                            <span
                              style={{
                                color: "var(--color-gold)",
                                fontWeight: "600",
                              }}
                            >
                              {item.amount.toLocaleString()}円
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Tickets List */}
              <div style={{ marginTop: "1.25rem" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "0.875rem",
                    fontWeight: "600",
                    color: "var(--text-secondary)",
                    marginBottom: "0.5rem",
                  }}
                >
                  購入馬券
                </label>
                <div className={styles.ticketListContainer}>
                  {tickets.map((ticket, index) => {
                    const expanded = expandTicketSelection(
                      ticket.type,
                      ticket.selection,
                    );
                    const isCombo =
                      expanded.length > 0 && ticket.selection.trim().length > 0;

                    return (
                      <div key={index} className={styles.ticketRow}>
                        <select
                          className="input-control"
                          style={{ padding: "0.45rem" }}
                          value={ticket.type}
                          onChange={(e) =>
                            handleTicketChange(index, "type", e.target.value)
                          }
                        >
                          {[
                            "単勝",
                            "複勝",
                            "応援馬券",
                            "枠連",
                            "馬連",
                            "馬単",
                            "ワイド",
                            "3連複",
                            "3連単",
                          ].map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>

                        <div
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="text"
                            className="input-control"
                            style={{ padding: "0.45rem", width: "100%" }}
                            placeholder="買い目 (例: BOX 3,5,6 / 1-2,3)"
                            value={ticket.selection}
                            onChange={(e) =>
                              handleTicketChange(
                                index,
                                "selection",
                                e.target.value,
                              )
                            }
                            required
                          />
                          {isCombo && (
                            <span
                              style={{
                                position: "absolute",
                                right: "5px",
                                background: "rgba(59, 130, 246, 0.2)",
                                color: "var(--color-blue)",
                                fontSize: "0.65rem",
                                padding: "0.1rem 0.3rem",
                                borderRadius: "4px",
                                fontWeight: "bold",
                              }}
                            >
                              {expanded.length}点
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            position: "relative",
                            display: "flex",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="number"
                            className="input-control"
                            style={{ padding: "0.45rem", width: "100%" }}
                            placeholder="投資額"
                            value={ticket.investment || ""}
                            onChange={(e) =>
                              handleTicketChange(
                                index,
                                "investment",
                                e.target.value,
                              )
                            }
                            required
                          />
                          {ticket.type === "応援馬券" && (
                            <span
                              style={{
                                position: "absolute",
                                right: "5px",
                                background: "rgba(239, 68, 68, 0.2)",
                                color: "var(--color-rose)",
                                fontSize: "0.6rem",
                                padding: "0.1rem 0.25rem",
                                borderRadius: "4px",
                                fontWeight: "bold",
                              }}
                            >
                              ×2
                            </span>
                          )}
                        </div>

                        <input
                          type="number"
                          className="input-control"
                          style={{ padding: "0.45rem" }}
                          placeholder="払戻額"
                          value={ticket.payout || ""}
                          onChange={(e) =>
                            handleTicketChange(index, "payout", e.target.value)
                          }
                        />

                        <button
                          type="button"
                          className={styles.removeTicketBtn}
                          onClick={() => handleRemoveTicket(index)}
                          disabled={tickets.length === 1}
                          title="この馬券を削除"
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    );
                  })}

                  <div className={styles.ticketBtnGroup}>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.addTicketBtn}`}
                      onClick={handleAddTicket}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      馬券を追加
                    </button>

                    {Object.keys(scrapedPayouts).length > 0 && (
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.autoCalcBtn}`}
                        onClick={handleAutoCalculatePayouts}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                        >
                          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                          <polyline points="22 4 12 14.01 9 11.01" />
                        </svg>
                        払戻金を自動計算
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Text Memo */}
              <div className={styles.formGroup} style={{ marginTop: "1rem" }}>
                <label htmlFor="memo-textarea">予想根拠・振り返りメモ</label>
                <textarea
                  id="memo-textarea"
                  className="input-control"
                  rows={3}
                  placeholder="馬場状態や展開予想、レース後の振り返りをメモ..."
                  value={memoText}
                  onChange={(e) => setMemoText(e.target.value)}
                  style={{ resize: "vertical" }}
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary btn-glow"
                style={{ width: "100%", marginTop: "0.5rem" }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                >
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                ログを保存する
              </button>
            </form>
          </div>

          {/* Right Column: Logs List */}
          <div className={`${styles.historyCard} card`}>
            <h2 className={styles.sectionTitle}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--color-gold)"
                strokeWidth="2.5"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
              ログ履歴 ({memos.length}件)
            </h2>

            <div className={styles.scrollArea}>
              {memos.length === 0 ? (
                <div className={styles.noMemos}>
                  <p>まだ記録はありません。</p>
                  <p style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                    左のフォームから最初の予想や収支を保存してください。
                  </p>
                </div>
              ) : (
                memos.map((memo) => {
                  if (!memo.id) return null;

                  // Aggregate totals for this memo (accounting for Support wagers)
                  const totalInvest = memo.tickets.reduce(
                    (sum, t) => sum + getTicketCost(t),
                    0,
                  );
                  const totalPay = memo.tickets.reduce(
                    (sum, t) => sum + t.payout,
                    0,
                  );
                  const diff = totalPay - totalInvest;

                  const isPending = memo.result === "pending";
                  const isHit = memo.result === "hit";

                  return (
                    <div key={memo.id} className={styles.memoItem}>
                      {/* Summary Row */}
                      <div
                        className={styles.memoHeader}
                        onClick={() => toggleDetail(memo.id!)}
                      >
                        <div className={styles.memoInfo}>
                          <div className={styles.raceMeta}>
                            <span>{memo.date}</span>
                            <span className={styles.raceTrackBadge}>
                              {memo.track} {memo.raceNumber}R
                            </span>
                          </div>
                          <div className={styles.raceTitle}>
                            {memo.raceName}
                            {isHit && (
                              <span style={{ fontSize: "0.9rem" }}>🎯</span>
                            )}
                          </div>
                        </div>

                        <div className={styles.memoIncome}>
                          <div
                            className={`
                            ${styles.incomeValue} 
                            ${
                              isPending
                                ? styles.incomeZero
                                : diff > 0
                                  ? styles.incomePositive
                                  : diff < 0
                                    ? styles.incomeNegative
                                    : styles.incomeZero
                            }
                          `}
                          >
                            {isPending
                              ? "結果待ち"
                              : `${diff >= 0 ? "+" : ""}${diff.toLocaleString()}円`}
                          </div>
                          <span className={styles.ticketTypeBadge}>
                            {memo.tickets.length > 0
                              ? `${memo.tickets[0].type}他 ${memo.tickets.length}件`
                              : "馬券なし"}
                          </span>
                        </div>
                      </div>

                      {/* Detail Expand Area */}
                      {activeMemoId === memo.id && (
                        <div className={styles.memoDetail}>
                          {/* Prediction Badges */}
                          <div className={styles.predictionsBox}>
                            <div className={styles.predItem}>
                              <span
                                className="mark-badge mark-honmei active"
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  fontSize: "0.75rem",
                                }}
                              >
                                ◎
                              </span>
                              <span className={styles.predText}>
                                {memo.prediction.honmei || "無印"}
                              </span>
                            </div>
                            <div className={styles.predItem}>
                              <span
                                className="mark-badge mark-taiko active"
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  fontSize: "0.75rem",
                                }}
                              >
                                ◯
                              </span>
                              <span className={styles.predText}>
                                {memo.prediction.taiko || "無印"}
                              </span>
                            </div>
                            <div className={styles.predItem}>
                              <span
                                className="mark-badge mark-anago active"
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  fontSize: "0.75rem",
                                }}
                              >
                                ▲
                              </span>
                              <span className={styles.predText}>
                                {memo.prediction.anago || "無印"}
                              </span>
                            </div>
                            <div className={styles.predItem}>
                              <span
                                className="mark-badge mark-renge active"
                                style={{
                                  width: "22px",
                                  height: "22px",
                                  fontSize: "0.75rem",
                                }}
                              >
                                △
                              </span>
                              <span className={styles.predText}>
                                {memo.prediction.renge || "無印"}
                              </span>
                            </div>
                          </div>

                          {/* Saved Race Results (Finishing positions) */}
                          {memo.resultList && memo.resultList.length > 0 && (
                            <div>
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  fontWeight: "600",
                                  color: "var(--text-secondary)",
                                  marginBottom: "0.35rem",
                                }}
                              >
                                確定結果 (着順)
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "0.4rem",
                                  flexWrap: "wrap",
                                  fontSize: "0.75rem",
                                  marginBottom: "0.5rem",
                                }}
                              >
                                {memo.resultList.map((res) => (
                                  <div
                                    key={res.rank}
                                    style={{
                                      background: "rgba(255, 255, 255, 0.02)",
                                      padding: "0.25rem 0.5rem",
                                      borderRadius: "6px",
                                      border: "1px solid var(--border-color)",
                                      display: "flex",
                                      gap: "0.35rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontWeight: "800",
                                        color:
                                          res.rank === 1
                                            ? "var(--color-gold)"
                                            : res.rank === 2
                                              ? "var(--text-secondary)"
                                              : "var(--text-muted)",
                                      }}
                                    >
                                      {res.rank}着
                                    </span>
                                    <span style={{ fontWeight: "600" }}>
                                      {res.horseNumber}
                                    </span>
                                    <span>{res.horseName}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Purchased Tickets Detail Table */}
                          {memo.tickets.length > 0 && (
                            <div style={{ marginTop: "0.25rem" }}>
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  fontWeight: "600",
                                  color: "var(--text-secondary)",
                                  marginBottom: "0.25rem",
                                }}
                              >
                                購入した馬券
                              </div>
                              <table className={styles.logTicketsTable}>
                                <thead>
                                  <tr>
                                    <th>式別</th>
                                    <th>買い目</th>
                                    <th>投資額</th>
                                    <th>払戻額</th>
                                    <th>結果</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {memo.tickets.map((t, idx) => {
                                    const actualCost = getTicketCost(t);
                                    const expanded = expandTicketSelection(
                                      t.type,
                                      t.selection,
                                    );

                                    return (
                                      <tr key={idx}>
                                        <td>{t.type}</td>
                                        <td
                                          style={{
                                            fontFamily:
                                              "var(--font-outfit), sans-serif",
                                            fontWeight: "600",
                                          }}
                                        >
                                          {t.selection}
                                          {expanded.length > 1 && (
                                            <span
                                              style={{
                                                fontSize: "0.7rem",
                                                color: "var(--color-blue)",
                                                fontWeight: "bold",
                                                marginLeft: "0.25rem",
                                              }}
                                            >
                                              ({expanded.length}点)
                                            </span>
                                          )}
                                        </td>
                                        <td>
                                          {actualCost.toLocaleString()}円
                                          {t.type === "応援馬券" && (
                                            <span
                                              style={{
                                                fontSize: "0.7rem",
                                                opacity: 0.6,
                                                marginLeft: "0.2rem",
                                              }}
                                            >
                                              (単{t.investment} / 複
                                              {t.investment})
                                            </span>
                                          )}
                                        </td>
                                        <td>{t.payout.toLocaleString()}円</td>
                                        <td
                                          style={{
                                            fontWeight: "bold",
                                            color:
                                              t.payout > 0
                                                ? "var(--color-emerald)"
                                                : actualCost > 0 &&
                                                    t.payout === 0
                                                  ? "var(--color-rose)"
                                                  : "var(--text-secondary)",
                                          }}
                                        >
                                          {t.payout > 0
                                            ? "的中 🎯"
                                            : actualCost > 0 && t.payout === 0
                                              ? "不的中 💸"
                                              : "返還/未確定"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          )}

                          {/* Notes */}
                          {memo.memoText && (
                            <div className={styles.memoTextBox}>
                              <div className={styles.memoTextTitle}>
                                考察・メモ
                              </div>
                              <div className={styles.memoTextContent}>
                                {memo.memoText}
                              </div>
                            </div>
                          )}

                          {/* Footer details */}
                          <div className={styles.detailFooter}>
                            <div className={styles.detailStats}>
                              <span>
                                総投資: {totalInvest.toLocaleString()}円
                              </span>
                              <span>総払戻: {totalPay.toLocaleString()}円</span>
                            </div>
                            <button
                              className={styles.deleteBtn}
                              onClick={(e) => handleDelete(memo.id!, e)}
                            >
                              削除
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
