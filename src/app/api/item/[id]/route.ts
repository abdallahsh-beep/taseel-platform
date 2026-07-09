import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  // نُرجِع فقط حقول المستخدم العامة (الاسم) — لا email/roles/passwordHash
  const publicUser = { select: { id: true, name: true } };
  const { id } = await ctx.params;
  const item = await db.contentItem.findUnique({
    where: { id },
    include: {
      category: true,
      status: true,
      campaign: true,
      writer: publicUser,
      designer: publicUser,
      variants: { include: { platform: true } },
      approvals: { orderBy: { requestedAt: "desc" }, include: { reviewer: publicUser, requestedBy: publicUser } },
      comments: { orderBy: { createdAt: "asc" }, include: { author: publicUser } },
      assetLinks: { include: { version: { include: { asset: true } } } },
    },
  });
  if (!item) return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(item);
}
