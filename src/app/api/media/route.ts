import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const assets = await db.mediaAsset.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      uploadedBy: { select: { name: true } },
      versions: { orderBy: { versionNo: "desc" }, include: { uploadedBy: { select: { name: true } } } },
    },
  });
  return Response.json(assets);
}
