"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { db } from "@/lib/db";
import { storeFile, createSignedUploadUrl, isOwnStorageUrl, usingSupabaseStorage } from "@/lib/storage";
import { getSessionUser, setSessionCookie, clearSessionCookie, hasAnyRole } from "@/lib/auth";
import { STATUS, findTransition, canApprove, canPublish, canEditText, canCreate, canReschedule } from "@/lib/workflow";

async function log(actorId: string | null, entityId: string, action: string, detail = "") {
  await db.activityLog.create({
    data: { actorId, entityType: "content_item", entityId, action, detail },
  });
}

function revalidateAll() {
  for (const p of ["/", "/board", "/approvals", "/publish-due", "/activity", "/dashboard", "/notifications", "/media"])
    revalidatePath(p);
}

/** إنشاء إشعارات لمجموعة مستخدمين (يستثني الفاعل نفسه) */
async function notify(userIds: (string | null | undefined)[], actorId: string, type: string, message: string, itemId?: string) {
  const targets = [...new Set(userIds.filter((u): u is string => !!u && u !== actorId))];
  if (targets.length === 0) return;
  await db.notification.createMany({
    data: targets.map((userId) => ({ userId, type, message, itemId: itemId ?? null })),
  });
}

async function approverIds() {
  const approvers = await db.user.findMany({
    where: { isActive: true, OR: [{ roles: { contains: "admin" } }, { roles: { contains: "supervisor" } }] },
    select: { id: true },
  });
  return approvers.map((a) => a.id);
}

/** معرّفات المستخدمين النشطين الذين يحملون دوراً معيناً (للإسناد الاحتياطي عند غياب مُسند محدد) */
async function roleUserIds(role: string) {
  const users = await db.user.findMany({ where: { isActive: true, roles: { contains: role } }, select: { id: true } });
  return users.map((u) => u.id);
}

// تنقية الوسوم: مفصولة بفواصل، بلا تكرار، حد أقصى 8 وسوم و24 حرفاً لكل وسم
function cleanLabels(raw: string): string {
  const parts = [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean).map((s) => s.slice(0, 24)))];
  return parts.slice(0, 8).join(",");
}

// تحقّق أن النص رابط http/https صالح
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// تنقية رابط فيديو اختياري: يعيد الرابط الصالح أو "" (لا يُفشل الإنشاء على رابط خاطئ)
function cleanVideoUrl(raw: string): string {
  const t = raw.trim();
  return t && t.length <= 2048 && isHttpUrl(t) ? t : "";
}

// يبني لحظة UTC صحيحة من تاريخ ووقت بتوقيت الرياض (UTC+3) — مستقل عن توقيت الخادم
function riyadhDate(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const t = /^\d{2}:\d{2}$/.test(time) ? time : "12:00";
  const d = new Date(`${date}T${t}:00+03:00`);
  return isNaN(d.getTime()) ? null : d;
}

// وقت اليوم (HH:MM) لِلحظة مخزّنة، مقروءاً بتوقيت الرياض
function riyadhTimeOfDay(instant: Date): string {
  const wall = new Date(instant.getTime() + 3 * 60 * 60 * 1000);
  return `${String(wall.getUTCHours()).padStart(2, "0")}:${String(wall.getUTCMinutes()).padStart(2, "0")}`;
}

// ---------- المصادقة ----------
export async function login(_prev: { error?: string } | undefined, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  // تجاوز الـ omit العام لقراءة التجزئة في التحقق من الدخول فقط
  const user = await db.user.findUnique({ where: { email }, omit: { passwordHash: false } });
  if (!user || !user.isActive || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "بيانات الدخول غير صحيحة" };
  }
  await setSessionCookie(user.id);
  redirect("/");
}

export async function logout() {
  await clearSessionCookie();
  redirect("/login");
}

// ---------- تحريك الحالة (سحب وإفلات) ----------
export async function moveItem(itemId: string, toStatusId: number) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  const item = await db.contentItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "البطاقة غير موجودة" };

  const t = findTransition(item.statusId, toStatusId);
  if (!t) return { error: "انتقال غير مسموح في آلة الحالات" };
  if (!hasAnyRole(user.roles, t.roles)) return { error: "دورك لا يملك صلاحية هذا الانتقال" };
  // غير المشرف/المدير يحرّك فقط البطاقات المُسندة إليه (كاتباً أو مصمماً)
  const privileged = hasAnyRole(user.roles, ["admin", "supervisor"]);
  let assigned = item.writerId === user.id || item.designerId === user.id;
  // التقاط ذاتي: صاحب الدور المسؤول عن المرحلة يلتقط بطاقة غير مُسندة له (وإلا لن يستطيع المصمم تحريك أي بطاقة)
  const claim: { writerId?: string; designerId?: string } = {};
  if (!privileged && !assigned) {
    if (user.roles.includes("designer") && !item.designerId && (toStatusId === STATUS.DESIGN || item.statusId === STATUS.DESIGN)) {
      claim.designerId = user.id;
      assigned = true;
    } else if (user.roles.includes("writer") && !item.writerId && (toStatusId === STATUS.IDEA || toStatusId === STATUS.WRITING)) {
      claim.writerId = user.id;
      assigned = true;
    }
  }
  if (!privileged && !assigned) return { error: "لا يمكنك تحريك بطاقات غير مُسندة إليك" };
  if (t.kind === "approve") return { error: "الانتقال إلى «جاهز» يتم حصراً عبر إجراء الاعتماد" };
  if (t.kind === "publish") return { error: "الانتقال إلى «منشور» يتم حصراً عبر توثيق النشر" };
  if (t.kind === "reject") return { error: "الإرجاع من الاعتماد يتطلب إجراء رفض بملاحظة" };

  await db.contentItem.update({ where: { id: itemId }, data: { statusId: toStatusId, ...claim } });

  // إشعارات انتقال المراحل — يصل الإشعار للمسؤول عن المرحلة التالية
  if (toStatusId === STATUS.PENDING) {
    // بانتظار الاعتماد ← يُشعر المشرفين وينشئ طلب اعتماد
    await db.approval.create({ data: { contentItemId: itemId, requestedById: user.id } });
    await notify(await approverIds(), user.id, "approval_requested", `طلب اعتماد: «${item.title}» من ${user.name}`, itemId);
  } else if (toStatusId === STATUS.DESIGN) {
    // قيد التصميم ← النص جاهز، يُشعر المصمم (المُسنَد أو كل المصممين)
    const designers = item.designerId ? [item.designerId] : await roleUserIds("designer");
    await notify(designers, user.id, "ready_for_design", `النص جاهز — «${item.title}» بانتظار التصميم`, itemId);
  } else if (toStatusId === STATUS.WRITING) {
    // جاري الكتابة ← يُشعر الكاتب (المُسنَد أو كل الكتّاب)
    const writers = item.writerId ? [item.writerId] : await roleUserIds("writer");
    await notify(writers, user.id, "ready_for_writing", `«${item.title}» بانتظار كتابة المحتوى`, itemId);
  }
  await log(user.id, itemId, "status_changed", `${item.statusId}→${toStatusId}`);
  revalidateAll();
  return { ok: true };
}

