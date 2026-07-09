"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SessionLite } from "@/lib/types";
import { STATUS_COLORS } from "@/lib/types";
import { STATUS, canApprove, canPublish, canEditText } from "@/lib/workflow";
import { hijriFullLabel, gregLabel } from "@/lib/hijri";
import { saveItemTexts, moveItem, approveItem, rejectItem, publishItem, addComment, linkAssetToItem, unlinkAssetFromItem, createShareLink, setItemCampaign, setItemLabels, createCampaign, saveTemplate, uploadCardImage, generateDraft } from "@/app/actions";
import PostPreview from "./PostPreview";
import PlatformIcon from "./PlatformIcon";
import EmojiPicker, { expandShortcodes } from "./EmojiPicker";
import { AssetThumb, fmtSize } from "./MediaLibrary";
import Icon from "./Icon";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ItemFull = any; // شكل الاستجابة من /api/item/[id]

export default function CardModal({
  itemId,
  user,
  onClose,
}: {
  itemId: string;
  user: SessionLite;
  onClose: () => void;
}) {
  const [item, setItem] = useState<ItemFull | null>(null);
  const [title, setTitle] = useState("");
  const [baseText, setBaseText] = useState("");
  const [hashtags, setHashtags] = useState("");
  const [variantTexts, setVariantTexts] = useState<Record<string, string>>({});
  const [previewTab, setPreviewTab] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [rejectTo, setRejectTo] = useState(2);
  const [showReject, setShowReject] = useState(false);
  const [publishLinks, setPublishLinks] = useState<Record<string, string>>({});
  const [showPublish, setShowPublish] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [showPicker, setShowPicker] = useState(false);
  const [pickerAssets, setPickerAssets] = useState<any[] | null>(null);
  const [showShare, setShowShare] = useState(false);
  const [shareDays, setShareDays] = useState(7);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<{ start: number; end: number; quote: string } | null>(null);
  // الحملات والوسوم والقوالب والذكاء الاصطناعي
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [labels, setLabels] = useState<string>("");
  const [newCampaign, setNewCampaign] = useState("");
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiPending, setAiPending] = useState(false);
  const [tplName, setTplName] = useState("");
  const [showTpl, setShowTpl] = useState(false);
  const baseRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function openPicker() {
    setShowPicker(true);
    if (!pickerAssets) {
      const res = await fetch("/api/media");
      if (res.ok) setPickerAssets(await res.json());
      else setPickerAssets([]);
    }
  }

  async function reload() {
    const res = await fetch(`/api/item/${itemId}`);
    if (res.ok) {
      const data = await res.json();
      setItem(data);
      setTitle(data.title);
      setBaseText(data.baseText);
      setHashtags(data.hashtags);
      setCampaignId(data.campaignId ?? "");
      setLabels(data.labels ?? "");
      const vt: Record<string, string> = {};
      for (const v of data.variants) vt[v.id] = v.variantText;
      setVariantTexts(vt);
      setPreviewTab(data.variants[0]?.platform.key ?? null);
    }
  }
  useEffect(() => {
    reload();
    fetch("/api/composer-meta")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) { setCampaigns(d.campaigns ?? []); setTemplates(d.templates ?? []); } })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  // إدراج إيموجي عند موضع المؤشر في النص الأساسي
  function insertEmoji(emoji: string) {
    const el = baseRef.current;
    if (!el) { setBaseText((t) => t + emoji); return; }
    const s = el.selectionStart ?? baseText.length;
    const e = el.selectionEnd ?? baseText.length;
    const next = baseText.slice(0, s) + emoji + baseText.slice(e);
    setBaseText(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + emoji.length; });
  }

  function run(fn: () => Promise<{ error?: string; ok?: boolean; reverted?: boolean } | undefined>, okMsg: string) {
    startTransition(async () => {
      const res = await fn();
      if (res?.error) setMsg({ kind: "err", text: res.error });
      else {
        setMsg({ kind: "ok", text: res && "reverted" in res && res.reverted ? `${okMsg} — أُعيدت البطاقة للاعتماد لأنها كانت معتمدة` : okMsg });
        await reload();
        router.refresh();
      }
    });
  }

  if (!item) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/50" onClick={onClose}>
        <div className="rounded-xl bg-white px-8 py-6 text-steel-500">جارٍ التحميل...</div>
      </div>
    );
  }

  const d = new Date(item.scheduledAt);
  const editable = canEditText(user.roles) && item.statusId !== STATUS.PUBLISHED;
  // زر «إرسال للاعتماد» يظهر فقط لمن يملك دوراً منتجاً (لا لمسؤول النشر)
  const canProduce = user.roles.some((r) => ["admin", "supervisor", "writer", "designer"].includes(r));
  const sendableFrom = canProduce && [STATUS.IDEA, STATUS.WRITING, STATUS.DESIGN].includes(item.statusId);
  const pendingApproval = item.approvals?.find((a: any) => a.decision === "pending");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-navy-950/50 p-4" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="my-4 w-full max-w-4xl rounded-2xl bg-cream-50 shadow-2xl"
      >
        {/* الترويسة */}
        <div className="flex items-start justify-between gap-3 rounded-t-2xl bg-navy-900 p-5 text-cream-50">
          <div className="min-w-0">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="rounded px-2 py-0.5 text-xs font-bold" style={{ background: STATUS_COLORS[item.statusId], color: "#fff" }}>
                {item.status.labelAr}
              </span>
              <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-navy-900" style={{ background: item.category.color, color: "#fff" }}>
                {item.category.nameAr}
              </span>
              {item.campaign && (
                <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ background: item.campaign.color }}>
                  <Icon name="campaign" size={12} /> {item.campaign.name}
                </span>
              )}
              {(item.labels ?? "").split(",").map((s: string) => s.trim()).filter(Boolean).map((lb: string) => (
                <span key={lb} className="rounded-full bg-navy-700/60 px-2 py-0.5 text-[11px] text-cream-50">#{lb}</span>
              ))}
            </div>
            <h2 className="truncate font-heading text-2xl font-black">{item.title}</h2>
            <p className="mt-1 inline-flex flex-wrap items-center gap-1 text-sm text-sand-300">
              <Icon name="calendar" size={13} /> {gregLabel(d)} — {hijriFullLabel(d)}
              {item.writer && <span className="mr-3 inline-flex items-center gap-1"><Icon name="edit" size={13} /> {item.writer.name}</span>}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {user.roles.some((r) => ["admin", "supervisor"].includes(r)) && (
              <button
                onClick={() => setShowShare(!showShare)}
                title="مشاركة رابط معاينة للقراءة فقط"
                className="rounded-lg px-2 py-1 hover:bg-navy-700"
              >
                <Icon name="link" size={18} />
              </button>
            )}
            <button onClick={onClose} className="rounded-lg px-2 py-1 hover:bg-navy-700"><Icon name="close" size={18} /></button>
          </div>
        </div>

        {showShare && (
          <div className="mx-5 mt-4 rounded-xl border border-navy-700/30 bg-white p-4">
            <h3 className="mb-2 font-heading text-base font-bold text-navy-900">رابط معاينة للضيوف — قراءة فقط (FR-39)</h3>
            <p className="mb-3 text-xs text-steel-500">
              يعرض محتوى المنشور ومعايناته فقط — دون التعليقات الداخلية أو أسماء الفريق، وينتهي تلقائياً.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <select value={shareDays} onChange={(e) => setShareDays(Number(e.target.value))} className="rounded-lg border border-steel-300 bg-white px-3 py-2 text-sm">
                <option value={3}>صلاحية 3 أيام</option>
                <option value={7}>صلاحية 7 أيام</option>
                <option value={30}>صلاحية 30 يوماً</option>
              </select>
              <button
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await createShareLink("item", item.id, null, shareDays);
                    if ("error" in res && res.error) setMsg({ kind: "err", text: res.error });
                    else if ("url" in res) setShareUrl(`${window.location.origin}${res.url}`);
                  })
                }
                className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-bold text-cream-50 disabled:opacity-60"
              >
                إنشاء الرابط
              </button>
            </div>
            {shareUrl && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-cream-50 p-2">
                <input readOnly value={shareUrl} dir="ltr" className="min-w-0 flex-1 bg-transparent px-2 text-left text-xs" onFocus={(e) => e.target.select()} />
                <button
                  onClick={() => { navigator.clipboard.writeText(shareUrl); setMsg({ kind: "ok", text: "نُسخ الرابط" }); }}
                  className="inline-flex shrink-0 items-center gap-1 rounded bg-sand-500 px-3 py-1.5 text-xs font-bold text-navy-900"
                >
                  <Icon name="copy" size={13} /> نسخ
                </button>
              </div>
            )}
          </div>
        )}

        {msg && (
          <div className={`mx-5 mt-4 rounded-lg px-4 py-2 text-sm ${msg.kind === "ok" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
            {msg.text}
          </div>
        )}

        <div className="grid gap-5 p-5 lg:grid-cols-2">
          {/* اليمين: التحرير */}
          <div>
            <h3 className="mb-2 font-heading text-lg font-bold text-navy-900">المحتوى</h3>

            {/* الحملة والوسوم (Planable Campaign + Labels) */}
            <div className="mb-3 rounded-lg border border-steel-300/70 bg-white p-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-steel-500"><Icon name="campaign" size={13} /> الحملة</span>
                <select
                  value={campaignId}
                  disabled={!editable}
                  onChange={(e) => { setCampaignId(e.target.value); run(() => setItemCampaign(item.id, e.target.value || null), "حُدّثت الحملة"); }}
                  className="flex-1 rounded-lg border border-steel-300 bg-white px-2 py-1.5 text-sm disabled:bg-cream-50"
                >
                  <option value="">— بدون حملة —</option>
                  {campaigns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
                </select>
                {editable && (
                  <button type="button" onClick={() => setShowNewCampaign((s) => !s)} title="حملة جديدة"
                    className="rounded-lg border border-navy-700 px-2 py-1.5 text-xs font-bold text-navy-700 hover:bg-navy-700 hover:text-cream-50">
                    ＋
                  </button>
                )}
              </div>
              {showNewCampaign && (
                <div className="mt-2 flex gap-2">
                  <input value={newCampaign} onChange={(e) => setNewCampaign(e.target.value)} placeholder="اسم الحملة الجديدة"
                    className="flex-1 rounded-lg border border-steel-300 px-2 py-1.5 text-sm" />
                  <button type="button" disabled={pending || !newCampaign.trim()}
                    onClick={() => startTransition(async () => {
                      const res = await createCampaign(newCampaign.trim(), "#304F6D");
                      if ("error" in res && res.error) setMsg({ kind: "err", text: res.error });
                      else if ("id" in res && res.id) {
                        setCampaigns((cs) => [{ id: res.id, name: res.name, color: res.color }, ...cs]);
                        setCampaignId(res.id);
                        setNewCampaign(""); setShowNewCampaign(false);
                        await setItemCampaign(item.id, res.id); await reload(); router.refresh();
                        setMsg({ kind: "ok", text: "أُنشئت الحملة ورُبطت بالبطاقة" });
                      }
                    })}
                    className="rounded-lg bg-navy-700 px-3 py-1.5 text-xs font-bold text-cream-50 disabled:opacity-60">
                    إنشاء
                  </button>
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-bold text-steel-500"><Icon name="tag" size={13} /> وسوم:</span>
                {labels.split(",").map((s) => s.trim()).filter(Boolean).map((lb) => (
                  <span key={lb} className="inline-flex items-center gap-1 rounded-full bg-sand-100 px-2 py-0.5 text-[11px] font-bold text-navy-900">
                    {lb}
                    {editable && (
                      <button type="button" title="إزالة" className="text-red-600"
                        onClick={() => {
                          const next = labels.split(",").map((s) => s.trim()).filter((s) => s && s !== lb).join(",");
                          setLabels(next); run(() => setItemLabels(item.id, next), "حُدّثت الوسوم");
                        }}><Icon name="close" size={12} /></button>
                    )}
                  </span>
                ))}
                {editable && (
                  <input
                    placeholder="أضف وسماً ثم Enter"
                    className="w-32 rounded-full border border-steel-300 px-2 py-0.5 text-[11px]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (!val) return;
                        const cur = labels.split(",").map((s) => s.trim()).filter(Boolean);
                        if (!cur.includes(val)) {
                          const next = [...cur, val].join(",");
                          setLabels(next); run(() => setItemLabels(item.id, next), "حُدّثت الوسوم");
                        }
                        (e.target as HTMLInputElement).value = "";
                      }
                    }}
                  />
                )}
              </div>
            </div>

            <label className="mb-1 block text-xs font-bold text-steel-500">العنوان</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!editable}
              className="mb-3 w-full rounded-lg border border-steel-300 bg-white px-3 py-2 disabled:bg-cream-50"
            />
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-bold text-steel-500">
                النص الأساسي المشترك
                <span className="mr-2 inline-flex items-center gap-1 font-normal text-steel-500">(ظلّل مقطعاً ثم اضغط <Icon name="pin" size={12} /> لتعليق توضيحي)</span>
              </label>
              {editable && (
                <div className="flex items-center gap-1">
                  <EmojiPicker onPick={insertEmoji} />
                  <button
                    type="button"
                    onClick={() => setAiOpen((o) => !o)}
                    title="توليد مسودة بالذكاء الاصطناعي (Claude)"
                    className="inline-flex items-center gap-1 rounded-lg border border-sand-600 bg-sand-100 px-2 py-1 text-xs font-bold text-navy-900 hover:bg-sand-500"
                  >
                    <Icon name="ai" size={13} /> توليد بالذكاء الاصطناعي
                  </button>
                </div>
              )}
            </div>

            {aiOpen && editable && (
              <div className="mb-2 rounded-lg border border-sand-500 bg-sand-100/60 p-3">
                <p className="mb-1.5 text-[11px] text-ink-900/80">
                  يكتب المساعد مسودة عربية تناسب جمعية تأصيل — لمنصة «{previewTab ?? "عام"}» بحسب العنوان أدناه وتعليماتك.
                </p>
                <textarea
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                  rows={2}
                  placeholder="تعليمات اختيارية: النبرة، الفكرة، دعوة لإجراء معيّن…"
                  className="mb-2 w-full rounded border border-steel-300 px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  disabled={aiPending}
                  onClick={() => {
                    setAiPending(true);
                    startTransition(async () => {
                      const catName = item.category?.nameAr as string | undefined;
                      const res = await generateDraft({
                        title,
                        platformKey: previewTab ?? "x",
                        instructions: aiInstructions,
                        categoryName: catName,
                      });
                      setAiPending(false);
                      if ("error" in res && res.error) setMsg({ kind: "err", text: res.error });
                      else if ("text" in res && res.text) {
                        setBaseText(res.text);
                        setMsg({ kind: "ok", text: "أُنشئت مسودة — راجعها ثم اضغط «حفظ التعديلات»" });
                      }
                    });
                  }}
                  className="rounded-lg bg-navy-900 px-4 py-1.5 text-sm font-bold text-cream-50 disabled:opacity-60"
                >
                  {aiPending ? "جارٍ التوليد…" : "توليد المسودة"}
                </button>
              </div>
            )}

            <textarea
              ref={baseRef}
              value={baseText}
              onChange={(e) => setBaseText(expandShortcodes(e.target.value))}
              onSelect={(e) => {
                const t = e.target as HTMLTextAreaElement;
                if (t.selectionStart !== t.selectionEnd) {
                  setAnchor({
                    start: t.selectionStart,
                    end: t.selectionEnd,
                    quote: baseText.slice(t.selectionStart, t.selectionEnd).slice(0, 80),
                  });
                }
              }}
              disabled={!editable}
              rows={4}
              className="mb-3 w-full rounded-lg border border-steel-300 bg-white px-3 py-2 leading-6 disabled:bg-cream-50"
            />
            <label className="mb-1 block text-xs font-bold text-steel-500">الهاشتاقات</label>
            <input
              value={hashtags}
              onChange={(e) => setHashtags(e.target.value)}
              disabled={!editable}
              className="mb-4 w-full rounded-lg border border-steel-300 bg-white px-3 py-2 disabled:bg-cream-50"
            />

            {/* نسخ المنصات مع عدادات الأحرف (FR-08/09) */}
            <h3 className="mb-2 font-heading text-lg font-bold text-navy-900">نسخ المنصات</h3>
            <div className="flex flex-col gap-3">
              {item.variants.map((v: any) => {
                const text = variantTexts[v.id] ?? "";
                const effective = text || baseText;
                const over = effective.length > v.platform.maxChars;
                return (
                  <div key={v.id} className={`rounded-lg border bg-white p-3 ${over ? "border-red-400" : "border-steel-300/70"}`}>
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-navy-900">
                        <PlatformIcon platform={v.platform.key} size={15} />
                        {v.platform.nameAr}
                      </span>
                      <span className={`text-xs font-bold ${over ? "text-red-600" : "text-steel-500"}`} dir="ltr">
                        {effective.length} / {v.platform.maxChars}
                      </span>
                    </div>
                    <textarea
                      value={text}
                      onChange={(e) => setVariantTexts({ ...variantTexts, [v.id]: e.target.value })}
                      disabled={!editable}
                      rows={2}
                      placeholder="فارغ = يُستخدم النص الأساسي"
                      className="w-full rounded border border-steel-300/60 px-2 py-1.5 text-sm leading-6 disabled:bg-cream-50"
                    />
                    {over && <p className="mt-1 text-xs font-bold text-red-600">تجاوز حد المنصة — لا يمكن اعتماد هذه النسخة</p>}
                    {v.publishStatus === "published" && v.externalPostUrl && (
                      <a href={v.externalPostUrl} target="_blank" className="mt-1 inline-flex items-center gap-1 text-xs text-navy-700 underline" dir="ltr">
                        <Icon name="link" size={12} /> {v.externalPostUrl}
                      </a>
                    )}
                  </div>
                );
              })}
            </div>

            {editable && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  disabled={pending}
                  onClick={() =>
                    run(
                      () =>
                        saveItemTexts(item.id, {
                          title,
                          baseText,
                          hashtags,
                          variants: item.variants.map((v: any) => ({ id: v.id, text: variantTexts[v.id] ?? "" })),
                        }),
                      "تم الحفظ",
                    )
                  }
                  className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-bold text-cream-50 hover:bg-navy-900 disabled:opacity-60"
                >
                  حفظ التعديلات
                </button>
                <button
                  type="button"
                  onClick={() => setShowTpl((s) => !s)}
                  title="حفظ النص الحالي كقالب لإعادة استخدامه"
                  className="inline-flex items-center gap-1 rounded-lg border border-navy-700 px-3 py-2 text-xs font-bold text-navy-700 hover:bg-navy-700 hover:text-cream-50"
                >
                  <Icon name="save" size={14} /> حفظ كقالب
                </button>
                {templates.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const t = templates.find((x) => x.id === e.target.value);
                      if (t) { setBaseText(t.baseText); if (t.hashtags) setHashtags(t.hashtags); setMsg({ kind: "ok", text: "طُبّق القالب — راجعه ثم احفظ" }); }
                      e.target.value = "";
                    }}
                    className="rounded-lg border border-steel-300 bg-white px-2 py-2 text-xs"
                  >
                    <option value="">📋 تطبيق قالب…</option>
                    {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                )}
              </div>
            )}
            {showTpl && editable && (
              <div className="mt-2 flex gap-2">
                <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="اسم القالب"
                  className="flex-1 rounded-lg border border-steel-300 px-2 py-1.5 text-sm" />
                <button type="button" disabled={pending || !tplName.trim()}
                  onClick={() => startTransition(async () => {
                    const res = await saveTemplate(tplName.trim(), baseText, hashtags);
                    if ("error" in res && res.error) setMsg({ kind: "err", text: res.error });
                    else if ("id" in res && res.id) {
                      setTemplates((ts) => [{ id: res.id, name: res.name, baseText, hashtags }, ...ts]);
                      setTplName(""); setShowTpl(false);
                      setMsg({ kind: "ok", text: "حُفظ القالب" });
                    }
                  })}
                  className="rounded-lg bg-navy-700 px-3 py-1.5 text-xs font-bold text-cream-50 disabled:opacity-60">
                  حفظ القالب
                </button>
              </div>
            )}

            {/* المرفقات والتصاميم (FR-25) */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-navy-900">
                  المرفقات <span className="text-sm text-steel-500">({item.assetLinks?.length ?? 0})</span>
                </h3>
                {editable && (
                  <div className="flex gap-1.5">
                    <button onClick={() => fileRef.current?.click()} disabled={pending} className="inline-flex items-center gap-1 rounded-lg bg-navy-700 px-3 py-1.5 text-xs font-bold text-cream-50 hover:bg-navy-900 disabled:opacity-60">
                      <Icon name="upload" size={14} /> رفع صورة
                    </button>
                    <button onClick={openPicker} className="inline-flex items-center gap-1 rounded-lg border border-navy-700 px-3 py-1.5 text-xs font-bold text-navy-700 hover:bg-navy-700 hover:text-cream-50">
                      <Icon name="image" size={14} /> من المكتبة
                    </button>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        const fd = new FormData();
                        fd.append("file", f);
                        run(() => uploadCardImage(item.id, fd), "رُفعت الصورة ورُبطت بالبطاقة");
                        e.target.value = "";
                      }}
                    />
                  </div>
                )}
              </div>
              {(item.assetLinks?.length ?? 0) === 0 ? (
                <p className="rounded-lg border border-dashed border-steel-300 bg-white px-3 py-4 text-center text-xs text-steel-500">
                  لا مرفقات — التصاميم المربوطة بإصدار محدد تظهر هنا
                </p>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {item.assetLinks.map((l: any) => (
                    <div key={l.assetVersionId} className="overflow-hidden rounded-lg border border-steel-300/60 bg-white">
                      <a href={l.version.filePath} target="_blank" className="block h-20">
                        <AssetThumb filePath={l.version.filePath} mimeType={l.version.mimeType} />
                      </a>
                      <div className="flex items-center justify-between px-2 py-1 text-[10px]">
                        <span className="truncate font-bold text-navy-900">
                          {l.version.asset.name} <span className="text-steel-500">v{l.version.versionNo}</span>
                        </span>
                        {editable && (
                          <button
                            onClick={() => run(() => unlinkAssetFromItem(item.id, l.assetVersionId), "أُزيل المرفق")}
                            className="shrink-0 text-red-600 hover:font-bold" title="إزالة"
                          >
                            <Icon name="close" size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* الإجراءات حسب الحالة والدور */}
            <div className="mt-5 rounded-xl border border-sand-300 bg-sand-100/50 p-4">
              <h3 className="mb-2 font-heading text-base font-bold text-navy-900">سير العمل</h3>
              <div className="flex flex-wrap gap-2">
                {sendableFrom && (
                  <button
                    disabled={pending}
                    onClick={() => run(() => moveItem(item.id, STATUS.PENDING), "أُرسلت للاعتماد")}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sand-600 px-4 py-2 text-sm font-bold text-white hover:brightness-110"
                  >
                    إرسال للاعتماد <Icon name="send" size={15} />
                  </button>
                )}
                {item.statusId === STATUS.PENDING && canApprove(user.roles) && (
                  <>
                    <button
                      disabled={pending}
                      onClick={() => run(() => approveItem(item.id), "تم الاعتماد ✓")}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 px-4 py-2 text-sm font-bold text-white hover:bg-green-800"
                    >
                      <Icon name="check" size={15} /> اعتماد
                    </button>
                    <button
                      onClick={() => setShowReject(!showReject)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-700 px-4 py-2 text-sm font-bold text-white hover:bg-red-800"
                    >
                      <Icon name="close" size={15} /> رفض / طلب تعديل
                    </button>
                  </>
                )}
                {item.statusId === STATUS.READY && canPublish(user.roles) && (
                  <button
                    onClick={() => setShowPublish(!showPublish)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-bold text-cream-50 hover:bg-navy-700"
                  >
                    <Icon name="rocket" size={15} /> توثيق النشر
                  </button>
                )}
                {item.statusId === STATUS.PENDING && !canApprove(user.roles) && (
                  <p className="text-sm text-steel-500">بانتظار قرار المشرف — طلبها {pendingApproval?.requestedBy?.name ?? ""}</p>
                )}
              </div>

              {showReject && (
                <div className="mt-3 rounded-lg border border-red-200 bg-white p-3">
                  <label className="mb-1 block text-xs font-bold text-red-700">ملاحظة الرفض (إلزامية)</label>
                  <textarea value={rejectNote} onChange={(e) => setRejectNote(e.target.value)} rows={2} className="mb-2 w-full rounded border border-steel-300 px-2 py-1.5 text-sm" />
                  <div className="flex items-center gap-2">
                    <select value={rejectTo} onChange={(e) => setRejectTo(Number(e.target.value))} className="rounded border border-steel-300 bg-white px-2 py-1.5 text-sm">
                      <option value={2}>إرجاع إلى: جاري الكتابة</option>
                      <option value={3}>إرجاع إلى: قيد التصميم</option>
                    </select>
                    <button
                      disabled={pending}
                      onClick={() => run(() => rejectItem(item.id, rejectNote, rejectTo), "تم الرفض وإرجاع البطاقة")}
                      className="rounded bg-red-700 px-4 py-1.5 text-sm font-bold text-white"
                    >
                      تأكيد الرفض
                    </button>
                  </div>
                </div>
              )}

              {showPublish && (
                <div className="mt-3 rounded-lg border border-navy-700/30 bg-white p-3">
                  <p className="mb-2 text-xs font-bold text-navy-900">رابط المنشور على كل منصة (إلزامي) — FR-35</p>
                  {item.variants.map((v: any) => (
                    <div key={v.id} className="mb-2">
                      <label className="mb-0.5 flex items-center gap-1 text-xs text-steel-500">
                        <PlatformIcon platform={v.platform.key} size={12} /> {v.platform.nameAr}
                      </label>
                      <input
                        dir="ltr"
                        placeholder="https://..."
                        value={publishLinks[v.id] ?? ""}
                        onChange={(e) => setPublishLinks({ ...publishLinks, [v.id]: e.target.value })}
                        className="w-full rounded border border-steel-300 px-2 py-1.5 text-left text-sm"
                      />
                    </div>
                  ))}
                  <button
                    disabled={pending}
                    onClick={() =>
                      run(
                        () => publishItem(item.id, item.variants.map((v: any) => ({ variantId: v.id, url: publishLinks[v.id] ?? "" }))),
                        "وُثّق النشر — البطاقة الآن «منشور»",
                      )
                    }
                    className="rounded bg-navy-900 px-4 py-1.5 text-sm font-bold text-cream-50"
                  >
                    تأكيد توثيق النشر
                  </button>
                </div>
              )}
            </div>

            {/* سجل الاعتمادات */}
            {item.approvals?.length > 0 && (
              <div className="mt-4">
                <h3 className="mb-2 font-heading text-base font-bold text-navy-900">سجل الاعتماد</h3>
                <ul className="flex flex-col gap-1.5 text-xs">
                  {item.approvals.map((a: any) => (
                    <li key={a.id} className="rounded-lg border border-steel-300/50 bg-white px-3 py-2">
                      {a.decision === "pending" && <span className="inline-flex items-center gap-1 font-bold text-sand-600"><Icon name="clock" size={13} /> بانتظار الاعتماد</span>}
                      {a.decision === "approved" && <span className="inline-flex items-center gap-1 font-bold text-green-700"><Icon name="check" size={13} /> اعتمدها {a.reviewer?.name}</span>}
                      {a.decision === "rejected" && (
                        <span className="inline-flex items-center gap-1 font-bold text-red-700"><Icon name="close" size={13} /> رفضها {a.reviewer?.name}: {a.decisionNote}</span>
                      )}
                      <span className="mr-2 text-steel-500">طلبها {a.requestedBy?.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* اليسار: المعاينة والتعليقات */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-navy-900">معاينة المنشور</h3>
              <div className="flex overflow-hidden rounded-lg border border-steel-300 text-xs">
                {item.variants.map((v: any) => (
                  <button
                    key={v.id}
                    onClick={() => setPreviewTab(v.platform.key)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 font-bold ${previewTab === v.platform.key ? "bg-navy-900 text-cream-50" : "bg-white text-navy-900"}`}
                  >
                    <PlatformIcon platform={v.platform.key} size={13} mono={previewTab === v.platform.key} className={previewTab === v.platform.key ? "text-cream-50" : ""} />
                    {v.platform.nameAr}
                  </button>
                ))}
              </div>
            </div>
            {previewTab && (
              <PostPreview
                platform={previewTab}
                text={
                  (variantTexts[item.variants.find((v: any) => v.platform.key === previewTab)?.id] ||
                    baseText) + (hashtags ? `\n\n${hashtags}` : "")
                }
              />
            )}

            {/* التعليقات */}
            <h3 className="mb-2 mt-5 font-heading text-lg font-bold text-navy-900">
              التعليقات <span className="text-sm text-steel-500">({item.comments.length})</span>
            </h3>
            <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
              {item.comments.map((c: any) => (
                <div key={c.id} className="rounded-lg border border-steel-300/50 bg-white p-3">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sand-500 text-xs font-bold text-navy-900">
                      {c.author.name.slice(0, 1)}
                    </span>
                    <span className="text-sm font-bold text-navy-900">{c.author.name}</span>
                    <span className="text-[10px] text-steel-500">
                      {new Date(c.createdAt).toLocaleString("ar-SA")}
                    </span>
                  </div>
                  {c.anchor && (() => {
                    try {
                      const a = JSON.parse(c.anchor);
                      return (
                        <blockquote className="mb-1 flex items-center gap-1 rounded border-r-2 border-sand-500 bg-sand-100/60 px-2 py-1 text-xs text-ink-900/80">
                          <Icon name="pin" size={12} /> على المقطع: «{a.quote}»
                        </blockquote>
                      );
                    } catch { return null; }
                  })()}
                  <p className="whitespace-pre-wrap text-sm leading-6">{c.body}</p>
                </div>
              ))}
              {item.comments.length === 0 && <p className="text-sm text-steel-500">لا تعليقات بعد</p>}
            </div>

            {anchor && (
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-sand-500 bg-sand-100/60 px-2 py-1.5 text-xs">
                <span className="inline-flex items-center gap-1 font-bold text-navy-900"><Icon name="pin" size={13} /> تعليق توضيحي على:</span>
                <span className="min-w-0 truncate text-ink-900/80">«{anchor.quote}»</span>
                <button onClick={() => setAnchor(null)} className="mr-auto shrink-0 font-bold text-red-600" title="إلغاء التحديد"><Icon name="close" size={13} /></button>
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={anchor ? "اكتب التعليق التوضيحي على المقطع المحدد..." : "اكتب تعليقاً... استخدم @الاسم للإشارة"}
                className="flex-1 rounded-lg border border-steel-300 bg-white px-3 py-2 text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && comment.trim()) {
                    run(() => addComment(item.id, comment, anchor ? JSON.stringify({ type: "text_range", ...anchor }) : undefined), "أُضيف التعليق");
                    setComment("");
                    setAnchor(null);
                  }
                }}
              />
              <button
                disabled={pending || !comment.trim()}
                onClick={() => {
                  run(() => addComment(item.id, comment, anchor ? JSON.stringify({ type: "text_range", ...anchor }) : undefined), "أُضيف التعليق");
                  setComment("");
                  setAnchor(null);
                }}
                className="rounded-lg bg-navy-700 px-4 py-2 text-sm font-bold text-cream-50 disabled:opacity-50"
              >
                إرسال
              </button>
            </div>
          </div>
        </div>

        {/* منتقي المكتبة */}
        {showPicker && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-950/50 p-4" onClick={() => setShowPicker(false)}>
            <div onClick={(e) => e.stopPropagation()} className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-heading text-lg font-bold text-navy-900">إرفاق من مكتبة الوسائط</h3>
                <button onClick={() => setShowPicker(false)}><Icon name="close" size={18} /></button>
              </div>
              {pickerAssets === null && <p className="py-8 text-center text-steel-500">جارٍ التحميل...</p>}
              {pickerAssets?.length === 0 && (
                <p className="py-8 text-center text-sm text-steel-500">
                  المكتبة فارغة — ارفع ملفات من صفحة «مكتبة الوسائط» أولاً
                </p>
              )}
              <div className="grid grid-cols-3 gap-3 md:grid-cols-4">
                {pickerAssets?.map((a: any) => {
                  const current = a.versions[0];
                  if (!current) return null;
                  return (
                    <button
                      key={a.id}
                      disabled={pending}
                      onClick={() => {
                        run(() => linkAssetToItem(item.id, current.id), "أُرفق الملف بالبطاقة");
                        setShowPicker(false);
                      }}
                      className="overflow-hidden rounded-lg border border-steel-300/60 text-right transition hover:border-sand-500 hover:shadow"
                    >
                      <div className="h-24">
                        <AssetThumb filePath={current.filePath} mimeType={current.mimeType} />
                      </div>
                      <div className="p-2 text-[11px]">
                        <div className="truncate font-bold text-navy-900">{a.name}</div>
                        <div className="text-steel-500">v{current.versionNo} · {fmtSize(current.sizeBytes)}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
