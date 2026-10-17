import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { AdminPanel } from "@/components/AdminPanel";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "admin") redirect("/app");
  return <AdminPanel />;
}