// ---------- تغيير تاريخ النشر (سحب في الروزنامة) ----------
export async function rescheduleItem(itemId: string, newDateISO: string) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canReschedule(user.roles)) return { error: "دورك لا يملك تعديل المواعيد" };
  const item = await db.contentItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "البطاقة غير موجودة" };
  if (item.statusId === STATUS.PUBLISHED) return { error: "لا يمكن تعديل موعد محتوى منشور" };
  if (!hasAnyRole(user.roles, ["admin", "supervisor"]) && item.writerId !== user.id)
    return { error: "لا يمكنك تعديل مواعيد بطاقات غيرك" };

  // ننقل اليوم فقط مع الحفاظ على وقت اليوم الأصلي (بتوقيت الرياض)
  const old = item.scheduledAt;
  const merged = riyadhDate(newDateISO, riyadhTimeOfDay(old));
  if (!merged) return { error: "تاريخ غير صالح" };
  await db.contentItem.update({ where: { id: itemId }, data: { scheduledAt: merged } });
  await log(user.id, itemId, "rescheduled", `${old.toISOString()}→${merged.toISOString()}`);
  revalidateAll();
  return { ok: true };
}

// ---------- إنشاء بطاقة ----------
export async function createItem(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canCreate(user.roles)) return { error: "دورك لا يملك إنشاء بطاقات" };

  const title = String(formData.get("title") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const date = String(formData.get("date") ?? "");
  const time = String(formData.get("time") ?? "12:00");
  const platformIds = formData.getAll("platforms").map(Number).filter(Boolean);
  if (!title || !categoryId || !date) return { error: "أكمل الحقول المطلوبة" };
  const when = riyadhDate(date, time);
  if (!when) return { error: "تاريخ أو وقت غير صالح" };

  // الحملة والوسوم (اختياريان) — نجلب الحملة والكاتب الافتراضي بالتوازي وبعمود id فقط
  const rawCampaignId = String(formData.get("campaignId") ?? "").trim();
  const labels = cleanLabels(String(formData.get("labels") ?? ""));
  const [campaign, writer] = await Promise.all([
    rawCampaignId ? db.campaign.findUnique({ where: { id: rawCampaignId }, select: { id: true } }) : Promise.resolve(null),
    db.user.findFirst({ where: { roles: { contains: "writer" }, isActive: true }, select: { id: true } }),
  ]);
  const campaignId = campaign?.id ?? null;
  const writerId = user.roles.includes("writer") ? user.id : writer?.id;
  const item = await db.contentItem.create({
    data: {
      title,
      baseText: String(formData.get("baseText") ?? ""),
      hashtags: String(formData.get("hashtags") ?? ""),
      categoryId,
      campaignId,
      labels,
      videoUrl: cleanVideoUrl(String(formData.get("videoUrl") ?? "")),
      statusId: STATUS.IDEA,
      scheduledAt: when,
      createdById: user.id,
      writerId,
      variants: { create: (platformIds.length ? platformIds : [1]).map((pid) => ({ platformId: pid })) },
    },
  });

  // صورة اختيارية مرفقة أثناء الإنشاء — رُفعت مسبقاً مباشرةً للتخزين (imageMeta) أو كملف محلياً (image)؛
  // فشلها لا يمنع إنشاء البطاقة
  const saved = await resolveUpload(formData, "image");
  if (saved && !("error" in saved)) {
    const asset = await db.mediaAsset.create({
      data: {
        name: (saved.name || "صورة المنشور").slice(0, 120),
        folder: "صور عامة",
        tags: "منشور",
        uploadedById: user.id,
        versions: {
          create: { versionNo: 1, uploadedById: user.id, filePath: saved.filePath, mimeType: saved.mimeType, sizeBytes: saved.sizeBytes },
        },
      },
      include: { versions: true },
    });
    await db.contentItemAsset.create({ data: { contentItemId: item.id, assetVersionId: asset.versions[0].id, role: "attachment" } });
  }

  await notify([writerId], user.id, "assigned", `أُسندت إليك بطاقة جديدة: «${title}»`, item.id);
  await log(user.id, item.id, "created", title);
  revalidateAll();
  return { ok: true, id: item.id };
}

