# دليل نشر منصة تأصيل — Firebase App Hosting + Supabase

> التطبيق Next.js في هذا المجلد (`platform/`). قاعدة البيانات وتخزين الوسائط على Supabase، والتشغيل على Firebase App Hosting. هذا الدليل مبسّط للمرة الأولى — القسم (أ) خطواتك، والقسم (ب) ما يتولّاه المطوّر.

## المتطلبات مرة واحدة
- حساب Google (لـ Firebase) وحساب Supabase وحساب GitHub.

---

## (أ) خطواتك أنت

### 1) Supabase (قاعدة البيانات + التخزين)
1. أنشئ مشروعاً جديداً على supabase.com (احفظ كلمة مرور قاعدة البيانات).
2. من **Storage** → أنشئ **bucket** عاماً باسم `media` (Public bucket).
3. من **Project Settings → Database** انسخ:
   - **Connection string** نوع *Transaction/Pooler* (المنفذ `6543`) → هذا `DATABASE_URL` (أضف `?pgbouncer=true&connection_limit=1`).
   - **Connection string** نوع *Direct* (المنفذ `5432`) → هذا `DIRECT_URL`.
4. من **Project Settings → API** انسخ: **Project URL** (`SUPABASE_URL`) و مفتاح **service_role** (`SUPABASE_SERVICE_ROLE_KEY`).

### 2) GitHub
- أنشئ مستودعاً خاصاً جديداً (فارغاً) — انسخ رابطه.

سلّم القيم الأربعة من Supabase + رابط GitHub، ويُكمل المطوّر التحويل والرفع.

### 3) Firebase (يُنجز غالباً معك بعد الرفع)
1. أنشئ مشروعاً على console.firebase.google.com، وفعّل **App Hosting**.
2. اربط مستودع GitHub، واضبط **Root directory** = `platform`، والفرع = `main`.
3. اضبط الأسرار (Secret Manager) — عبر الأمر التالي لكل سرّ (بعد `firebase login` و`firebase use <project>`):
   ```bash
   firebase apphosting:secrets:set NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
   firebase apphosting:secrets:set SESSION_SECRET
   firebase apphosting:secrets:set DATABASE_URL
   firebase apphosting:secrets:set DIRECT_URL
   firebase apphosting:secrets:set SUPABASE_URL
   firebase apphosting:secrets:set SUPABASE_SERVICE_ROLE_KEY
   ```
4. اعتمد الإصدار (Rollout) — أول نشر يبني ويشغّل تلقائياً.

> **الذكاء الاصطناعي (اختياري):** لتفعيل زر التوليد لاحقاً: `firebase apphosting:secrets:set ANTHROPIC_API_KEY` ثم أزل التعليق عن مدخل `ANTHROPIC_API_KEY` في `apphosting.yaml` وأعد النشر.

---

## (ب) ما يتولّاه المطوّر (بعد استلام قيم Supabase + GitHub)
1. تحويل Prisma إلى PostgreSQL (`provider = "postgresql"` + `directUrl`).
2. إنشاء الجداول على Supabase: `npx prisma db push` (باستخدام `DIRECT_URL`).
3. بذر البيانات الأساسية: `npm run db:seed`.
4. إنشاء الأسرار محلياً في `.env` (انظر `.env.example`) والتحقق من البناء.
5. رفع الكود إلى مستودع GitHub.
6. متابعة ربط Firebase (القسم أ-3) حتى أول نشر ناجح.

## ملاحظات تقنية مطبّقة مسبقاً
- `apphosting.yaml`: إعداد التشغيل والأسرار (بما فيها مفتاح تشفير Server Actions الحاضر وقت البناء — ضروري لتفادي أخطاء "Failed to find Server Action" على النسخ المتعددة).
- `package.json`: `postinstall: prisma generate` و`build: prisma generate && next build` (Node ≥ 20).
- رفع الوسائط: `src/lib/storage.ts` يستخدم Supabase Storage عند توفّر المفاتيح، ويسقط للقرص المحلي في التطوير.
- `.gitignore`: يستثني `.env` وقاعدة SQLite المحلية والملفات المرفوعة محلياً.
