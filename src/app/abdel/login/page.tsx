import { sessionAccount } from "@/lib/admin-account";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookie, adminConfigured } from "@/lib/admin-auth";
import { AdminLogin } from "@/components/admin-login";
export default async function LoginPage() {
  if (await sessionAccount((await cookies()).get(adminCookie)?.value))
    redirect("/abdel");
  return <AdminLogin configured={adminConfigured()} />;
}