// ---------- تعديل نصوص البطاقة ونسخ المنصات ----------
export async function saveItemTexts(
  itemId: string,
  data: { title: string; baseText: string; hashtags: string; variants: { id: string; text: string }[] },
) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canEditText(user.roles)) return { error: "دورك لا يملك تعديل النصوص" };
  const item = await db.contentItem.findUnique({ where: { id: itemId }, include: { variants: true } });
  if (!item) return { error: "البطاقة غير موجودة" };
  if (item.statusId === STATUS.PUBLISHED) return { error: "لا يمكن تعديل محتوى منشور" };
  // غير المشرف/المدير يعدّل فقط البطاقات المُسندة إليه (مطابقة لقيد moveItem/rescheduleItem)
  const privileged = hasAnyRole(user.roles, ["admin", "supervisor"]);
  const assigned = item.writerId === user.id || item.designerId === user.id;
  if (!privileged && !assigned) return { error: "لا يمكنك تعديل بطاقات غير مُسندة إليك" };

  const willRevert = item.statusId === STATUS.READY;
  await db.contentItem.update({
    where: { id: itemId },
    data: {
      title: data.title,
      baseText: data.baseText,
      hashtags: data.hashtags,
      // أي تعديل على محتوى معتمد يعيده للاعتماد (قاعدة إلزامية في الـ PRD)
      ...(willRevert ? { statusId: STATUS.PENDING } : {}),
    },
  });
  // نحدّث فقط النسخ التابعة لهذه البطاقة — لا نثق بمعرّفات العميل (يمنع IDOR على بطاقات أخرى)
  // ونجمعها في معاملة واحدة بدل استعلام لكل منصة (round-trip واحد بدل N)
  const ownVariantIds = new Set(item.variants.map((v) => v.id));
  const variantUpdates = data.variants
    .filter((v) => ownVariantIds.has(v.id))
    .map((v) => db.platformVariant.update({ where: { id: v.id }, data: { variantText: v.text } }));
  if (variantUpdates.length) await db.$transaction(variantUpdates);
  if (willRevert) {
    await db.approval.create({ data: { contentItemId: itemId, requestedById: user.id } });
    await notify(await approverIds(), user.id, "approval_requested", `تعديل بعد الاعتماد على «${item.title}» — تحتاج إعادة اعتماد`, itemId);
    await log(user.id, itemId, "approval_voided", "تعديل بعد الاعتماد — أعيدت للاعتماد");
  }
  await log(user.id, itemId, "updated", data.title);
  revalidateAll();
  return { ok: true, reverted: willRevert };
}

// ---------- حذف بطاقة ----------
export async function deleteItem(itemId: string) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  const item = await db.contentItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "البطاقة غير موجودة" };
  // المدير/المشرف يحذف أي بطاقة؛ غيره يحذف ما أنشأه فقط
  const privileged = hasAnyRole(user.roles, ["admin", "supervisor"]);
  if (!privileged && item.createdById !== user.id) return { error: "لا يمكنك حذف بطاقة لم تُنشئها" };
  // الحذف يزيل المتغيرات والاعتمادات والتعليقات وروابط المرفقات تلقائياً (onDelete: Cascade)
  await db.contentItem.delete({ where: { id: itemId } });
  await log(user.id, itemId, "deleted", item.title);
  revalidateAll();
  return { ok: true };
}

// ---------- الاعتماد ----------
export async function approveItem(itemId: string) {
  const user = await getSessionUser();
  if (!user || !canApprove(user.roles)) return { error: "الاعتماد للمشرف أو المدير فقط" };
  const item = await db.contentItem.findUnique({ where: { id: itemId } });
  if (!item || item.statusId !== STATUS.PENDING) return { error: "البطاقة ليست بانتظار الاعتماد" };

  await db.approval.updateMany({
    where: { contentItemId: itemId, decision: "pending" },
    data: { decision: "approved", reviewerId: user.id, decidedAt: new Date(), decisionNote: "معتمد" },
  });
  await db.contentItem.update({ where: { id: itemId }, data: { statusId: STATUS.READY } });
  const publishers = await db.user.findMany({ where: { roles: { contains: "publisher" }, isActive: true } });
  await notify(
    [item.writerId, item.createdById, ...publishers.map((p) => p.id)],
    user.id,
    "approved",
    `اعتُمدت بطاقة «${item.title}» — أصبحت جاهزة للنشر`,
    itemId,
  );
  await log(user.id, itemId, "approved");
  revalidateAll();
  return { ok: true };
}

export async function rejectItem(itemId: string, note: string, returnTo: number) {
  const user = await getSessionUser();
  if (!user || !canApprove(user.roles)) return { error: "الرفض للمشرف أو المدير فقط" };
  if (!note.trim()) return { error: "ملاحظة الرفض إلزامية" };
  if (![STATUS.WRITING, STATUS.DESIGN].includes(returnTo as 2 | 3)) return { error: "وجهة إرجاع غير صحيحة" };
  const item = await db.contentItem.findUnique({ where: { id: itemId } });
  if (!item || item.statusId !== STATUS.PENDING) return { error: "البطاقة ليست بانتظار الاعتماد" };

  await db.approval.updateMany({
    where: { contentItemId: itemId, decision: "pending" },
    data: { decision: "rejected", reviewerId: user.id, decidedAt: new Date(), decisionNote: note },
  });
  await db.contentItem.update({ where: { id: itemId }, data: { statusId: returnTo } });
  await db.comment.create({
    data: { contentItemId: itemId, authorId: user.id, body: `❌ ملاحظة الرفض: ${note}` },
  });
  // إشعار المسؤول عن المرحلة التي تعود إليها البطاقة (احتياطياً كل أصحاب الدور إن لم يُسنَد أحد)
  const stageOwners =
    returnTo === STATUS.DESIGN
      ? item.designerId ? [item.designerId] : await roleUserIds("designer")
      : item.writerId ? [item.writerId] : await roleUserIds("writer");
  await notify(
    [...stageOwners, item.writerId, item.designerId, item.createdById],
    user.id,
    "rejected",
    `رُفضت بطاقة «${item.title}»: ${note}`,
    itemId,
  );
  await log(user.id, itemId, "rejected", note);
  revalidateAll();
  return { ok: true };
}

