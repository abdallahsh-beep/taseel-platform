import { cookies } from "next/headers";
import crypto from "crypto";
import { db } from "./db";

// في الإنتاج يجب ضبط SESSION_SECRET صراحةً؛ لا نعتمد على قيمة افتراضية معروفة
if (process.env.NODE_ENV === "production" && !process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET مطلوب في بيئة الإنتاج — اضبطه في متغيرات البيئة");
}
const SECRET = process.env.SESSION_SECRET ?? "dev-only-secret-do-not-use-in-production";
const COOKIE = "taseel_session";

export const ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  supervisor: "مشرف / مراجع",
  writer: "صانع محتوى",
  designer: "مصمم",
  publisher: "مسؤول النشر",
};

/** يفكّك سلسلة الأدوار المفصولة بفواصل إلى مصفوفة */
export function parseRoles(roles: string): string[] {
  return roles.split(",").map((r) => r.trim()).filter(Boolean);
}

/** هل يملك المستخدم أياً من الأدوار المطلوبة؟ */
export function hasAnyRole(userRoles: string[], allowed: string[]): boolean {
  return userRoles.some((r) => allowed.includes(r));
}

/** أسماء الأدوار بالعربية مفصولة بفواصل */
export function roleLabels(userRoles: string[]): string {
  return userRoles.map((r) => ROLE_LABELS[r] ?? r).join("، ");
}

function sign(value: string) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}

export function encodeSession(userId: string) {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: Date.now() + 1000 * 60 * 60 * 24 * 7 }),
  ).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  if (sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (typeof data.exp !== "number" || data.exp < Date.now()) return null;
    return data.uid as string;
  } catch {
    return null;
  }
}

export async function setSessionCookie(userId: string) {
  const store = await cookies();
  store.set(COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  jobTitle: string;
  isActive: boolean;
};

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const uid = decodeSession(store.get(COOKIE)?.value);
  if (!uid) return null;
  const user = await db.user.findUnique({ where: { id: uid } });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    roles: parseRoles(user.roles),
    jobTitle: user.jobTitle,
    isActive: user.isActive,
  };
}
