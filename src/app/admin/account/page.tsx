import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookie } from "@/lib/admin-auth";
import { sessionAccount } from "@/lib/admin-account";
import { AdminAccountForm } from "@/components/admin-account-form";
export default async function AccountPage() {
  const account = await sessionAccount(
    (await cookies()).get(adminCookie)?.value,
  );
  if (!account) redirect("/admin/login");
  return <AdminAccountForm username={account.username} />;
}
