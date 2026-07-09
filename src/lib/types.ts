// أنواع مشتركة (نسخ قابلة للتسلسل للمكونات العميلة)

export type ItemLite = {
  id: string;
  title: string;
  scheduledAt: string; // ISO
  statusId: number;
  statusLabel: string;
  categoryName: string;
  categoryColor: string;
  platforms: string[]; // keys: x | instagram | facebook | linkedin
  writerName: string | null;
  commentCount: number;
};

export type OccasionLite = {
  id: string;
  nameAr: string;
  hijriMonth: number | null;
  hijriDay: number | null;
  gregMonth: number | null;
  gregDay: number | null;
  specificDate: string | null;
  color: string | null;
};

export type CategoryLite = { id: string; nameAr: string; color: string };

export type SessionLite = { id: string; name: string; roles: string[] };

export const STATUS_COLORS: Record<number, string> = {
  1: "#B4B6C5", // فكرة
  2: "#4A6B8A", // جاري الكتابة
  3: "#C1996B", // قيد التصميم
  4: "#A97F52", // بانتظار الاعتماد
  5: "#2E6B4F", // جاهز
  6: "#1B3347", // منشور
};

// شعارات المنصات: انظر components/PlatformIcon.tsx
