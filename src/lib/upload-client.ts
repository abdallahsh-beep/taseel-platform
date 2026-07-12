import { createSignedUpload } from "@/app/actions";

// رفع الملفات من المتصفح مباشرةً إلى التخزين (يتجاوز حد جسم الطلب على الخادم ~4.5MB).
// الخطوات: نطلب رابطاً موقّعاً من الخادم، ثم نرفع الملف مباشرةً إليه، ثم نمرّر الرابط فقط للإجراء.

export type UploadedMeta = { filePath: string; mimeType: string; sizeBytes: number; name: string };
const MAX_BYTES = 20 * 1024 * 1024;

/**
 * يرفع ملفاً مباشرةً إلى التخزين ويعيد بياناته.
 * - عند النجاح: { filePath, mimeType, sizeBytes, name }.
 * - عند خطأ متوقّع (حجم/نوع/فشل رفع): { error }.
 * - عند غياب تهيئة التخزين (تطوير محلي): null — على المستدعي إرسال الملف نفسه في الطلب.
 */
export async function uploadFileDirect(
  file: File,
): Promise<UploadedMeta | { error: string } | null> {
  if (file.size === 0) return { error: "الملف فارغ" };
  if (file.size > MAX_BYTES) return { error: "حجم الملف يتجاوز 20MB" };

  const info = await createSignedUpload(file.type);
  if ("error" in info) return info.error === "no-storage" ? null : { error: info.error };

  const put = await fetch(info.signedUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!put.ok) return { error: `تعذّر رفع الملف (${put.status})` };

  return { filePath: info.publicUrl, mimeType: file.type, sizeBytes: file.size, name: file.name.slice(0, 120) };
}
