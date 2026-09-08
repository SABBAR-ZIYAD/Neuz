"use client";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  ArrowRight,
  ArrowLeft,
  Plus,
  Minus,
  X,
  Menu,
  Instagram,
} from "lucide-react";
import { ArtImage } from "./art-image";
import { QuoteForm } from "./quote-form";
import { products, contact, type Product } from "@/lib/catalog";

const navLinks = [
  ["maison", "maison"],
  ["creations", "creations"],
  ["savoir", "savoir-faire"],
  ["contact", "contact"],
] as const;
function Arrow() {
  return (
    <ArrowUpRight
      size={18}
      strokeWidth={1.4}
      aria-hidden="true"
      className="directional"
    />
  );
}
export function Landing() {
  const t = useTranslations();
  const locale = useLocale();
  const [menu, setMenu] = useState(false);
  const [quote, setQuote] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Product | null>(null);
  const [inspiration, setInspiration] = useState<Product | undefined>();
  const headerRef = useRef<HTMLElement>(null);
  const quoteTrigger = useRef<HTMLElement | null>(null);
  const galleryTrigger = useRef<HTMLButtonElement | null>(null);
  const activeSection = useRef("top");
  useEffect(() => {
    let ticking = false;
    const update = () => {
      const sections = document.querySelectorAll<HTMLElement>("[data-tone]");
      let tone = "dark";
      sections.forEach((s) => {
        const rect = s.getBoundingClientRect();
        if (rect.top <= 110 && rect.bottom > 110 && s.id)
          activeSection.current = s.id;
        if (rect.top <= 52 && rect.bottom > 52)
          tone = s.dataset.tone || "light";
      });
      if (headerRef.current) headerRef.current.dataset.surface = tone;
      ticking = false;
    };
    const scroll = () => {
      if (!ticking) {
        requestAnimationFrame(update);
        ticking = true;
      }
    };
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll);
    return () => {
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
    };
  }, []);
  function openQuote(product?: Product) {
    quoteTrigger.current = document.activeElement as HTMLElement;
    if (product) setInspiration(product);
    setSelected(null);
    setMenu(false);
    setQuote(true);
  }
  const languages = (
    <div className="languages" aria-label={t("nav.language")}>
      {(["fr", "en", "ar"] as const).map((lang) => (
        <a
          key={lang}
          href={`/${lang}`}
          lang={lang}
          aria-label={{ fr: "Français", en: "English", ar: "العربية" }[lang]}
          aria-current={locale === lang ? "page" : undefined}
          onClick={(e) => {
            const anchor = e.currentTarget;
            anchor.href = `/${lang}${activeSection.current === "top" ? "" : `#${activeSection.current}`}`;
            document.cookie = `NEXT_LOCALE=${lang};path=/;max-age=31536000;SameSite=Lax`;
          }}
        >
          {lang === "ar" ? "ع" : lang.toUpperCase()}
        </a>
      ))}
    </div>
  );
  return (
    <>
      <a className="skip-link" href="#main">
        {t("nav.skip")}
      </a>
      <header className="header" ref={headerRef} data-surface="dark">
        <a href={`/${locale}`} aria-label="NEUZ" className="logo-link">
          <img
            src="/images/neuz-logo.png"
            width="140"
            height="58"
            alt="NEUZ"
            className="brand-logo"
          />
        </a>
        <nav className="desktop-nav" aria-label={t("nav.menu")}>
          {navLinks.map(([label, id]) => (
            <a href={`#${id}`} key={id}>
              {t(`nav.${label}`)}
            </a>
          ))}
        </nav>
        <div className="header-actions">
          {languages}
          <button className="header-quote" onClick={() => openQuote()}>
            {t("nav.quote")}
            <Arrow />
          </button>
          <Dialog.Root open={menu} onOpenChange={setMenu}>
            <Dialog.Trigger asChild>
              <button
                className="menu-button icon-button"
                aria-label={t("nav.menu")}
              >
                <Menu strokeWidth={1.3} />
              </button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="dialog-overlay" />
              <Dialog.Content
                className="mobile-menu"
                aria-describedby={undefined}
              >
                <Dialog.Title className="sr-only">{t("nav.menu")}</Dialog.Title>
                <div className="menu-top">
                  <span className="wordmark">NEUZ</span>
                  <Dialog.Close
                    className="icon-button"
                    aria-label={t("nav.close")}
                  >
                    <X />
                  </Dialog.Close>
                </div>
                <nav>
                  {navLinks.map(([label, id], i) => (
                    <a href={`#${id}`} key={id} onClick={() => setMenu(false)}>
                      <span>0{i + 1}</span>
                      {t(`nav.${label}`)}
                      <Arrow />
                    </a>
                  ))}
                </nav>
                <button
                  className="button button-dark"
                  onClick={() => openQuote()}
                >
                  {t("nav.quote")}
                  <Arrow />
                </button>
                {languages}
                <p className="eyebrow">{t("contact.location")}</p>
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </header>
      <main id="main">
        <section className="hero" id="top" data-tone="dark">
          <div className="hero-visual">
            <ArtImage
              name="restaurant-arch"
              alt={t("hero.caption")}
              eager
              sizes="(max-width: 700px) 100vw, 76vw"
            />
          </div>
          <div className="hero-shade" />
          <div className="hero-content">
            <p className="eyebrow hero-enter">{t("hero.eyebrow")}</p>
            <h1 className="hero-enter">
              {t("hero.line1")}
              <br />
              <em>{t("hero.line2")}</em>
              <br />
              {t("hero.line3")}
            </h1>
            <p className="hero-description hero-enter">{t("hero.text")}</p>
            <a href="#creations" className="text-link hero-enter">
              {t("hero.explore")}
              <Arrow />
            </a>
          </div>
          <div className="hero-bottom">
            <span>{t("hero.bottom")}</span>
            <a href="#maison" aria-label={t("hero.scroll")}>
              <ArrowDown size={18} strokeWidth={1.2} />
            </a>
            <span>{t("hero.caption")}</span>
          </div>
        </section>

        <section className="maison section-pad" id="maison" data-tone="light">
          <div className="section-heading">
            <p className="eyebrow">{t("maison.label")}</p>
            <h2>
              {t("maison.title")}
              <br />
              <em>{t("maison.italic")}</em>
            </h2>
          </div>
          <div className="maison-grid">
            <figure className="maison-image">
              <ArtImage name="maison-interior" alt={t("products.arch.alt")} />
              <figcaption>
                {t("maison.caption")}
                <span>NEUZ — 01</span>
              </figcaption>
            </figure>
            <div className="maison-copy">
              <div className="small-rule" />
              <p>{t("maison.text")}</p>
              <p className="muted">{t("maison.text2")}</p>
              <button className="text-link" onClick={() => openQuote()}>
                {t("maison.link")}
                <Arrow />
              </button>
              <blockquote>« {t("maison.quote")} »</blockquote>
            </div>
          </div>
        </section>

        <section
          className="creations section-pad"
          id="creations"
          data-tone="light"
        >
          <div className="creations-heading">
            <div>
              <p className="eyebrow">{t("creations.label")}</p>
              <h2>
                {t("creations.title")}
                <br />
                <em>{t("creations.italic")}</em>
              </h2>
            </div>
            <p>{t("creations.intro")}</p>
          </div>
          <div className="filters" role="group" aria-label={t("nav.creations")}>
            {["all", "rugs", "mirrors", "wall"].map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                className={filter === f ? "active" : ""}
                onClick={() => setFilter(f)}
              >
                {t(`creations.${f}`)}
                <span>
                  {f === "all"
                    ? "06"
                    : String(
                        products.filter((p) => p.category === f).length,
                      ).padStart(2, "0")}
                </span>
              </button>
            ))}
          </div>
          <div className="gallery" aria-live="polite">
            {products
              .filter((p) => filter === "all" || p.category === filter)
              .map((p) => (
                <button
                  className="art-card"
                  key={p.id}
                  onClick={(event) => {
                    galleryTrigger.current = event.currentTarget;
                    setSelected(p);
                  }}
                  aria-label={`${t(`products.${p.id}.name`)} — ${t("creations.view")}`}
                >
                  <div className="card-image">
                    <ArtImage
                      name={p.image}
                      alt={t(`products.${p.id}.alt`)}
                      sizes="(max-width: 600px) 100vw, (max-width: 900px) 50vw, 33vw"
                    />
                    <span className="card-number">
                      {String(products.indexOf(p) + 1).padStart(2, "0")}
                    </span>
                    <span className="card-discover">
                      {t("creations.view")}
                      <Arrow />
                    </span>
                  </div>
                  <div className="card-caption">
                    <div>
                      <h3>{t(`products.${p.id}.name`)}</h3>
                      <p>{t(`products.${p.id}.type`)}</p>
                    </div>
                    <Arrow />
                  </div>
                </button>
              ))}
          </div>
          <div className="gallery-bottom">
            <p>{t("creations.note")}</p>
            <div>
              <p>{t("creations.more")}</p>
              <button className="text-link" onClick={() => openQuote()}>
                {t("creations.bespoke")}
                <Arrow />
              </button>
            </div>
          </div>
        </section>

        <section
          className="savoir section-pad"
          id="savoir-faire"
          data-tone="dark"
        >
          <div className="savoir-copy">
            <p className="eyebrow">{t("savoir.label")}</p>
            <h2>
              {t("savoir.title")}
              <br />
              <em>{t("savoir.italic")}</em>
            </h2>
            <p>{t("savoir.text")}</p>
            <p className="muted">{t("savoir.text2")}</p>
            <ul>
              {["tag1", "tag2", "tag3"].map((key) => (
                <li key={key}>{t(`savoir.${key}`)}</li>
              ))}
            </ul>
          </div>
          <div className="savoir-images">
            <ArtImage
              className="detail-image"
              name="textile-detail"
              alt={t("savoir.detailAlt")}
            />
            <figure className="atelier-image">
              <ArtImage
                name="atelier-tufting"
                alt={t("savoir.workshopAlt")}
                sizes="(max-width: 700px) 45vw, 22vw"
              />
              <figcaption>{t("savoir.caption")}</figcaption>
            </figure>
          </div>
        </section>

        <section
          className="process section-pad"
          id="sur-mesure"
          data-tone="light"
        >
          <div className="process-intro">
            <p className="eyebrow">{t("process.label")}</p>
            <h2>
              {t("process.title")}
              <br />
              <em>{t("process.italic")}</em>
            </h2>
            <p>{t("process.intro")}</p>
            <button className="text-link" onClick={() => openQuote()}>
              {t("nav.quote")}
              <Arrow />
            </button>
          </div>
          <div className="process-steps">
            {(t.raw("process.steps") as { title: string; text: string }[]).map(
              (step, i) => (
                <details
                  key={step.title}
                  name="process"
                  open={i === 0 ? true : undefined}
                >
                  <summary>
                    <span className="step-number">0{i + 1}</span>
                    <h3>{step.title}</h3>
                    <Plus size={17} className="plus" aria-hidden="true" />
                    <Minus size={17} className="minus" aria-hidden="true" />
                  </summary>
                  <p>{step.text}</p>
                </details>
              ),
            )}
          </div>
        </section>

        <section className="professionals" id="professionnels" data-tone="dark">
          <div className="professionals-image">
            <ArtImage
              name="lounge-arch"
              alt={t("professionals.alt")}
              sizes="(max-width: 700px) 100vw, 44vw"
            />
            <span>{t("professionals.caption")}</span>
          </div>
          <div className="professionals-copy">
            <p className="eyebrow">{t("professionals.label")}</p>
            <h2>
              {t("professionals.title")}
              <br />
              <em>{t("professionals.italic")}</em>
            </h2>
            <p>{t("professionals.text")}</p>
            <button className="text-link" onClick={() => openQuote()}>
              {t("professionals.cta")}
              <Arrow />
            </button>
          </div>
        </section>

        <section className="contact section-pad" id="contact" data-tone="light">
          <p className="eyebrow">{t("contact.label")}</p>
          <h2>
            {t("contact.title")}
            <br />
            <em>{t("contact.italic")}</em>
          </h2>
          <p className="contact-intro">{t("contact.text")}</p>
          <button className="button button-dark" onClick={() => openQuote()}>
            {t("contact.cta")}
            <Arrow />
          </button>
          <div className="contact-details">
            <a href={`mailto:${contact.email}`} dir="ltr">
              {contact.email}
              <Arrow />
            </a>
            <a
              href={contact.whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              dir="ltr"
            >
              +212 700 388 324
              <Arrow />
            </a>
            <span>{t("contact.location")}</span>
          </div>
          <div className="faq">
            <h3>{t("contact.faqTitle")}</h3>
            <div>
              {(t.raw("contact.faq") as { q: string; a: string }[]).map(
                (item) => (
                  <details key={item.q}>
                    <summary>
                      {item.q}
                      <Plus size={16} className="plus" aria-hidden="true" />
                      <Minus size={16} className="minus" aria-hidden="true" />
                    </summary>
                    <p>{item.a}</p>
                  </details>
                ),
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="footer" data-tone="dark">
        <div className="footer-top">
          <a href="#top" aria-label="NEUZ">
            <img
              src="/images/neuz-logo.png"
              alt="NEUZ"
              width="260"
              height="108"
            />
          </a>
          <p>{t("footer.tag")}</p>
          <a
            href={contact.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="instagram"
          >
            <Instagram size={18} strokeWidth={1.3} />
            <span>@neuz.ma</span>
            <Arrow />
          </a>
        </div>
        <div className="footer-bottom">
          <span>
            © {new Date().getFullYear()} NEUZ. {t("footer.rights")}
          </span>
          <button onClick={() => setPrivacy(true)}>
            {t("footer.privacy")}
          </button>
          <span>{t("footer.credit")}</span>
          <a href="#top">
            {t("footer.back")}
            <ArrowUp size={15} />
          </a>
        </div>
      </footer>

      <Dialog.Root
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content
            className="piece-dialog"
            aria-describedby="piece-description"
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (!quote) galleryTrigger.current?.focus();
            }}
          >
            <Dialog.Close
              className="icon-button dialog-close"
              aria-label={t("nav.close")}
            >
              <X strokeWidth={1.4} />
            </Dialog.Close>
            {selected && (
              <>
                <div className="piece-image">
                  <ArtImage
                    name={selected.image}
                    alt={t(`products.${selected.id}.alt`)}
                    eager
                  />
                  <div className="piece-controls">
                    <button
                      className="icon-button"
                      aria-label={t("creations.prev")}
                      onClick={() =>
                        setSelected(
                          products[
                            (products.indexOf(selected) + products.length - 1) %
                              products.length
                          ],
                        )
                      }
                    >
                      <ArrowLeft size={20} />
                    </button>
                    <span>
                      {String(products.indexOf(selected) + 1).padStart(2, "0")}{" "}
                      / 06
                    </span>
                    <button
                      className="icon-button"
                      aria-label={t("creations.next")}
                      onClick={() =>
                        setSelected(
                          products[
                            (products.indexOf(selected) + 1) % products.length
                          ],
                        )
                      }
                    >
                      <ArrowRight size={20} />
                    </button>
                  </div>
                </div>
                <div className="piece-copy">
                  <p className="eyebrow">{t("creations.study")}</p>
                  <Dialog.Title>
                    {t(`products.${selected.id}.name`)}
                  </Dialog.Title>
                  <p className="piece-type">
                    {t(`products.${selected.id}.type`)}
                  </p>
                  <Dialog.Description id="piece-description">
                    {t(`products.${selected.id}.description`)}
                  </Dialog.Description>
                  <div className="piece-custom">
                    <h3>{t("creations.custom")}</h3>
                    <p>{t("creations.customText")}</p>
                  </div>
                  <button
                    className="button button-dark"
                    onClick={() => openQuote(selected)}
                  >
                    {t("creations.inspired")}
                    <Arrow />
                  </button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      <QuoteForm
        open={quote}
        onOpenChange={setQuote}
        inspiration={inspiration}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (quoteTrigger.current?.isConnected) quoteTrigger.current.focus();
          else
            document.querySelector<HTMLButtonElement>(".header-quote")?.focus();
        }}
      />
      <Dialog.Root open={privacy} onOpenChange={setPrivacy}>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content className="privacy-dialog">
            <Dialog.Close
              className="icon-button dialog-close"
              aria-label={t("nav.close")}
            >
              <X />
            </Dialog.Close>
            <Dialog.Title>{t("privacy.title")}</Dialog.Title>
            <Dialog.Description>{t("privacy.text")}</Dialog.Description>
            <p>{t("privacy.rights")}</p>
            <a href={`mailto:${contact.email}`} dir="ltr">
              {contact.email}
            </a>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
