import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

// تخزين الوسائط: يستخدم Supabase Storage في الإنتاج (عند توفّر المفاتيح)،
// ويسقط تلقائياً إلى القرص المحلي (public/uploads) في التطوير — فلا شيء ينكسر بلا مفاتيح.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.SUPABASE_BUCKET || "media";

export const usingSupabaseStorage = Boolean(SUPABASE_URL && SERVICE_KEY);

let _client: SupabaseClient | null = null;
function supabase(): SupabaseClient {
  if (!_client) {
    // مفتاح service_role للخادم فقط — يتجاوز RLS، ولا يُرسَل للمتصفح أبداً
    _client = createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
      auth: { persistSession: false },
    });
  }
  return _client;
}

/**
 * يخزّن ملفاً مرفوعاً ويعيد مساراً عاماً (URL كامل في الإنتاج، أو /uploads/... محلياً).
 * لا يغيّر شكل المخرجات المستهلكة في الواجهة (filePath يُستخدم مباشرة كـ src/href).
 */
export async function storeFile(
  buffer: Buffer,
  ext: string,
  mimeType: string,
): Promise<{ filePath: string }> {
  const name = `${crypto.randomUUID()}.${ext}`;
  if (usingSupabaseStorage) {
    const { error } = await supabase()
      .storage.from(BUCKET)
      .upload(name, buffer, { contentType: mimeType, upsert: false });
    if (error) throw new Error(`فشل رفع الملف إلى التخزين: ${error.message}`);
    const { data } = supabase().storage.from(BUCKET).getPublicUrl(name);
    return { filePath: data.publicUrl };
  }
  // fallback محلي (تطوير)
  const dir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buffer);
  return { filePath: `/uploads/${name}` };
}

/**
 * يُصدر رابط رفع موقّعاً يسمح للمتصفح برفع ملف واحد مباشرةً إلى التخزين
 * دون المرور بالخادم — وبذلك نتجاوز حد جسم الطلب (~4.5MB على Vercel).
 * يعيد أيضاً الرابط العام النهائي للملف. متاح في الإنتاج فقط (عند توفّر المفاتيح).
 */
export async function createSignedUploadUrl(
  path: string,
): Promise<{ signedUrl: string; publicUrl: string } | { error: string }> {
  if (!usingSupabaseStorage) return { error: "no-storage" };
  const { data, error } = await supabase().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: error?.message ?? "تعذّر إنشاء رابط الرفع" };
  const { data: pub } = supabase().storage.from(BUCKET).getPublicUrl(path);
  return { signedUrl: data.signedUrl, publicUrl: pub.publicUrl };
}

/**
 * تحقّق أن الرابط يعود لتخزيننا نحن — يمنع حقن روابط خارجية عبر الحقل المخفي
 * (المتصفح يرسل الرابط النهائي، فنرفض أي شيء لا ينتمي لحاوية التخزين العامة).
 */
export function isOwnStorageUrl(url: string): boolean {
  if (usingSupabaseStorage) return url.startsWith(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`);
  return url.startsWith("/uploads/");
}
