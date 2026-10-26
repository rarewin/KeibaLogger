"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../lib/prisma";

export interface TicketData {
  id?: string;
  type: string;
  selection: string;
  investment: number;
  payout: number;
  isHit: boolean;
}

export interface RaceResult {
  rank: number;
  horseNumber: string;
  horseName: string;
  jockey?: string;
}

export interface ScrapedHorse {
  waku: number;
  umaban: number;
  horseName: string;
  jockey?: string;
}

export interface MemoData {
  id?: string;
  date: string;
  track: string;
  raceNumber: string;
  raceName: string;
  prediction: {
    honmei: string;
    taiko: string;
    anago: string;
    renge: string;
  };
  memoText: string;
  result: "hit" | "miss" | "pending";
  resultList?: RaceResult[]; // Local variable mapped to resultList JSON in DB
  netkeibaUrl?: string; // URL to netkeiba race page
  fetchedHorses?: ScrapedHorse[]; // Serialized JSON of all scraped runners in DB
  createdAt?: string;
  tickets: TicketData[];
}

export type ImportMode = "merge" | "replace";

// Get all memos from SQLite, including their tickets and parsed results
export async function getMemos(): Promise<MemoData[]> {
  try {
    const memos = await prisma.memo.findMany({
      include: {
        tickets: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Format output to match client-side structured schema
    return memos.map((m) => {
      let parsedResults: RaceResult[] = [];
      try {
        parsedResults = m.resultList ? JSON.parse(m.resultList) : [];
      } catch (e) {
        console.warn("Failed to parse resultList JSON:", e);
      }

      let parsedHorses: ScrapedHorse[] = [];
      try {
        parsedHorses = m.fetchedHorses ? JSON.parse(m.fetchedHorses) : [];
      } catch (e) {
        console.warn("Failed to parse fetchedHorses JSON:", e);
      }

      return {
        id: m.id,
        date: m.date,
        track: m.track,
        raceNumber: m.raceNumber,
        raceName: m.raceName,
        prediction: {
          honmei: m.honmei,
          taiko: m.taiko,
          anago: m.anago,
          renge: m.renge,
        },
        memoText: m.memoText,
        result: m.result as "hit" | "miss" | "pending",
        resultList: parsedResults,
        netkeibaUrl: m.netkeibaUrl || undefined,
        fetchedHorses: parsedHorses,
        createdAt: m.createdAt.toISOString(),
        tickets: m.tickets.map((t) => ({
          id: t.id,
          type: t.type,
          selection: t.selection,
          investment: t.investment,
          payout: t.payout,
          isHit: t.isHit,
        })),
      };
    });
  } catch (error) {
    console.error("Error fetching memos:", error);
    return [];
  }
}

// Add or Update a memo with its tickets and results in SQLite
export async function saveMemo(data: Omit<MemoData, "id"> & { id?: string }) {
  try {
    const serializedResults = data.resultList
      ? JSON.stringify(data.resultList)
      : "[]";

    const serializedHorses = data.fetchedHorses
      ? JSON.stringify(data.fetchedHorses)
      : "[]";

    const dbData = {
      date: data.date,
      track: data.track,
      raceNumber: data.raceNumber,
      raceName: data.raceName,
      honmei: data.prediction.honmei,
      taiko: data.prediction.taiko,
      anago: data.prediction.anago,
      renge: data.prediction.renge,
      memoText: data.memoText,
      result: data.result,
      resultList: serializedResults,
      netkeibaUrl: data.netkeibaUrl || null,
      fetchedHorses: serializedHorses,
    };

    if (data.id) {
      // Update within a transactional scope
      const memo = await prisma.$transaction(async (tx) => {
        // 1. Delete all existing tickets for this memo
        await tx.ticket.deleteMany({
          where: { memoId: data.id },
        });

        // 2. Update the Memo and insert new tickets
        return await tx.memo.update({
          where: { id: data.id },
          data: {
            ...dbData,
            tickets: {
              create: data.tickets.map((t) => ({
                type: t.type,
                selection: t.selection,
                investment: t.investment,
                payout: t.payout,
                isHit: t.isHit,
              })),
            },
          },
        });
      });
      revalidatePath("/");
      return { success: true, id: memo.id };
    }

    // Create a new Memo with its nested tickets
    const memo = await prisma.memo.create({
      data: {
        ...dbData,
        tickets: {
          create: data.tickets.map((t) => ({
            type: t.type,
            selection: t.selection,
            investment: t.investment,
            payout: t.payout,
            isHit: t.isHit,
          })),
        },
      },
    });
    revalidatePath("/");
    return { success: true, id: memo.id };
  } catch (error) {
    console.error("Error saving memo:", error);
    return { success: false, error: "データベースの保存に失敗しました" };
  }
}

// Delete a memo from SQLite
export async function deleteMemo(id: string) {
  try {
    await prisma.memo.delete({
      where: { id },
    });
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    console.error("Error deleting memo:", error);
    return { success: false, error: "データベースの削除に失敗しました" };
  }
}

interface NormalizedTicketInput {
  type: string;
  selection: string;
  investment: number;
  payout: number;
  isHit: boolean;
}

interface NormalizedMemoInput {
  id?: string;
  date: string;
  track: string;
  raceNumber: string;
  raceName: string;
  honmei: string;
  taiko: string;
  anago: string;
  renge: string;
  memoText: string;
  result: "hit" | "miss" | "pending";
  resultList: string;
  netkeibaUrl: string | null;
  fetchedHorses: string;
  createdAt?: Date;
  tickets: NormalizedTicketInput[];
}

function normalizeImportMemos(payload: unknown): NormalizedMemoInput[] {
  let rawList: unknown[] = [];

  if (Array.isArray(payload)) {
    rawList = payload;
  } else if (
    payload &&
    typeof payload === "object" &&
    "memos" in payload &&
    Array.isArray((payload as { memos: unknown }).memos)
  ) {
    rawList = (payload as { memos: unknown[] }).memos;
  } else {
    throw new Error(
      "JSONの形式が正しくありません（memos配列が見つかりません）",
    );
  }

  return rawList.map((item, idx) => {
    if (!item || typeof item !== "object") {
      throw new Error(`${idx + 1}件目のデータが不正な形式です`);
    }

    const rec = item as Record<string, unknown>;
    const date = typeof rec.date === "string" ? rec.date.trim() : "";
    const track = typeof rec.track === "string" ? rec.track.trim() : "";
    const raceNumber =
      typeof rec.raceNumber === "string" || typeof rec.raceNumber === "number"
        ? String(rec.raceNumber).trim()
        : "";

    if (!date || !track || !raceNumber) {
      throw new Error(
        `${idx + 1}件目のデータに必須項目（日付・開催場・レース番号）が不足しています`,
      );
    }

    const prediction =
      rec.prediction && typeof rec.prediction === "object"
        ? (rec.prediction as Record<string, unknown>)
        : {};

    const honmei =
      typeof prediction.honmei === "string"
        ? prediction.honmei
        : typeof rec.honmei === "string"
          ? rec.honmei
          : "";
    const taiko =
      typeof prediction.taiko === "string"
        ? prediction.taiko
        : typeof rec.taiko === "string"
          ? rec.taiko
          : "";
    const anago =
      typeof prediction.anago === "string"
        ? prediction.anago
        : typeof rec.anago === "string"
          ? rec.anago
          : "";
    const renge =
      typeof prediction.renge === "string"
        ? prediction.renge
        : typeof rec.renge === "string"
          ? rec.renge
          : "";

    const rawResult = typeof rec.result === "string" ? rec.result : "pending";
    const result: "hit" | "miss" | "pending" =
      rawResult === "hit" || rawResult === "miss" || rawResult === "pending"
        ? rawResult
        : "pending";

    let serializedResults = "[]";
    if (Array.isArray(rec.resultList)) {
      serializedResults = JSON.stringify(rec.resultList);
    } else if (typeof rec.resultList === "string") {
      try {
        const parsed = JSON.parse(rec.resultList);
        serializedResults = Array.isArray(parsed)
          ? JSON.stringify(parsed)
          : "[]";
      } catch {
        serializedResults = "[]";
      }
    }

    let serializedHorses = "[]";
    if (Array.isArray(rec.fetchedHorses)) {
      serializedHorses = JSON.stringify(rec.fetchedHorses);
    } else if (typeof rec.fetchedHorses === "string") {
      try {
        const parsed = JSON.parse(rec.fetchedHorses);
        serializedHorses = Array.isArray(parsed)
          ? JSON.stringify(parsed)
          : "[]";
      } catch {
        serializedHorses = "[]";
      }
    }

    let createdAt: Date | undefined;
    if (typeof rec.createdAt === "string" && rec.createdAt.trim()) {
      const parsedDate = new Date(rec.createdAt);
      if (!Number.isNaN(parsedDate.getTime())) {
        createdAt = parsedDate;
      }
    }

    const rawTickets = Array.isArray(rec.tickets) ? rec.tickets : [];
    const tickets: NormalizedTicketInput[] = rawTickets
      .filter((t): t is Record<string, unknown> =>
        Boolean(t && typeof t === "object"),
      )
      .map((t) => ({
        type:
          typeof t.type === "string" && t.type.trim() ? t.type.trim() : "単勝",
        selection: typeof t.selection === "string" ? t.selection.trim() : "",
        investment:
          typeof t.investment === "number" && Number.isFinite(t.investment)
            ? Math.max(0, Math.round(t.investment))
            : Number(t.investment) >= 0
              ? Math.round(Number(t.investment))
              : 0,
        payout:
          typeof t.payout === "number" && Number.isFinite(t.payout)
            ? Math.max(0, Math.round(t.payout))
            : Number(t.payout) >= 0
              ? Math.round(Number(t.payout))
              : 0,
        isHit: Boolean(t.isHit),
      }));

    return {
      id:
        typeof rec.id === "string" && rec.id.trim() ? rec.id.trim() : undefined,
      date,
      track,
      raceNumber,
      raceName: typeof rec.raceName === "string" ? rec.raceName : "",
      honmei,
      taiko,
      anago,
      renge,
      memoText: typeof rec.memoText === "string" ? rec.memoText : "",
      result,
      resultList: serializedResults,
      netkeibaUrl:
        typeof rec.netkeibaUrl === "string" && rec.netkeibaUrl.trim()
          ? rec.netkeibaUrl.trim()
          : null,
      fetchedHorses: serializedHorses,
      createdAt,
      tickets,
    };
  });
}

// Import memos from parsed JSON data into SQLite
export async function importMemos(
  payload: unknown,
  mode: ImportMode = "merge",
): Promise<{
  success: boolean;
  count?: number;
  addedCount?: number;
  updatedCount?: number;
  error?: string;
}> {
  try {
    const normalizedMemos = normalizeImportMemos(payload);

    let addedCount = 0;
    let updatedCount = 0;

    await prisma.$transaction(async (tx) => {
      if (mode === "replace") {
        await tx.ticket.deleteMany({});
        await tx.memo.deleteMany({});

        const seenIds = new Set<string>();
        for (const m of normalizedMemos) {
          const useId = m.id && !seenIds.has(m.id) ? m.id : undefined;
          if (useId) seenIds.add(useId);

          await tx.memo.create({
            data: {
              ...(useId ? { id: useId } : {}),
              date: m.date,
              track: m.track,
              raceNumber: m.raceNumber,
              raceName: m.raceName,
              honmei: m.honmei,
              taiko: m.taiko,
              anago: m.anago,
              renge: m.renge,
              memoText: m.memoText,
              result: m.result,
              resultList: m.resultList,
              netkeibaUrl: m.netkeibaUrl,
              fetchedHorses: m.fetchedHorses,
              ...(m.createdAt ? { createdAt: m.createdAt } : {}),
              tickets: {
                create: m.tickets,
              },
            },
          });
          addedCount++;
        }
      } else {
        // Merge (Upsert by ID if present, otherwise create)
        for (const m of normalizedMemos) {
          const dbFields = {
            date: m.date,
            track: m.track,
            raceNumber: m.raceNumber,
            raceName: m.raceName,
            honmei: m.honmei,
            taiko: m.taiko,
            anago: m.anago,
            renge: m.renge,
            memoText: m.memoText,
            result: m.result,
            resultList: m.resultList,
            netkeibaUrl: m.netkeibaUrl,
            fetchedHorses: m.fetchedHorses,
          };

          if (m.id) {
            const existing = await tx.memo.findUnique({
              where: { id: m.id },
              select: { id: true },
            });

            if (existing) {
              await tx.ticket.deleteMany({
                where: { memoId: m.id },
              });
              await tx.memo.update({
                where: { id: m.id },
                data: {
                  ...dbFields,
                  tickets: {
                    create: m.tickets,
                  },
                },
              });
              updatedCount++;
              continue;
            }
          }

          await tx.memo.create({
            data: {
              ...(m.id ? { id: m.id } : {}),
              ...dbFields,
              ...(m.createdAt ? { createdAt: m.createdAt } : {}),
              tickets: {
                create: m.tickets,
              },
            },
          });
          addedCount++;
        }
      }
    });

    revalidatePath("/");
    return {
      success: true,
      count: normalizedMemos.length,
      addedCount,
      updatedCount,
    };
  } catch (error) {
    console.error("Error importing memos:", error);
    const message =
      error instanceof Error
        ? error.message
        : "データのインポートに失敗しました";
    return { success: false, error: message };
  }
}