// ---------- توثيق النشر اليدوي ----------
export async function publishItem(itemId: string, links: { variantId: string; url: string }[]) {
  const user = await getSessionUser();
  if (!user || !canPublish(user.roles)) return { error: "توثيق النشر لمسؤول النشر أو المشرف" };
  const item = await db.contentItem.findUnique({ where: { id: itemId }, include: { variants: true } });
  if (!item || item.statusId !== STATUS.READY) return { error: "لا يُنشر إلا محتوى بحالة «جاهز»" };

  // نبني الروابط انطلاقاً من متغيرات هذه البطاقة فقط — لا نثق بمعرّفات العميل
  // (يمنع تحديث متغيرات بطاقات أخرى عبر تمرير variantId لا يخصها)
  const ownVariantIds = new Set(item.variants.map((v) => v.id));
  const updates: { variantId: string; url: string }[] = [];
  for (const v of item.variants) {
    const link = links.find((l) => l.variantId === v.id && ownVariantIds.has(l.variantId));
    if (!link?.url.trim()) return { error: "رابط المنشور مطلوب لكل منصة مستهدفة" };
    updates.push({ variantId: v.id, url: link.url.trim() });
  }
  // تحديث كل النسخ + حالة البطاقة في معاملة واحدة (ذرّية + round-trip واحد بدل N+1)
  const now = new Date();
  await db.$transaction([
    ...updates.map((u) =>
      db.platformVariant.update({
        where: { id: u.variantId },
        data: { publishStatus: "published", externalPostUrl: u.url, publishedAt: now, publishedById: user.id },
      }),
    ),
    db.contentItem.update({ where: { id: itemId }, data: { statusId: STATUS.PUBLISHED } }),
  ]);
  await notify([item.writerId, item.createdById], user.id, "published", `نُشرت بطاقة «${item.title}» ووُثقت روابطها`, itemId);
  await log(user.id, itemId, "published", `${links.length} منصة`);
  revalidateAll();
  return { ok: true };
}

// ---------- التعليقات (مع دعم التعليق التوضيحي على مقطع نص — FR-40) ----------
export async function addComment(itemId: string, body: string, anchor?: string) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!body.trim()) return { error: "التعليق فارغ" };
  const item = await db.contentItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "البطاقة غير موجودة" };

  const mentionNames = (body.match(/@([؀-ۿ\w]+)/g) ?? []).map((m) => m.slice(1));
  await db.comment.create({
    data: {
      contentItemId: itemId,
      authorId: user.id,
      body: body.trim(),
      mentions: mentionNames.join(","),
      anchor: anchor ?? null,
    },
  });

  // إشعار المذكورين بـ @ (مطابقة بأول الاسم) + كاتب البطاقة
  const mentioned = mentionNames.length
    ? await db.user.findMany({ where: { OR: mentionNames.map((n) => ({ name: { startsWith: n } })), isActive: true }, select: { id: true } })
    : [];
  await notify(
    [...mentioned.map((m) => m.id), item.writerId],
    user.id,
    mentioned.length ? "mentioned" : "commented",
    `ملاحظة من ${user.name} على «${item.title}»: ${body.trim().slice(0, 60)}`,
    itemId,
  );
  await log(user.id, itemId, "commented");
  revalidateAll();
  return { ok: true };
}

// ---------- الإشعارات ----------
export async function markAllNotificationsRead() {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
  return { ok: true };
}

// ---------- مكتبة الوسائط (FR-23..26) ----------
const UPLOAD_MAX_BYTES = 20 * 1024 * 1024;
const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "video/mp4": "mp4",
};

function canUploadMedia(roles: string[]) {
  return hasAnyRole(roles, ["admin", "supervisor", "writer", "designer"]); // مسؤول النشر: عرض فقط
}

async function saveUploadedFile(file: File): Promise<{ filePath: string; mimeType: string; sizeBytes: number } | { error: string }> {
  if (!file || file.size === 0) return { error: "لم يُرفق ملف" };
  if (file.size > UPLOAD_MAX_BYTES) return { error: "حجم الملف يتجاوز 20MB" };
  const ext = MIME_EXT[file.type];
  if (!ext) return { error: "نوع الملف غير مدعوم (المسموح: صور PNG/JPG/WebP/GIF، PDF، MP4)" };
  try {
    // Supabase Storage في الإنتاج، أو القرص المحلي في التطوير — يُدار في lib/storage
    const { filePath } = await storeFile(Buffer.from(await file.arrayBuffer()), ext, file.type);
    return { filePath, mimeType: file.type, sizeBytes: file.size };
  } catch (e) {
    return { error: (e as Error).message || "تعذّر حفظ الملف" };
  }
}

type StoredFile = { filePath: string; mimeType: string; sizeBytes: number; name: string };

/**
 * يُصدر رابط رفع موقّعاً للمتصفح ليرفع الملف مباشرةً إلى التخزين — يتجاوز حد جسم الطلب على Vercel.
 * يعيد { error: "no-storage" } محلياً (بلا Supabase) إشارةً للعميل ليسقط لإرسال الملف في الطلب.
 */
export async function createSignedUpload(
  mimeType: string,
): Promise<{ error: string } | { signedUrl: string; publicUrl: string }> {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!usingSupabaseStorage) return { error: "no-storage" };
  const ext = MIME_EXT[mimeType];
  if (!ext) return { error: "نوع الملف غير مدعوم (المسموح: صور PNG/JPG/WebP/GIF، PDF، MP4)" };
  const path = `uploads/${crypto.randomUUID()}.${ext}`;
  const res = await createSignedUploadUrl(path);
  if ("error" in res) return { error: res.error };
  return { signedUrl: res.signedUrl, publicUrl: res.publicUrl };
}

