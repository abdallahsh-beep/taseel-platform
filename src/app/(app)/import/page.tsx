import { redirect } from "next/navigation";
import { getSessionUser, hasAnyRole } from "@/lib/auth";
import ImportForm from "@/components/ImportForm";

// استيراد الروزنامة الحالية من CSV (FR-32) — من Excel: حفظ باسم CSV UTF-8

export default async function ImportPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!hasAnyRole(user.roles, ["admin", "supervisor"])) redirect("/");

  return <ImportForm />;
}
