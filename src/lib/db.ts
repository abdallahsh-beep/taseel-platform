import { PrismaClient } from "@prisma/client";

// حماية عامة: لا تُقرأ تجزئة كلمة المرور في أي استعلام مهما كان (تُستثنى صراحةً في login فقط)
const makeClient = () =>
  new PrismaClient({
    omit: { user: { passwordHash: true } },
  });

const globalForPrisma = globalThis as unknown as { prisma?: ReturnType<typeof makeClient> };

export const db = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
