"use client";

import { useState, useEffect } from "react";
import { getMemos, saveMemo, deleteMemo, type MemoData } from "./actions";
import styles from "./page.module.css";

// Initial dummy data to seed into SQLite when empty
const INITIAL_MEMOS: Omit<MemoData, "id">[] = [
  {
    date: "2026-06-28",
    track: "阪神",
    raceNumber: "11",
    raceName: "宝塚記念 (G1)",
    prediction: {
      honmei: "ドウデュース",
      taiko: "ジャスティンパレス",
      anago: "ベラジオオペラ",
      renge: "ソールオリエンス",
    },
    memoText:
      "重馬場想定。内側の傷みが激しいため外差しが決まる展開とみる。本命ドウデュースは武豊騎手の神騎乗に期待。結果はドウデュースが素晴らしい末脚で差し切り勝ち。対抗のジャスティンパレスは惜しくも届かず4着だったが、3連複が的中して快勝！",
    ticketType: "3連複",
    investment: 5000,
    payout: 18500,
    result: "hit",
  },
  {
    date: "2026-05-24",
    track: "東京",
    raceNumber: "11",
    raceName: "日本ダービー (G1)",
    prediction: {
      honmei: "ジャスティンミラノ",
      taiko: "レガレイラ",
      anago: "シックスペンス",
      renge: "ダノンデサイル",
    },
    memoText:
      "スローペース濃厚。先行できるジャスティンミラノを軸にする。ダノンデサイルは馬場状態が合えば一発あると思い連下に。結果はダノンデサイルがインを突いて快勝。本命ジャスティンミラノが2着で馬連はハズレ。ダービーの難しさを改めて実感。",
    ticketType: "馬連",
    investment: 3000,
    payout: 0,
    result: "miss",
  },
];

