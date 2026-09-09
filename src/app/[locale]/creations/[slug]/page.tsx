import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { getPublicCatalog } from "@/lib/catalog-data";
import { localized, imageSource } from "@/lib/catalog-model";
import { contact } from "@/lib/catalog";
import { pageMetadata, siteUrl } from "@/lib/seo";
import { organizationData, serializeJsonLd } from "@/lib/structured-data";
import { ArtImage } from "@/components/art-image";
import { ContentShell } from "@/components/content-shell";
type Props = { params: Promise<{ locale: string; slug: string }> };
async function getPage(params: Props["params"]) {
  const { locale, slug } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const catalog = await getPublicCatalog();
  const category = catalog.categories.find((c) => c.slug === slug);
  if (!category) notFound();
  const pieces = catalog.products.filter((p) => p.category === category.id);
  const copy = localized(category, locale);
  return {
    locale,
    category,
    catalog,
    pieces,
    copy,
    path: "/creations/" + slug,
    t: await getTranslations({ locale }),
  };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, copy, path, pieces } = await getPage(params);
  return pageMetadata(
    locale,
    (copy.title || copy.name) + " | NEUZ",
    copy.description,
    path,
    imageSource(pieces[0].image, 1440),
  );
}
export default async function ServicePage({ params }: Props) {
  const { locale, category, catalog, pieces, copy, path, t } =
    await getPage(params);
  setRequestLocale(locale);
  const title = copy.title || copy.name;
  const url = siteUrl + "/" + locale + path;
  const heroImage = imageSource(pieces[0].image, 1440);
  const absoluteImage = heroImage.startsWith("https://")
    ? heroImage
    : siteUrl + heroImage;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      organizationData(),
      {
        "@type": "Service",
        "@id": url + "#service",
        name: title,
        description: copy.intro || copy.description,
        url,
        image: absoluteImage,
        provider: { "@id": siteUrl + "/#organization" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          {
            "@type": "ListItem",
            position: 1,
            name: t("services.home"),
            item: siteUrl + "/" + locale,
          },
          { "@type": "ListItem", position: 2, name: title, item: url },
        ],
      },
    ],
  };
  return (
    <ContentShell locale={locale} path={path}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
      />
      <main id="main" className="service-page">
        <nav className="content-breadcrumb" aria-label={t("services.home")}>
          <a href={"/" + locale}>{t("services.home")}</a>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{title}</span>
        </nav>
        <section className="service-hero">
          <div className="service-copy">
            <h1>{title}</h1>
            <p>{copy.intro || copy.description}</p>
            {copy.detail && <p>{copy.detail}</p>}
            <a className="button button-dark" href={"/" + locale + "#contact"}>
              {t("services.contact")}
            </a>
          </div>
          <figure>
            <ArtImage
              name={pieces[0].image}
              alt={
                localized(pieces[0], locale).alt ||
                localized(pieces[0], locale).name
              }
              eager
              sizes="(max-width: 800px) 100vw, 48vw"
            />
            <figcaption>{t("creations.note")}</figcaption>
          </figure>
        </section>
        <section className="service-section" aria-labelledby="examples-title">
          <h2 id="examples-title">{t("services.examples")}</h2>
          <div className="service-studies">
            {pieces.map((piece) => (
              <article key={piece.id} id={piece.id}>
                <ArtImage
                  name={piece.image}
                  alt={
                    localized(piece, locale).alt ||
                    localized(piece, locale).name
                  }
                  sizes="(max-width: 700px) 100vw, 33vw"
                />
                <h3>{localized(piece, locale).name}</h3>
                <p>{localized(piece, locale).description}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="service-section service-planning">
          <div>
            <h2>{t("services.planning")}</h2>
            <p>{t("services.planningText")}</p>
            <a className="text-link" href={"mailto:" + contact.email}>
              {t("nav.quote")}
            </a>
          </div>
          <div>
            {copy.question && copy.answer && (
              <>
                <h3>{copy.question}</h3>
                <p>{copy.answer}</p>
              </>
            )}
            <h3>{t("contact.faq.1.q")}</h3>
            <p>{t("contact.faq.1.a")}</p>
          </div>
        </section>
        {catalog.categories.length > 1 && (
          <nav className="service-section" aria-label={t("services.related")}>
            <h2>{t("services.related")}</h2>
            <div className="service-links">
              {catalog.categories
                .filter((other) => other.id !== category.id)
                .map((other) => (
                  <a
                    key={other.id}
                    href={"/" + locale + "/creations/" + other.slug}
                  >
                    {localized(other, locale).title ||
                      localized(other, locale).name}
                  </a>
                ))}
            </div>
          </nav>
        )}
      </main>
    </ContentShell>
  );
}
