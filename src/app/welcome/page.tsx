import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { WelcomeForm } from "./WelcomeForm";

export const metadata = { title: "Welcome · PONGS Connect" };

// First sign-in: the employee replaces the temporary password their admin gave them.
export default async function WelcomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!user.mustChangePassword) redirect("/app");
  return <WelcomeForm name={user.name} email={user.email} />;
}
