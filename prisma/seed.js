// بذر بيانات تجريبية — الربع الثالث 2026 (مطابق لروزنامة تأصيل الورقية)
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const db = new PrismaClient();

async function main() {
  // ---------- الحالات ----------
  const statuses = [
    { id: 1, key: "idea", labelAr: "فكرة", sortOrder: 1, phase: 1 },
    { id: 2, key: "writing", labelAr: "جاري الكتابة", sortOrder: 2, phase: 1 },
    { id: 3, key: "design", labelAr: "قيد التصميم", sortOrder: 3, phase: 1 },
    { id: 4, key: "pending_approval", labelAr: "بانتظار الاعتماد", sortOrder: 4, phase: 1 },
    { id: 5, key: "approved_ready", labelAr: "جاهز", sortOrder: 5, phase: 1 },
    { id: 6, key: "published", labelAr: "منشور", sortOrder: 6, phase: 1 },
    { id: 7, key: "scheduled", labelAr: "مجدول", sortOrder: 7, phase: 2 },
    { id: 8, key: "publishing", labelAr: "قيد النشر", sortOrder: 8, phase: 2 },
    { id: 9, key: "failed", labelAr: "فشل النشر", sortOrder: 9, phase: 2 },
  ];
  for (const s of statuses) await db.status.upsert({ where: { id: s.id }, create: s, update: s });

  // ---------- المنصات ----------
  const platforms = [
    { id: 1, key: "x", nameAr: "إكس", maxChars: 280 },
    { id: 2, key: "instagram", nameAr: "إنستجرام", maxChars: 2200 },
    { id: 3, key: "facebook", nameAr: "فيسبوك", maxChars: 63206 },
    { id: 4, key: "linkedin", nameAr: "لينكد إن", maxChars: 3000 },
    { id: 5, key: "whatsapp", nameAr: "واتساب", maxChars: 4096 },
    { id: 6, key: "telegram", nameAr: "تليجرام", maxChars: 4096 },
    { id: 7, key: "youtube", nameAr: "يوتيوب", maxChars: 5000 },
    { id: 8, key: "tiktok", nameAr: "تيك توك", maxChars: 2200 },
  ];
  for (const p of platforms) await db.platform.upsert({ where: { id: p.id }, create: p, update: p });

  // ---------- التصنيفات (ألوان من هوية تأصيل) ----------
  const categories = [
    { nameAr: "تغريدات", color: "#304F6D" },
    { nameAr: "إنستجرام", color: "#C1996B" },
    { nameAr: "فيسبوك", color: "#758694" },
    { nameAr: "لينكد إن", color: "#1B3347" },
    { nameAr: "فعالية حضورية", color: "#8C6F4E" },
    { nameAr: "برنامج تعليمي", color: "#5B7A99" },
  ];
  const cats = {};
  for (const c of categories) {
    const found = await db.category.findFirst({ where: { nameAr: c.nameAr } });
    cats[c.nameAr] = found || (await db.category.create({ data: c }));
  }

  // ---------- المستخدمون (فريق عمل تأصيل الفعلي) ----------
  const hash = await bcrypt.hash("Taseel@2026", 10);
  const usersData = [
    { key: "supervisor", name: "سفر الدغيري", email: "safar@taseel.org.sa", roles: "admin,supervisor", jobTitle: "مدير وحدة الإعلام — مراجع ومشرف" },
    { key: "designer", name: "عبدالله شرف الدين", email: "abdullah.sharaf@taseel.org.sa", roles: "designer,writer", jobTitle: "مصمم وكاتب محتوى" },
    { key: "writer", name: "المنذر الحميدان", email: "almunther@taseel.org.sa", roles: "writer,designer", jobTitle: "منتج وكاتب محتوى" },
    { key: "publisher", name: "عبدالله الدبيخي", email: "abdullah.aldubaikhi@taseel.org.sa", roles: "publisher", jobTitle: "مسؤول النشر" },
  ];
  // نظّف أي مستخدمين قدامى من البذور السابقة
  const keepEmails = usersData.map((u) => u.email);
  await db.user.deleteMany({ where: { email: { notIn: keepEmails } } });
  const users = {};
  for (const u of usersData) {
    users[u.key] = await db.user.upsert({
      where: { email: u.email },
      create: { name: u.name, email: u.email, roles: u.roles, jobTitle: u.jobTitle, passwordHash: hash },
      update: { name: u.name, roles: u.roles, jobTitle: u.jobTitle },
    });
  }
  // مرجع موحّد: أي إشارة لـ users.admin تعود لسفر (مدير+مشرف)
  users.admin = users.supervisor;

  // ---------- المناسبات ----------
  const occasions = [
    { nameAr: "يوم عاشوراء", hijriMonth: 1, hijriDay: 10, color: "#8C6F4E" },
    { nameAr: "رأس السنة الهجرية", hijriMonth: 1, hijriDay: 1, color: "#304F6D" },
    { nameAr: "اليوم الوطني السعودي", gregMonth: 9, gregDay: 23, color: "#2E6B4F" },
    { nameAr: "يوم التأسيس", gregMonth: 2, gregDay: 22, color: "#8C6F4E" },
    { nameAr: "بداية العام الدراسي", specificDate: new Date("2026-08-23T00:00:00Z"), color: "#5B7A99" },
  ];
  const occCount = await db.occasion.count();
  if (occCount === 0) for (const o of occasions) await db.occasion.create({ data: o });

  // ---------- محتوى تجريبي (يوليو–سبتمبر 2026) ----------
  const itemCount = await db.contentItem.count();
  if (itemCount === 0) {
    const mk = async (d) => {
      const item = await db.contentItem.create({
        data: {
          title: d.title,
          baseText: d.text || "",
          hashtags: d.tags || "",
          categoryId: cats[d.cat].id,
          statusId: d.status,
          scheduledAt: new Date(d.when),
          writerId: users.writer.id,
          designerId: d.design ? users.designer.id : null,
          createdById: users.supervisor.id,
          variants: {
            create: (d.platforms || [1]).map((pid) => ({ platformId: pid, variantText: d.variant?.[pid] || "" })),
          },
        },
      });
      if (d.status === 4) {
        await db.approval.create({
          data: { contentItemId: item.id, requestedById: users.writer.id },
        });
      }
      if (d.status >= 5) {
        await db.approval.create({
          data: {
            contentItemId: item.id, requestedById: users.writer.id,
            reviewerId: users.supervisor.id, decision: "approved",
            decisionNote: "معتمد", decidedAt: new Date(),
          },
        });
      }
      if (d.status === 6) {
        await db.platformVariant.updateMany({
          where: { contentItemId: item.id },
          data: {
            publishStatus: "published", publishedAt: new Date(d.when),
            publishedById: users.publisher.id,
            externalPostUrl: "https://x.com/j_taseel/status/000",
          },
        });
      }
      if (d.comment) {
        await db.comment.create({
          data: { contentItemId: item.id, authorId: users.supervisor.id, body: d.comment, mentions: "سلمان العتيبي" },
        });
      }
      await db.activityLog.create({
        data: { actorId: users.supervisor.id, entityType: "content_item", entityId: item.id, action: "created", detail: d.title },
      });
      return item;
    };

    await mk({ title: "بطاقة يوم عاشوراء — فضل صيامه", cat: "إنستجرام", status: 6, when: "2026-07-04T18:00:00Z", design: true, platforms: [2, 1], text: "‏يوم عاشوراء.. يكفّر السنة الماضية. لا تفوّت أجر صيامه غداً.", tags: "#عاشوراء #تأصيل_التعليمية" });
    await mk({ title: "تغريدة فضل طلب العلم", cat: "تغريدات", status: 6, when: "2026-07-06T09:00:00Z", platforms: [1], text: "‏«من سلك طريقًا يلتمس فيه علمًا سهّل الله له به طريقًا إلى الجنة» — انضموا لبرامج تأصيل التعليمية.", tags: "#طلب_العلم #تأصيل" });
    await mk({ title: "إعلان برنامج التأصيل العلمي — الدفعة الرابعة", cat: "برنامج تعليمي", status: 5, when: "2026-07-09T17:00:00Z", design: true, platforms: [1, 2, 4], text: "‏فتح باب التسجيل في برنامج التأصيل العلمي — الدفعة الرابعة. مقاعد محدودة.", tags: "#التأصيل_العلمي", comment: "يرجى التأكد من رابط التسجيل قبل النشر" });
    await mk({ title: "سلسلة حديث الجمعة (1)", cat: "تغريدات", status: 4, when: "2026-07-10T11:00:00Z", platforms: [1, 3], text: "‏حديث الجمعة: «خيركم من تعلم القرآن وعلمه».", tags: "#حديث_الجمعة", comment: "أ. سلمان: راجع صياغة المقدمة" });
    await mk({ title: "تصميم اقتباس تربوي أسبوعي", cat: "إنستجرام", status: 3, when: "2026-07-14T16:00:00Z", design: true, platforms: [2], text: "‏التربية قدوة قبل أن تكون توجيهًا." });
    await mk({ title: "منشور لينكد إن — شراكات القطاع التعليمي", cat: "لينكد إن", status: 2, when: "2026-07-16T10:00:00Z", platforms: [4], text: "‏تفتح جمعية تأصيل التعليمية باب الشراكات المجتمعية." });
    await mk({ title: "ملتقى أولياء الأمور — دعوة حضورية", cat: "فعالية حضورية", status: 2, when: "2026-07-21T19:00:00Z", design: true, platforms: [1, 3] });
    await mk({ title: "سلسلة حديث الجمعة (2)", cat: "تغريدات", status: 1, when: "2026-07-17T11:00:00Z", platforms: [1, 3] });
    await mk({ title: "فيديو تعريفي بمسارات الحفظ", cat: "برنامج تعليمي", status: 1, when: "2026-07-27T15:00:00Z", design: true, platforms: [2, 1] });
    await mk({ title: "بطاقة بداية العام الدراسي", cat: "إنستجرام", status: 1, when: "2026-08-23T07:00:00Z", design: true, platforms: [2, 1, 3] });
    await mk({ title: "حملة اليوم الوطني — نحن أهل العزم", cat: "فعالية حضورية", status: 1, when: "2026-09-23T09:00:00Z", design: true, platforms: [1, 2, 3, 4] });
    await mk({ title: "تقرير إنجازات الربع الثالث", cat: "لينكد إن", status: 1, when: "2026-09-29T12:00:00Z", platforms: [4] });
    await mk({ title: "رسالة تذكير عبر قناة واتساب — موعد الحلقة", cat: "برنامج تعليمي", status: 4, when: "2026-07-13T14:00:00Z", platforms: [5, 1], text: "📢 تذكير: حلقة «التأصيل العلمي» غداً بعد صلاة العشاء. رابط الحضور في القناة.", tags: "#تأصيل" });
    await mk({ title: "بث مباشر عبر واتساب لطلاب الحلقة", cat: "فعالية حضورية", status: 6, when: "2026-07-05T16:00:00Z", platforms: [5], text: "انضموا لقناتنا على واتساب لمتابعة البث والتنبيهات.", tags: "#تأصيل_التعليمية" });
    await mk({ title: "نشر ملخص الحلقة عبر قناة تليجرام", cat: "برنامج تعليمي", status: 5, when: "2026-07-12T20:00:00Z", platforms: [6, 5], text: "📄 ملخص حلقة هذا الأسبوع + الملف المرفق متاح الآن على قناتنا في تليجرام.", tags: "#التأصيل_العلمي" });
    await mk({ title: "استطلاع رأي المتابعين على تليجرام", cat: "تغريدات", status: 2, when: "2026-07-19T18:00:00Z", platforms: [6], text: "شاركونا رأيكم في موضوعات الحلقات القادمة عبر استطلاع القناة." });
  }

  console.log("Seed completed.");
}

main().finally(() => db.$disconnect());