/**
 * يحلّ مصدر الملف لأي إجراء رفع:
 * - إن وُجد حقل `${field}Meta` (رُفع مسبقاً مباشرةً للتخزين) → نستخدمه بعد التحقق منه.
 * - وإلا إن وُجد ملف في الطلب باسم `field` (احتياطي تطوير محلي) → نحفظه عبر saveUploadedFile.
 * - وإلا → null (لا ملف).
 */
async function resolveUpload(
  formData: FormData,
  field: string,
): Promise<StoredFile | { error: string } | null> {
  const metaRaw = String(formData.get(`${field}Meta`) ?? "");
  if (metaRaw) {
    try {
      const m = JSON.parse(metaRaw);
      if (
        typeof m?.filePath === "string" &&
        typeof m?.mimeType === "string" &&
        typeof m?.sizeBytes === "number" &&
        MIME_EXT[m.mimeType] &&
        m.sizeBytes > 0 &&
        m.sizeBytes <= UPLOAD_MAX_BYTES &&
        isOwnStorageUrl(m.filePath)
      ) {
        return {
          filePath: m.filePath,
          mimeType: m.mimeType,
          sizeBytes: m.sizeBytes,
          name: (typeof m.name === "string" ? m.name : "").slice(0, 120),
        };
      }
    } catch {}
    return { error: "بيانات الملف غير صالحة" };
  }
  const file = formData.get(field) as File | null;
  if (!file || file.size === 0) return null;
  const r = await saveUploadedFile(file);
  if ("error" in r) return r;
  return { ...r, name: (file.name || "").slice(0, 120) };
}

export async function uploadAsset(formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canUploadMedia(user.roles)) return { error: "دورك لا يملك رفع ملفات للمكتبة" };

  const saved = await resolveUpload(formData, "file");
  if (!saved) return { error: "لم يُرفق ملف" };
  if ("error" in saved) return saved;
  const name = String(formData.get("name") ?? "").trim() || saved.name || "ملف";
  const folder = String(formData.get("folder") ?? "عام");
  const tags = String(formData.get("tags") ?? "").trim();

  const asset = await db.mediaAsset.create({
    data: {
      name,
      folder,
      tags,
      uploadedById: user.id,
      versions: {
        create: { versionNo: 1, uploadedById: user.id, filePath: saved.filePath, mimeType: saved.mimeType, sizeBytes: saved.sizeBytes },
      },
    },
  });
  await db.activityLog.create({
    data: { actorId: user.id, entityType: "media_asset", entityId: asset.id, action: "asset_uploaded", detail: name },
  });
  revalidatePath("/media");
  return { ok: true, id: asset.id };
}

export async function uploadAssetVersion(assetId: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canUploadMedia(user.roles)) return { error: "دورك لا يملك رفع إصدارات" };

  const asset = await db.mediaAsset.findUnique({ where: { id: assetId }, include: { versions: { orderBy: { versionNo: "desc" }, take: 1 } } });
  if (!asset) return { error: "الأصل غير موجود" };

  const saved = await resolveUpload(formData, "file");
  if (!saved) return { error: "لم يُرفق ملف" };
  if ("error" in saved) return saved;

  const note = String(formData.get("note") ?? "").trim();
  await db.assetVersion.create({
    data: {
      assetId,
      versionNo: (asset.versions[0]?.versionNo ?? 0) + 1,
      uploadedById: user.id,
      note,
      filePath: saved.filePath,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
    },
  });
  await db.activityLog.create({
    data: { actorId: user.id, entityType: "media_asset", entityId: assetId, action: "asset_version_added", detail: `${asset.name} — ${note}` },
  });
  revalidatePath("/media");
  return { ok: true };
}

export async function linkAssetToItem(itemId: string, assetVersionId: string) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!hasAnyRole(user.roles, ["admin", "supervisor", "designer", "writer"])) return { error: "دورك لا يملك ربط مرفقات" };

  const item = await db.contentItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "البطاقة غير موجودة" };
  if (item.statusId === STATUS.PUBLISHED) return { error: "لا تعديل على محتوى منشور" };
  if (!hasAnyRole(user.roles, ["admin", "supervisor"]) && item.writerId !== user.id && item.designerId !== user.id)
    return { error: "لا يمكنك تعديل مرفقات بطاقة غير مُسندة إليك" };

  await db.contentItemAsset.upsert({
    where: { contentItemId_assetVersionId: { contentItemId: itemId, assetVersionId } },
    create: { contentItemId: itemId, assetVersionId },
    update: {},
  });

  // تغيير مرفق بطاقة معتمدة يعيدها للاعتماد (FR-25)
  let reverted = false;
  if (item.statusId === STATUS.READY) {
    await db.contentItem.update({ where: { id: itemId }, data: { statusId: STATUS.PENDING } });
    await db.approval.create({ data: { contentItemId: itemId, requestedById: user.id } });
    await notify(await approverIds(), user.id, "approval_requested", `تغيّر مرفق بطاقة معتمدة «${item.title}» — تحتاج إعادة اعتماد`, itemId);
    await log(user.id, itemId, "approval_voided", "تغيير مرفق بعد الاعتماد");
    reverted = true;
  }
  await log(user.id, itemId, "asset_linked");
  revalidateAll();
  return { ok: true, reverted };
}

