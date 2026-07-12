"use client";

// مكتبة الوسائط المركزية (FR-23/24): مجلدات، وسوم، إصدارات لكل أصل

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadAsset, uploadAssetVersion } from "@/app/actions";
import { uploadFileDirect } from "@/lib/upload-client";
import Icon from "./Icon";

export const FOLDERS = ["شعارات", "قوالب", "صور عامة", "عام"];

export type AssetRow = {
  id: string;
  name: string;
  folder: string;
  tags: string;
  uploadedBy: string;
  versions: {
    id: string;
    versionNo: number;
    filePath: string;
    mimeType: string;
    sizeBytes: number;
    note: string;
    uploadedBy: string;
    createdAt: string;
  }[];
};

export function AssetThumb({ filePath, mimeType, className = "" }: { filePath: string; mimeType: string; className?: string }) {
  if (mimeType.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={filePath} alt="" className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <div className={`flex h-full w-full items-center justify-center bg-sand-100 text-steel-500 ${className}`}>
      <Icon name={mimeType === "application/pdf" ? "clipboard" : mimeType.startsWith("video/") ? "image" : "link"} size={32} />
    </div>
  );
}

export function fmtSize(bytes: number) {
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
}

export default function MediaLibrary({ assets, canUpload }: { assets: AssetRow[]; canUpload: boolean }) {
  const [folder, setFolder] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const filtered = folder ? assets.filter((a) => a.folder === folder) : assets;

  // يرفع الملف مباشرةً للتخزين (يتجاوز حد جسم الطلب) ويستبدله بمرجعه في الطلب.
  // يعيد رسالة خطأ إن فشل، أو null عند النجاح/السقوط للمسار المحلي.
  async function prepDirectUpload(formData: FormData): Promise<string | null> {
    const file = formData.get("file") as File | null;
    if (!file || file.size === 0) return null;
    const up = await uploadFileDirect(file);
    if (up && "error" in up) return up.error;
    if (up) { formData.delete("file"); formData.set("fileMeta", JSON.stringify(up)); }
    return null;
  }

  function submitUpload(formData: FormData) {
    startTransition(async () => {
      const upErr = await prepDirectUpload(formData);
      if (upErr) { setMsg(`⚠ ${upErr}`); return; }
      const res = await uploadAsset(formData);
      const err = res && "error" in res ? res.error : null;
      setMsg(err ? `⚠ ${err}` : "✓ رُفع الملف بنجاح");
      if (!err) router.refresh();
    });
  }

  function submitVersion(assetId: string, formData: FormData) {
    startTransition(async () => {
      const upErr = await prepDirectUpload(formData);
      if (upErr) { setMsg(`⚠ ${upErr}`); return; }
      const res = await uploadAssetVersion(assetId, formData);
      const err = res && "error" in res ? res.error : null;
      setMsg(err ? `⚠ ${err}` : "✓ أُضيف الإصدار الجديد");
      if (!err) router.refresh();
    });
  }

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-heading text-3xl font-black text-navy-900">مكتبة الوسائط</h1>
        <p className="mt-1 text-sm text-steel-500">
          شعارات الجمعية وقوالبها وتصاميمها — بنظام إصدارات يحفظ كل النسخ السابقة (FR-24)
        </p>
      </div>

      {msg && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-steel-300/60 bg-white px-4 py-2 text-sm">
          {msg}
          <button onClick={() => setMsg(null)} className="font-bold"><Icon name="close" size={15} /></button>
        </div>
      )}

      {canUpload && (
        <form action={submitUpload} className="mb-6 rounded-xl border border-sand-300 bg-sand-100/40 p-4">
          <h2 className="mb-3 font-heading text-base font-bold text-navy-900">رفع ملف جديد</h2>
          <div className="grid gap-3 md:grid-cols-4">
            <input type="file" name="file" required accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4"
              className="rounded-lg border border-steel-300 bg-white px-3 py-2 text-sm file:ml-3 file:rounded file:border-0 file:bg-navy-700 file:px-3 file:py-1 file:text-cream-50" />
            <input name="name" placeholder="اسم الملف (اختياري)" className="rounded-lg border border-steel-300 bg-white px-3 py-2 text-sm" />
            <select name="folder" className="rounded-lg border border-steel-300 bg-white px-3 py-2 text-sm">
              {FOLDERS.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
            <input name="tags" placeholder="وسوم مفصولة بفواصل" className="rounded-lg border border-steel-300 bg-white px-3 py-2 text-sm" />
          </div>
          <button disabled={pending} className="mt-3 rounded-lg bg-navy-900 px-5 py-2 text-sm font-bold text-cream-50 disabled:opacity-60">
            {pending ? "جارٍ الرفع..." : <span className="inline-flex items-center gap-1.5"><Icon name="upload" size={15} /> رفع</span>}
          </button>
          <span className="mr-3 text-xs text-steel-500">المسموح: صور، PDF، فيديو MP4 — حتى 20MB</span>
        </form>
      )}

      {/* فلترة المجلدات */}
      <div className="mb-4 flex flex-wrap gap-2">
        <button onClick={() => setFolder(null)}
          className={`rounded-full border px-3 py-1 text-xs font-bold ${!folder ? "border-navy-900 bg-navy-900 text-cream-50" : "border-steel-300 bg-white text-steel-500"}`}>
          الكل ({assets.length})
        </button>
        {FOLDERS.map((f) => {
          const count = assets.filter((a) => a.folder === f).length;
          return (
            <button key={f} onClick={() => setFolder(folder === f ? null : f)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${folder === f ? "border-navy-900 bg-navy-900 text-cream-50" : "border-steel-300 bg-white text-steel-500"}`}>
              <Icon name="folder" size={13} /> {f} ({count})
            </button>
          );
        })}
      </div>

      {/* الشبكة */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
        {filtered.map((a) => {
          const current = a.versions[0];
          return (
            <div key={a.id} className="overflow-hidden rounded-xl border border-steel-300/60 bg-white shadow-sm">
              <div className="h-36">
                {current && <AssetThumb filePath={current.filePath} mimeType={current.mimeType} />}
              </div>
              <div className="p-3">
                <div className="truncate text-sm font-bold text-navy-900">{a.name}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-steel-500">
                  <Icon name="folder" size={12} /> {a.folder} · الإصدار {current?.versionNo} · {current && fmtSize(current.sizeBytes)}
                </div>
                {a.tags && <div className="mt-1 flex items-center gap-1 truncate text-[10px] text-sand-600"><Icon name="tag" size={11} /> {a.tags}</div>}
                <button onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                  className="mt-2 w-full rounded-lg border border-steel-300/60 py-1.5 text-xs font-bold text-navy-700 hover:bg-cream-50">
                  {expanded === a.id ? "إخفاء الإصدارات" : `الإصدارات (${a.versions.length})`}
                </button>

                {expanded === a.id && (
                  <div className="mt-2">
                    <ul className="flex flex-col gap-1.5">
                      {a.versions.map((v) => (
                        <li key={v.id} className="flex items-center gap-2 rounded-lg bg-cream-50/80 px-2 py-1.5 text-[11px]">
                          <span className="font-bold text-navy-900">v{v.versionNo}</span>
                          <a href={v.filePath} target="_blank" className="text-navy-700 underline">فتح</a>
                          <span className="text-steel-500">{fmtSize(v.sizeBytes)} · {v.uploadedBy}</span>
                          {v.note && <span className="truncate text-steel-500">— {v.note}</span>}
                        </li>
                      ))}
                    </ul>
                    {canUpload && (
                      <form action={(fd) => submitVersion(a.id, fd)} className="mt-2 flex flex-col gap-1.5">
                        <input type="file" name="file" required accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,video/mp4"
                          className="rounded border border-steel-300 bg-white px-2 py-1 text-[11px]" />
                        <div className="flex gap-1.5">
                          <input name="note" placeholder="وصف التغيير" className="min-w-0 flex-1 rounded border border-steel-300 bg-white px-2 py-1 text-[11px]" />
                          <button disabled={pending} className="rounded bg-sand-600 px-2.5 py-1 text-[11px] font-bold text-white disabled:opacity-60">
                            + إصدار
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-xl border border-dashed border-steel-300 bg-white py-16 text-center text-steel-500">
          لا ملفات في هذا المجلد بعد
        </div>
      )}
    </div>
  );
}
