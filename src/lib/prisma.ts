import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

if (globalForPrisma.prisma) {
  prismaInstance = globalForPrisma.prisma;
} else {
  const databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

  // Pass configuration object directly to PrismaBetterSqlite3 in Prisma v7
  const adapter = new PrismaBetterSqlite3({
    url: databaseUrl,
  });

  prismaInstance = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }
}

export const prisma = prismaInstance;