export async function unlinkAssetFromItem(itemId: string, assetVersionId: string) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!hasAnyRole(user.roles, ["admin", "supervisor", "designer", "writer"])) return { error: "دورك لا يملك إزالة مرفقات" };
  const item = await db.contentItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "البطاقة غير موجودة" };
  if (item.statusId === STATUS.PUBLISHED) return { error: "لا تعديل على محتوى منشور" };
  if (!hasAnyRole(user.roles, ["admin", "supervisor"]) && item.writerId !== user.id && item.designerId !== user.id)
    return { error: "لا يمكنك تعديل مرفقات بطاقة غير مُسندة إليك" };

  await db.contentItemAsset.deleteMany({ where: { contentItemId: itemId, assetVersionId } });
  await log(user.id, itemId, "asset_unlinked");
  revalidateAll();
  return { ok: true };
}

// ---------- روابط معاينة الضيوف — قراءة فقط (FR-39) ----------
// month: يُمرَّر رمز الشهر "YYYY-MM"؛ نخزّن بداية الشهر بتوقيت الرياض لتوافق التبويب
export async function createShareLink(scope: "item" | "month", targetId: string | null, periodMonth: string | null, days: number) {
  const user = await getSessionUser();
  if (!user || !hasAnyRole(user.roles, ["admin", "supervisor"])) return { error: "إنشاء روابط المعاينة للمدير والمشرف فقط" };
  if (!["item", "month"].includes(scope)) return { error: "نطاق غير صحيح" };
  const safeDays = [3, 7, 30].includes(days) ? days : 7;
  const periodStart =
    scope === "month" && periodMonth && /^\d{4}-\d{2}$/.test(periodMonth)
      ? riyadhDate(`${periodMonth}-01`, "00:00")
      : null;

  const link = await db.shareLink.create({
    data: {
      token: crypto.randomBytes(24).toString("base64url"),
      scope,
      targetId: scope === "item" ? targetId : null,
      periodStart,
      expiresAt: new Date(Date.now() + safeDays * 24 * 60 * 60 * 1000),
      createdById: user.id,
    },
  });
  await db.activityLog.create({
    data: { actorId: user.id, entityType: "share_link", entityId: link.id, action: "share_link_created", detail: scope },
  });
  revalidateAll();
  return { ok: true, url: `/share/${link.token}`, id: link.id };
}

export async function revokeShareLink(linkId: string) {
  const user = await getSessionUser();
  if (!user || !hasAnyRole(user.roles, ["admin", "supervisor"])) return { error: "غير مصرح" };
  const existing = await db.shareLink.findUnique({ where: { id: linkId } });
  if (!existing) return { error: "الرابط غير موجود" };
  await db.shareLink.update({ where: { id: linkId }, data: { revokedAt: new Date() } });
  await db.activityLog.create({
    data: { actorId: user.id, entityType: "share_link", entityId: linkId, action: "share_link_revoked" },
  });
  revalidateAll();
  return { ok: true };
}

// ---------- الاستيراد من CSV (FR-32) ----------
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else cell += ch;
  }
  row.push(cell);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return rows;
}

const PLATFORM_NAME_TO_ID: Record<string, number> = {
  x: 1, "إكس": 1, "تويتر": 1,
  instagram: 2, "إنستجرام": 2, "انستجرام": 2,
  facebook: 3, "فيسبوك": 3, "فيس بوك": 3,
  linkedin: 4, "لينكد إن": 4, "لينكدإن": 4,
  whatsapp: 5, "واتساب": 5, "واتس اب": 5, "وتساب": 5,
  telegram: 6, "تليجرام": 6, "تلجرام": 6, "تيليجرام": 6,
  youtube: 7, "يوتيوب": 7, "يو تيوب": 7,
  tiktok: 8, "تيك توك": 8, "تيكتوك": 8, "تك توك": 8,
};

export async function importCsv(formData: FormData) {
  const user = await getSessionUser();
  if (!user || !hasAnyRole(user.roles, ["admin", "supervisor"])) return { error: "الاستيراد للمدير والمشرف فقط" };

  let text = String(formData.get("csvText") ?? "").trim();
  const file = formData.get("file") as File | null;
  if (!text && file && file.size > 0) {
    if (file.size > 2 * 1024 * 1024) return { error: "ملف CSV أكبر من 2MB" };
    text = Buffer.from(await file.arrayBuffer()).toString("utf8").replace(/^﻿/, "");
  }
  if (!text) return { error: "ألصق محتوى CSV أو ارفع ملفاً" };

  const rows = parseCsv(text);
  if (rows.length < 2) return { error: "لا صفوف بيانات (السطر الأول عناوين الأعمدة)" };
  if (rows.length > 501) return { error: "الحد الأقصى 500 صف في الاستيراد الواحد — قسّم الملف" };

  const [categories, writer] = await Promise.all([
    db.category.findMany(),
    db.user.findFirst({ where: { roles: { contains: "writer" }, isActive: true }, select: { id: true } }),
  ]);
  const errors: string[] = [];
  let created = 0;

  // 1) نتحقّق من كل الصفوف أولاً ونبني قائمة الإنشاء (نجمع أخطاء التحقق دون إيقاف البقية)
  const toCreate: { rowNo: number; title: string; baseText: string; categoryId: string; when: Date; platformIds: number[] }[] = [];
  for (let r = 1; r < rows.length; r++) {
    const [title, date, time, catName, platformsRaw, baseText] = rows[r].map((c) => (c ?? "").trim());
    if (!title) { errors.push(`صف ${r + 1}: العنوان فارغ`); continue; }
    const when = riyadhDate(date, time);
    if (!when) { errors.push(`صف ${r + 1}: تاريخ غير صالح (المطلوب YYYY-MM-DD)`); continue; }
    const cat = categories.find((c) => c.nameAr === catName);
    if (!cat) { errors.push(`صف ${r + 1}: تصنيف غير معروف «${catName}»`); continue; }
    const platformIds = [...new Set(
      (platformsRaw || "x").split(/[;|،]/).map((p) => PLATFORM_NAME_TO_ID[p.trim().toLowerCase()] ?? PLATFORM_NAME_TO_ID[p.trim()]).filter(Boolean),
    )];
    toCreate.push({ rowNo: r + 1, title, baseText: baseText ?? "", categoryId: cat.id, when, platformIds });
  }

  // 2) ننشئ البطاقات في دفعات متزامنة محدودة (بدل استعلام متسلسل لكل صف) مع الإبقاء على النجاح الجزئي
  const createdItems: { id: string; title: string }[] = [];
  const CHUNK = 25;
  for (let i = 0; i < toCreate.length; i += CHUNK) {
    const slice = toCreate.slice(i, i + CHUNK);
    const results = await Promise.allSettled(
      slice.map((x) =>
        db.contentItem.create({
          data: {
            title: x.title,
            baseText: x.baseText,
            categoryId: x.categoryId,
            statusId: STATUS.IDEA,
            scheduledAt: x.when,
            createdById: user.id,
            writerId: writer?.id,
            variants: { create: (x.platformIds.length ? x.platformIds : [1]).map((pid) => ({ platformId: pid })) },
          },
        }),
      ),
    );
    results.forEach((res, j) => {
      if (res.status === "fulfilled") { createdItems.push({ id: res.value.id, title: slice[j].title }); created++; }
      else errors.push(`صف ${slice[j].rowNo}: تعذّر إنشاء البطاقة`);
    });
  }

  // 3) نسجّل النشاط دفعة واحدة بدل INSERT لكل صف
  if (createdItems.length) {
    await db.activityLog.createMany({
      data: createdItems.map((it) => ({ actorId: user.id, entityType: "content_item", entityId: it.id, action: "created", detail: `${it.title} (مستورد)` })),
    });
  }
  revalidateAll();
  return { ok: true, created, errors };
}

