import { redirect } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { getSessionUser } from "@/lib/auth";
import { ForcePasswordChange } from "./force-password";

export const dynamic = "force-dynamic";

export default async function Page() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.mustChangePassword) return <ForcePasswordChange displayName={user.displayName} />;
  return <Dashboard user={user} />;
}
