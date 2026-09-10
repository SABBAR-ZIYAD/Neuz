import type { Metadata } from "next";
import "@fontsource-variable/manrope";
import "../globals.css";
import "./admin.css";
export const metadata: Metadata = {
  title: "Administration | NEUZ",
  robots: { index: false, follow: false },
  referrer: "same-origin",
};
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body className="admin-body">{children}</body>
    </html>
  );
}
