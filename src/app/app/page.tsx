import { redirect } from "next/navigation";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { Shell } from "@/components/Shell";

export default async function AppPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <Shell me={publicUser(user)} vapidKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />;
}
