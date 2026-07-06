"use server";

import { prisma } from "../lib/prisma";

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
  ticketType: string;
  investment: number;
  payout: number;
  result: "hit" | "miss" | "pending";
}

// Get all memos from SQLite
export async function getMemos() {
  try {
    const memos = await prisma.memo.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    // Format output to match client-side prediction structure
    return memos.map((m) => ({
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
      ticketType: m.ticketType,
      investment: m.investment,
      payout: m.payout,
      result: m.result as "hit" | "miss" | "pending",
    }));
  } catch (error) {
    console.error("Error fetching memos:", error);
    return [];
  }
}

// Add or Update a memo in SQLite
export async function saveMemo(data: Omit<MemoData, "id"> & { id?: string }) {
  try {
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
      ticketType: data.ticketType,
      investment: data.investment,
      payout: data.payout,
      result: data.result,
    };

    if (data.id) {
      // Update
      const memo = await prisma.memo.update({
        where: { id: data.id },
        data: dbData,
      });
      return { success: true, id: memo.id };
    }

    // Create
    const memo = await prisma.memo.create({
      data: dbData,
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
