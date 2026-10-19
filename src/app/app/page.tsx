import { redirect } from "next/navigation";
import { getCurrentUser, publicUser } from "@/lib/auth";
import { getVapidKeys } from "@/lib/notify";
import { Shell } from "@/components/Shell";

export default async function AppPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) redirect("/welcome");
  const vapidKey = await getVapidKeys()
    .then((k) => k.publicKey)
    .catch((err) => {
      console.error("push keys unavailable", err);
      return null;
    });
  return <Shell me={publicUser(user)} vapidKey={vapidKey} />;
}