// ---------- الحملات (Campaigns — مستوحى من Planable) ----------
// حارس ملكية موحّد لتعديل بطاقة: مشرف/مدير أو الكاتب/المصمم المُسنَد، وغير منشورة
async function editableItemOrError(itemId: string, roles: string[], userId: string) {
  const item = await db.contentItem.findUnique({ where: { id: itemId } });
  if (!item) return { error: "البطاقة غير موجودة" as const };
  if (item.statusId === STATUS.PUBLISHED) return { error: "لا تعديل على محتوى منشور" as const };
  const privileged = hasAnyRole(roles, ["admin", "supervisor"]);
  if (!privileged && item.writerId !== userId && item.designerId !== userId)
    return { error: "لا يمكنك تعديل بطاقة غير مُسندة إليك" as const };
  return { item };
}

export async function createCampaign(name: string, color: string) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!hasAnyRole(user.roles, ["admin", "supervisor", "writer"])) return { error: "دورك لا يملك إنشاء حملات" };
  const clean = name.trim().slice(0, 60);
  if (!clean) return { error: "اسم الحملة مطلوب" };
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#304F6D";
  const c = await db.campaign.create({ data: { name: clean, color: safeColor } });
  revalidateAll();
  return { ok: true, id: c.id, name: c.name, color: c.color };
}

export async function setItemCampaign(itemId: string, campaignId: string | null) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canEditText(user.roles)) return { error: "دورك لا يملك تعديل البطاقة" };
  const guard = await editableItemOrError(itemId, user.roles, user.id);
  if ("error" in guard) return guard;
  // نتحقق من وجود الحملة عند التعيين (لا نثق بمعرّف العميل)
  const safeId = campaignId ? (await db.campaign.findUnique({ where: { id: campaignId } }))?.id ?? null : null;
  await db.contentItem.update({ where: { id: itemId }, data: { campaignId: safeId } });
  await log(user.id, itemId, "campaign_set", safeId ?? "بدون حملة");
  revalidateAll();
  return { ok: true };
}

export async function setItemLabels(itemId: string, labels: string) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canEditText(user.roles)) return { error: "دورك لا يملك تعديل البطاقة" };
  const guard = await editableItemOrError(itemId, user.roles, user.id);
  if ("error" in guard) return guard;
  await db.contentItem.update({ where: { id: itemId }, data: { labels: cleanLabels(labels) } });
  await log(user.id, itemId, "labels_set", labels);
  revalidateAll();
  return { ok: true };
}

// رابط فيديو خارجي (بديل رفع المقاطع الثقيلة) — يوتيوب/درايف/فيميو…
export async function setItemVideoUrl(itemId: string, url: string) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canEditText(user.roles)) return { error: "دورك لا يملك تعديل البطاقة" };
  const guard = await editableItemOrError(itemId, user.roles, user.id);
  if ("error" in guard) return guard;
  const trimmed = url.trim();
  if (trimmed) {
    if (trimmed.length > 2048) return { error: "الرابط طويل جداً" };
    if (!isHttpUrl(trimmed)) return { error: "رابط غير صالح — الصق رابطاً كاملاً يبدأ بـ https://" };
  }
  await db.contentItem.update({ where: { id: itemId }, data: { videoUrl: trimmed } });
  await log(user.id, itemId, "video_set", trimmed || "أُزيل رابط الفيديو");
  revalidateAll();
  return { ok: true };
}

// ---------- القوالب (Templates — إعادة استخدام نصوص جاهزة) ----------
export async function saveTemplate(name: string, baseText: string, hashtags: string) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canEditText(user.roles)) return { error: "دورك لا يملك حفظ قوالب" };
  const clean = name.trim().slice(0, 80);
  if (!clean) return { error: "اسم القالب مطلوب" };
  if (!baseText.trim() && !hashtags.trim()) return { error: "القالب فارغ — اكتب نصاً قبل الحفظ" };
  const t = await db.contentTemplate.create({
    data: { name: clean, baseText: baseText.slice(0, 5000), hashtags: hashtags.slice(0, 500) },
  });
  revalidateAll();
  return { ok: true, id: t.id, name: t.name };
}

