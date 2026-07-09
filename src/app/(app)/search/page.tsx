import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import SearchResults from "@/components/SearchResults";
import type { ItemLite } from "@/lib/types";

// البحث الشامل (FR-30): العناوين، النصوص، الهاشتاقات، والتعليقات

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const { q } = await searchParams;
  const query = (q ?? "").trim();

  let results: ItemLite[] = [];
  if (query.length >= 2) {
    const matchedComments = await db.comment.findMany({
      where: { body: { contains: query } },
      select: { contentItemId: true },
    });
    const items = await db.contentItem.findMany({
      where: {
        deletedAt: null,
        OR: [
          { title: { contains: query } },
          { baseText: { contains: query } },
          { hashtags: { contains: query } },
          { id: { in: matchedComments.map((c) => c.contentItemId) } },
        ],
      },
      include: {
        category: true,
        status: true,
        writer: true,
        variants: { include: { platform: true } },
        _count: { select: { comments: true } },
      },
      orderBy: { scheduledAt: "desc" },
      take: 50,
    });
    results = items.map((i) => ({
      id: i.id,
      title: i.title,
      scheduledAt: i.scheduledAt.toISOString(),
      statusId: i.statusId,
      statusLabel: i.status.labelAr,
      categoryName: i.category.nameAr,
      categoryColor: i.category.color,
      platforms: i.variants.map((v) => v.platform.key),
      writerName: i.writer?.name ?? null,
      commentCount: i._count.comments,
    }));
  }

  return (
    <SearchResults
      query={query}
      results={results}
      user={{ id: user.id, name: user.name, roles: user.roles }}
    />
  );
}
