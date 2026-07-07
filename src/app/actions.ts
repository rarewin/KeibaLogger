"use server";

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
  tickets: TicketData[];
}

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
    return { success: true };
  } catch (error) {
    console.error("Error deleting memo:", error);
    return { success: false, error: "データベースの削除に失敗しました" };
  }
}
