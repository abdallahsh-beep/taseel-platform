import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

// بيانات المحرّر المشتركة: الحملات والقوالب (لمنتقيات البطاقة ونافذة الإنشاء)
export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [campaigns, templates] = await Promise.all([
    db.campaign.findMany({ orderBy: { createdAt: "desc" } }),
    db.contentTemplate.findMany({ orderBy: { createdAt: "desc" } }),
  ]);
  return Response.json({ campaigns, templates });
}