export async function deleteTemplate(templateId: string) {
  const user = await getSessionUser();
  if (!user || !hasAnyRole(user.roles, ["admin", "supervisor"])) return { error: "حذف القوالب للمدير والمشرف" };
  await db.contentTemplate.delete({ where: { id: templateId } }).catch(() => null);
  revalidateAll();
  return { ok: true };
}

// ---------- رفع صورة مباشرة إلى البطاقة (Planable media) ----------
// يرفع الملف، ينشئ أصلاً في المكتبة بإصدار واحد، ويربطه بالبطاقة — كل ذلك في خطوة واحدة
export async function uploadCardImage(itemId: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canUploadMedia(user.roles)) return { error: "دورك لا يملك رفع وسائط" };
  const guard = await editableItemOrError(itemId, user.roles, user.id);
  if ("error" in guard) return guard;
  const item = guard.item;

  const saved = await resolveUpload(formData, "file");
  if (!saved) return { error: "لم يُرفق ملف" };
  if ("error" in saved) return saved;

  const asset = await db.mediaAsset.create({
    data: {
      name: (saved.name || "صورة المنشور").slice(0, 120),
      folder: "صور عامة",
      tags: "منشور",
      uploadedById: user.id,
      versions: {
        create: { versionNo: 1, uploadedById: user.id, filePath: saved.filePath, mimeType: saved.mimeType, sizeBytes: saved.sizeBytes },
      },
    },
    include: { versions: true },
  });
  const versionId = asset.versions[0].id;
  await db.contentItemAsset.create({ data: { contentItemId: itemId, assetVersionId: versionId, role: "attachment" } });

  // تغيير مرفق بطاقة معتمدة يعيدها للاعتماد (نفس قاعدة linkAssetToItem)
  let reverted = false;
  if (item.statusId === STATUS.READY) {
    await db.contentItem.update({ where: { id: itemId }, data: { statusId: STATUS.PENDING } });
    await db.approval.create({ data: { contentItemId: itemId, requestedById: user.id } });
    await notify(await approverIds(), user.id, "approval_requested", `رُفعت صورة لبطاقة معتمدة «${item.title}» — تحتاج إعادة اعتماد`, itemId);
    await log(user.id, itemId, "approval_voided", "رفع صورة بعد الاعتماد");
    reverted = true;
  }
  await db.activityLog.create({
    data: { actorId: user.id, entityType: "media_asset", entityId: asset.id, action: "asset_uploaded", detail: asset.name },
  });
  await log(user.id, itemId, "image_uploaded", asset.name);
  revalidateAll();
  return { ok: true, reverted };
}

// ---------- توليد مسودة منشور بالذكاء الاصطناعي (Claude) ----------
export async function generateDraft(input: { title: string; platformKey: string; instructions: string; categoryName?: string }) {
  const user = await getSessionUser();
  if (!user) return { error: "غير مصرح" };
  if (!canEditText(user.roles)) return { error: "دورك لا يملك تحرير النصوص" };

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      error:
        "توليد النص بالذكاء الاصطناعي غير مُفعَّل بعد. أضف مفتاح ANTHROPIC_API_KEY في ملف platform/.env ثم أعد تشغيل المنصة ليعمل الزر.",
    };
  }

  const title = input.title.trim();
  if (!title && !input.instructions.trim()) return { error: "اكتب عنواناً أو تعليمات ليكتب المساعد المسودة" };

  const platformNames: Record<string, string> = {
    x: "إكس (X) — منشور قصير موجز",
    instagram: "إنستجرام — منشور بأسلوب بصري جذاب",
    facebook: "فيسبوك — منشور تفاعلي متوسط الطول",
    linkedin: "لينكد إن — منشور مهني رصين",
    whatsapp: "واتساب — رسالة مباشرة ودّية",
    telegram: "تليجرام — منشور قناة واضح",
  };
  const platformHint = platformNames[input.platformKey] ?? "منشور عام لوسائل التواصل";

  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 1024,
      system:
        "أنت كاتب محتوى في جمعية «تأصيل» التعليمية غير الربحية. اكتب منشورات عربية فصيحة راقية، هادفة وتربوية، بنبرة محترمة تناسب جمعية تعليمية. لا تستخدم مبالغات تسويقية. أعد المنشور جاهزاً للنشر فقط بدون شرح أو مقدمات أو خيارات متعددة، ويمكنك استخدام إيموجي واحد أو اثنين عند المناسبة.",
      messages: [
        {
          role: "user",
          content:
            `اكتب مسودة منشور لمنصة ${platformHint}.\n` +
            (input.categoryName ? `التصنيف: ${input.categoryName}\n` : "") +
            (title ? `الموضوع/العنوان: ${title}\n` : "") +
            (input.instructions.trim() ? `تعليمات إضافية: ${input.instructions.trim()}\n` : "") +
            `\nأعد نص المنشور فقط.`,
        },
      ],
    });
    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }
    text = text.trim();
    if (!text) return { error: "تعذّر توليد نص — حاول مرة أخرى" };
    await log(user.id, "-", "ai_draft_generated", title || input.platformKey);
    return { ok: true, text };
  } catch (e) {
    const err = e as { status?: number; message?: string };
    if (err.status === 401) return { error: "مفتاح ANTHROPIC_API_KEY غير صالح — تحقق منه في platform/.env" };
    if (err.status === 429) return { error: "تم تجاوز حد الطلبات مؤقتاً — انتظر قليلاً ثم أعد المحاولة" };
    return { error: `تعذّر الاتصال بخدمة الذكاء الاصطناعي: ${err.message ?? "خطأ غير معروف"}` };
  }
}
