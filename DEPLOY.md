# دليل نشر منصة تأصيل — Vercel + Supabase

> التطبيق Next.js في هذا المجلد (`platform/`). قاعدة البيانات وتخزين الوسائط على Supabase، والتشغيل على Vercel (مجاني، بلا بطاقة).

## النشر على Vercel (نقرات في المتصفح)
1. ادخل [vercel.com](https://vercel.com) عبر **Continue with GitHub**.
2. **Add New → Project** → استورد مستودع `taseel-platform` (فوّض تطبيق Vercel على GitHub إن طُلب).
3. في **Configure Project**:
   - **Root Directory:** اضغط Edit واختر `platform`.
   - Framework: Next.js (يُكتشف تلقائياً). اترك أوامر البناء الافتراضية.
   - **Environment Variables:** أضِف المتغيرات التالية (الأسماء ثابتة، والقيم تُ�عطى بشكل منفصل — لا تُلتزم في المستودع):
     - `DATABASE_URL` (Supabase pooled، منفذ 6543، مع `?pgbouncer=true&connection_limit=1`)
     - `DIRECT_URL` (Supabase direct، منفذ 5432)
     - `SESSION_SECRET`
     - `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `SUPABASE_BUCKET` = `media`
     - `ANTHROPIC_API_KEY` (اختياري — لتفعيل توليد النص بالذكاء الاصطناعي)
4. **Deploy** — أول بناء يستغرق ~2 دقيقة، ثم يظهر رابط عام دائم.
5. أي `git push` لاحق يُعيد النشر تلقائياً.

## إعدادات مطبّقة مسبقاً في الكود
- `package.json`: `postinstall: prisma generate` و`build: prisma generate && next build` (Node ≥ 20).
- تخزين الوسائط: `src/lib/storage.ts` يستخدم Supabase Storage عند توفّر المفاتيح (وإلا القرص المحلي في التطوير).
- `.gitignore`: يستثني `.env` وقاعدة SQLite المحلية والملفات المرفوعة محلياً.

## ملاحظات مهمة
- **حد رفع الملفات على Vercel:** دوال Vercel تقبل جسم طلب حتى ~4.5MB، فالصور الأكبر قد تفشل. لرفع ملفات أكبر لاحقاً نحوّل الرفع إلى Supabase مباشرة من المتصفح (تحسين لاحق).
- **قاعدة التطوير والإنتاج واحدة (Supabase)** حالياً للتبسيط.
- بعد التأكد من عمل النشر: يُستحسن تدوير كلمة مرور قاعدة Supabase ومفتاح `secret` احتياطاً.
