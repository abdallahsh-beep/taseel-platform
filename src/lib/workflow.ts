// آلة حالات سير العمل — القسم 7 من الـ PRD
// المعرفات: 1 فكرة، 2 جاري الكتابة، 3 قيد التصميم، 4 بانتظار الاعتماد، 5 جاهز، 6 منشور

export const STATUS = {
  IDEA: 1,
  WRITING: 2,
  DESIGN: 3,
  PENDING: 4,
  READY: 5,
  PUBLISHED: 6,
} as const;

type Transition = { to: number; roles: string[]; kind: "move" | "approve" | "reject" | "publish" };

// الانتقالات العادية (سحب وإفلات مسموح)
const MOVES: Record<number, Transition[]> = {
  1: [{ to: 2, roles: ["admin", "supervisor", "writer"], kind: "move" }],
  2: [
    { to: 1, roles: ["admin", "supervisor", "writer"], kind: "move" },
    { to: 3, roles: ["admin", "supervisor", "writer"], kind: "move" },
    { to: 4, roles: ["admin", "supervisor", "writer"], kind: "move" }, // بدون تصميم
  ],
  3: [
    { to: 2, roles: ["admin", "supervisor", "designer"], kind: "move" },
    { to: 4, roles: ["admin", "supervisor", "designer", "writer"], kind: "move" },
  ],
  4: [
    { to: 5, roles: ["admin", "supervisor"], kind: "approve" }, // اعتماد فقط — لا سحب
    { to: 2, roles: ["admin", "supervisor"], kind: "reject" },
    { to: 3, roles: ["admin", "supervisor"], kind: "reject" },
  ],
  5: [
    { to: 4, roles: ["admin", "supervisor"], kind: "move" }, // إرجاع للاعتماد
    { to: 6, roles: ["admin", "supervisor", "publisher"], kind: "publish" }, // توثيق النشر
  ],
  6: [],
};

export function findTransition(from: number, to: number) {
  return (MOVES[from] ?? []).find((t) => t.to === to) ?? null;
}

const anyOf = (userRoles: string[], allowed: string[]) => userRoles.some((r) => allowed.includes(r));

export function canApprove(roles: string[]) {
  return anyOf(roles, ["admin", "supervisor"]);
}

export function canPublish(roles: string[]) {
  return anyOf(roles, ["admin", "supervisor", "publisher"]);
}

export function canEditText(roles: string[]) {
  return anyOf(roles, ["admin", "supervisor", "writer"]);
}

export function canCreate(roles: string[]) {
  return anyOf(roles, ["admin", "supervisor", "writer"]);
}

export function canReschedule(roles: string[]) {
  return anyOf(roles, ["admin", "supervisor", "writer"]);
}