export default function Home() {
  const [memos, setMemos] = useState<MemoData[]>([]);
  const [activeMemoId, setActiveMemoId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

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
  const [ticketType, setTicketType] = useState("単勝");
  const [investment, setInvestment] = useState("");
  const [payout, setPayout] = useState("");
  const [result, setResult] = useState<"hit" | "miss" | "pending">("pending");
  const [urlInput, setUrlInput] = useState("");

  // Helper to load and sync data from DB
  const refreshMemos = async () => {
    const data = await getMemos();
    if (data.length === 0) {
      // Seed initial dummy data if DB is empty
      for (const item of INITIAL_MEMOS) {
        await saveMemo(item);
      }
      const seeded = await getMemos();
      setMemos(seeded);
    } else {
      setMemos(data);
    }
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

  // Calculate Statistics
  const totalInvestment = memos.reduce((sum, item) => sum + item.investment, 0);
  const totalPayout = memos.reduce((sum, item) => sum + item.payout, 0);
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

  // Handle URL fetch simulation (mock scraper)
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

      // Auto-fill the form with retrieved data
      setDate(data.date || new Date().toISOString().split("T")[0]);
      setTrack(data.track || "東京");
      setRaceNumber(data.raceNumber || "11");
      setRaceName(data.raceName || "");
      setHonmei(data.horses?.[0] || "");
      setTaiko(data.horses?.[1] || "");
      setAnago(data.horses?.[2] || "");
      setRenge(data.horses?.[3] || "");

      showToast(`「${data.raceName}」のレース情報を取得しました！`);
      setUrlInput("");
    } catch (err) {
      // Fallback mock if API fails
      setTimeout(() => {
        setDate(new Date().toISOString().split("T")[0]);
        setTrack("中山");
        setRaceNumber("11");
        setRaceName("有馬記念 (G1)");
        setHonmei("イクイノックス");
        setTaiko("リバティアイランド");
        setAnago("ドウデュース");
        setRenge("タイトルホルダー");
        showToast("有馬記念のモックデータを取得しました！(デモモード)");
      }, 1500);
    } finally {
      setTimeout(() => setIsFetching(false), 1500);
    }
  };

  // Handle Add Memo
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!raceName) {
      showToast("レース名を入力してください");
      return;
    }

    const investNum = Number(investment) || 0;
    const payoutNum = Number(payout) || 0;

    let finalResult = result;
    if (result === "pending" && (investNum > 0 || payoutNum > 0)) {
      finalResult = payoutNum > investNum ? "hit" : "miss";
    }

    const memoPayload: Omit<MemoData, "id"> = {
      date: date || new Date().toISOString().split("T")[0],
      track,
      raceNumber,
      raceName,
      prediction: { honmei, taiko, anago, renge },
      memoText,
      ticketType,
      investment: investNum,
      payout: payoutNum,
      result: finalResult,
    };

    const res = await saveMemo(memoPayload);
    if (res.success) {
      await refreshMemos();
      showToast("メモを保存しました");

      // Reset form fields
      setRaceName("");
      setHonmei("");
      setTaiko("");
      setAnago("");
      setRenge("");
      setMemoText("");
      setInvestment("");
      setPayout("");
      setResult("pending");
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
              <span>💾 リアルタイム保存</span>
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
                  レース情報・出走馬を自動取得して記入の手間を省きます
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
                      placeholder="本命馬名 / 馬番"
                      value={honmei}
                      onChange={(e) => setHonmei(e.target.value)}
                    />
                  </div>
                  <div className={styles.markInputWrapper}>
                    <span className="mark-badge mark-taiko active">◯</span>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="対抗馬名 / 馬番"
                      value={taiko}
                      onChange={(e) => setTaiko(e.target.value)}
                    />
                  </div>
                  <div className={styles.markInputWrapper}>
                    <span className="mark-badge mark-anago active">▲</span>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="単穴馬名 / 馬番"
                      value={anago}
                      onChange={(e) => setAnago(e.target.value)}
                    />
                  </div>
                  <div className={styles.markInputWrapper}>
                    <span className="mark-badge mark-renge active">△</span>
                    <input
                      type="text"
                      className="input-control"
                      placeholder="連下馬名 / 馬番"
                      value={renge}
                      onChange={(e) => setRenge(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Text Memo */}
              <div className={styles.formGroup}>
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

              {/* Financial & Result */}
              <div className="form-row">
                <div className={styles.formGroup}>
                  <label htmlFor="ticket-type-select">馬券種</label>
                  <select
                    id="ticket-type-select"
                    className="input-control"
                    value={ticketType}
                    onChange={(e) => setTicketType(e.target.value)}
                  >
                    {[
                      "単勝",
                      "複勝",
                      "枠連",
                      "馬連",
                      "馬単",
                      "ワイド",
                      "3連複",
                      "3連単",
                      "見送り",
                    ].map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="result-select">的中状況</label>
                  <select
                    id="result-select"
                    className="input-control"
                    value={result}
                    onChange={(e) =>
                      setResult(e.target.value as "hit" | "miss" | "pending")
                    }
                  >
                    <option value="pending">結果待ち / 未確定</option>
                    <option value="hit">🎯 的中</option>
                    <option value="miss">💸 不的中</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className={styles.formGroup}>
                  <label htmlFor="investment-input">投資額 (円)</label>
                  <input
                    id="investment-input"
                    type="number"
                    className="input-control"
                    placeholder="1000"
                    value={investment}
                    onChange={(e) => setInvestment(e.target.value)}
                  />
                </div>
                <div className={styles.formGroup}>
                  <label htmlFor="payout-input">払戻額 (円)</label>
                  <input
                    id="payout-input"
                    type="number"
                    className="input-control"
                    placeholder="0"
                    value={payout}
                    onChange={(e) => setPayout(e.target.value)}
                  />
                </div>
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
                  const diff = memo.payout - memo.investment;
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
                            {memo.ticketType}
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
                                投資: {memo.investment.toLocaleString()}円
                              </span>
                              <span>
                                払戻: {memo.payout.toLocaleString()}円
                              </span>
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
