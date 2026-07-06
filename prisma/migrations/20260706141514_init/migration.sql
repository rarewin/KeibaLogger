-- CreateTable
CREATE TABLE "Memo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" TEXT NOT NULL,
    "track" TEXT NOT NULL,
    "raceNumber" TEXT NOT NULL,
    "raceName" TEXT NOT NULL,
    "honmei" TEXT NOT NULL,
    "taiko" TEXT NOT NULL,
    "anago" TEXT NOT NULL,
    "renge" TEXT NOT NULL,
    "memoText" TEXT NOT NULL,
    "ticketType" TEXT NOT NULL,
    "investment" INTEGER NOT NULL,
    "payout" INTEGER NOT NULL,
    "result" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
