// التقويم الهجري (أم القرى) — طبقة عرض عبر Intl، التخزين ميلادي UTC دائماً

const HIJRI_LOCALE = "ar-SA-u-ca-islamic-umalqura-nu-latn";

const partsFmt = new Intl.DateTimeFormat(HIJRI_LOCALE, {
  day: "numeric",
  month: "numeric",
  year: "numeric",
});

const labelFmt = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "long",
});

const fullLabelFmt = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function hijriParts(date: Date): { day: number; month: number; year: number } {
  const parts = partsFmt.formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { day: get("day"), month: get("month"), year: get("year") };
}

/** مثل: «١٢ محرم» */
export function hijriLabel(date: Date) {
  return labelFmt.format(date);
}

/** مثل: «١٢ محرم ١٤٤٨ هـ» */
export function hijriFullLabel(date: Date) {
  return fullLabelFmt.format(date) + " هـ";
}

export const WEEKDAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

export const GREG_MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function gregLabel(date: Date) {
  return `${date.getDate()} ${GREG_MONTHS_AR[date.getMonth()]} ${date.getFullYear()}`;
}
