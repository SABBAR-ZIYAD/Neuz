import { sessionAccount } from "@/lib/admin-account";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminCookie } from "@/lib/admin-auth";
import { CatalogRepository } from "@/lib/catalog-repository";
import { storageMode } from "@/lib/catalog-storage";
import { AdminPanel } from "@/components/admin-panel";
export default async function AdminPage() {
  if (!(await sessionAccount((await cookies()).get(adminCookie)?.value)))
    redirect("/abdel/login");
  const snapshot = await new CatalogRepository().read();
  return (
    <AdminPanel
      initialData={{
        version: snapshot.version,
        products: snapshot.document.products,
        categories: snapshot.document.categories,
        storage: storageMode(),
      }}
    />
  );
}
