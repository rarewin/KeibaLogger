import "dotenv/config";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

let prismaInstance: PrismaClient;

if (globalForPrisma.prisma) {
  prismaInstance = globalForPrisma.prisma;
} else {
  let databaseUrl = process.env.DATABASE_URL || "file:./dev.db";

  // Force absolute path resolution if using a relative file path for SQLite
  if (databaseUrl.startsWith("file:.")) {
    const absolutePath = path.join(process.cwd(), "dev.db");
    databaseUrl = `file:${absolutePath}`;
  }

  console.log(
    "[Prisma v7] Resolving absolute SQLite connection URL:",
    databaseUrl,
  );

  const adapter = new PrismaBetterSqlite3({
    url: databaseUrl,
  });

  prismaInstance = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prismaInstance;
  }
}

export const prisma = prismaInstance;
