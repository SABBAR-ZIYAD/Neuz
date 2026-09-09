import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { contact } from "@/lib/catalog";

export async function ContentShell({
  locale,
  path,
  children,
}: {
  locale: Locale;
  path: string;
  children: ReactNode;
}) {
  const t = await getTranslations({ locale });
  return (
    <>
      <a className="skip-link" href="#main">
        {t("nav.skip")}
      </a>
      <header className="content-header">
        <a href={"/" + locale} aria-label="NEUZ" className="content-brand">
          <img src="/images/neuz-logo.png" width="700" height="165" alt="NEUZ" />
        </a>
        <nav className="languages" aria-label={t("nav.language")}>
          {routing.locales.map((lang) => (
            <a
              key={lang}
              href={"/" + lang + path}
              lang={lang}
              hrefLang={lang}
              aria-current={lang === locale ? "page" : undefined}
              aria-label={
                { fr: "Français", en: "English", ar: "العربية" }[lang]
              }
            >
              {lang === "ar" ? "ع" : lang.toUpperCase()}
            </a>
          ))}
        </nav>
      </header>
      {children}
      <footer className="content-footer">
        <a href={"/" + locale}>{t("services.home")}</a>
        <a href={"mailto:" + contact.email} dir="ltr">
          {contact.email}
        </a>
        <a href={"/" + locale + "/privacy"}>{t("footer.privacy")}</a>
      </footer>
    </>
  );
}
