import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser, hasAnyRole } from "@/lib/auth";
import MediaLibrary from "@/components/MediaLibrary";

export default async function MediaPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const assets = await db.mediaAsset.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      uploadedBy: { select: { name: true } },
      versions: { orderBy: { versionNo: "desc" }, include: { uploadedBy: { select: { name: true } } } },
    },
  });

  return (
    <MediaLibrary
      assets={assets.map((a) => ({
        id: a.id,
        name: a.name,
        folder: a.folder,
        tags: a.tags,
        uploadedBy: a.uploadedBy.name,
        versions: a.versions.map((v) => ({
          id: v.id,
          versionNo: v.versionNo,
          filePath: v.filePath,
          mimeType: v.mimeType,
          sizeBytes: v.sizeBytes,
          note: v.note,
          uploadedBy: v.uploadedBy.name,
          createdAt: v.createdAt.toISOString(),
        })),
      }))}
      canUpload={hasAnyRole(user.roles, ["admin", "supervisor", "writer", "designer"])}
    />
  );
}
