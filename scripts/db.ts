/**
 * Prisma Client helper for scripts (non-Next.js context)
 */

import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _prisma: any = null;

export async function getScriptPrisma() {
  if (_prisma) return _prisma;

  const dbFile = path.resolve(process.cwd(), "prisma", "dev.db");
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbFile}` });

  const mod = await import("../src/generated/prisma/client.js");
  _prisma = new mod.PrismaClient({ adapter });
  return _prisma;
}
