"use client";
import Link from "next/link";
import { UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  imageSource,
  type CatalogCategory,
  type CatalogProduct,
  type CatalogLocale,
  type ProductText,
  type CategoryText,
} from "@/lib/catalog-model";
import { creations } from "@/lib/quote";
import fr from "../../messages/fr.json";
type State = {
  version: number;
  products: CatalogProduct[];
  categories: CatalogCategory[];
  storage: "local" | "supabase";
};
const blankProductText: ProductText = {
  name: "",
  type: "",
  description: "",
  alt: "",
};
const blankCategoryText: CategoryText = {
  name: "",
  title: "",
  description: "",
  intro: "",
  detail: "",
  question: "",
  answer: "",
};
function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}
export function AdminPanel({ initialData }: { initialData: State }) {
  const router = useRouter();
  const [data, setData] = useState<State | null>(initialData);
  const [tab, setTab] = useState<"products" | "categories">("products");
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const [category, setCategory] = useState<CatalogCategory | null>(null);
  const [language, setLanguage] = useState<CatalogLocale>("fr");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  async function request(url: string, options: RequestInit = {}) {
    const response = await fetch(url, { ...options, cache: "no-store" });
    const result = await response.json();
    if (response.status === 401) {
      router.replace("/abdel/login");
      router.refresh();
      throw Error("Veuillez vous reconnecter.");
    }
    if (!response.ok) throw Error(result.error || "La requête a échoué.");
    return result;
  }
  async function load() {
    setBusy(true);
    setError("");
    try {
      setData(await request("/api/admin/catalog"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chargement impossible.");
    } finally {
      setBusy(false);
    }
  }
  function closeEditor() {
    setProduct(null);
    setCategory(null);
    setError("");
  }
  function switchTab(next: typeof tab) {
    if (
      (product || category) &&
      !window.confirm("Abandonner les modifications non enregistrées ?")
    )
      return;
    closeEditor();
    setTab(next);
    setQuery("");
  }
  function editProduct(value?: CatalogProduct) {
    setCategory(null);
    setLanguage("fr");
    setNotice("");
    setError("");
    setProduct(
      value
        ? structuredClone(value)
        : {
            id: "",
            category: data?.categories[0]?.id || "",
            creation: "other",
            image: "",
            published: true,
            order: data?.products.length || 0,
            translations: {
              fr: { ...blankProductText },
              en: { ...blankProductText },
              ar: { ...blankProductText },
            },
          },
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function editCategory(value?: CatalogCategory) {
    setProduct(null);
    setLanguage("fr");
    setNotice("");
    setError("");
    setCategory(
      value
        ? structuredClone(value)
        : {
            id: "",
            slug: "",
            creation: "other",
            published: true,
            order: data?.categories.length || 0,
            translations: {
              fr: { ...blankCategoryText },
              en: { ...blankCategoryText },
              ar: { ...blankCategoryText },
            },
          },
    );
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function mutate(
    kind: "product" | "category",
    action: "save" | "delete",
    id?: string,
    value?: unknown,
  ) {
    if (!data) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      setData(
        await request("/api/admin/catalog", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind,
            action,
            id: id || undefined,
            value,
            version: data.version,
          }),
        }),
      );
      closeEditor();
      setNotice(
        action === "delete"
          ? "Suppression enregistrée."
          : "Modifications enregistrées. Le site est à jour.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }
  function save(event: FormEvent) {
    event.preventDefault();
    const value = product || category;
    if (!value) return;
    if (
      value.translations.fr.name.trim().length < 2 ||
      value.translations.fr.description.trim().length < 10
    ) {
      setLanguage("fr");
      setError(
        "Ajoutez un nom et une description en français (10 caractères minimum).",
      );
      return;
    }
    if (product && !product.image) {
      setError("Importez une image pour ce produit.");
      return;
    }
    void mutate(product ? "product" : "category", "save", value.id, value);
  }
  async function upload(file: File | undefined) {
    if (!file || !product) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Choisissez une image de moins de 3 Mo.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const result = await request("/api/admin/upload", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      setProduct((current) =>
        current ? { ...current, image: result.image } : current,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import impossible.");
    } finally {
      setUploading(false);
    }
  }
  function productText(key: keyof ProductText, value: string) {
    setProduct((current) =>
      current
        ? {
            ...current,
            translations: {
              ...current.translations,
              [language]: { ...current.translations[language], [key]: value },
            },
          }
        : current,
    );
  }
  function categoryText(key: keyof CategoryText, value: string) {
    setCategory((current) => {
      if (!current) return current;
      const autoSlug =
        !current.id &&
        language === "fr" &&
        key === "name" &&
        (!current.slug ||
          current.slug === slugify(current.translations.fr.name));
      return {
        ...current,
        slug: autoSlug ? slugify(value) : current.slug,
        translations: {
          ...current.translations,
          [language]: { ...current.translations[language], [key]: value },
        },
      };
    });
  }
  async function logout() {
    if (
      (product || category) &&
      !window.confirm("Quitter sans enregistrer les modifications ?")
    )
      return;
    setBusy(true);
    try {
      await request("/api/admin/logout", { method: "POST" });
      router.replace("/abdel/login");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Déconnexion impossible.");
      setBusy(false);
    }
  }
  const editing = Boolean(product || category);
  const disabled = busy || uploading;
  const languageButtons = (
    <div
      className="admin-languages"
      role="group"
      aria-label="Langue du contenu"
    >
      {(["fr", "en", "ar"] as const).map((locale) => (
        <button
          type="button"
          key={locale}
          aria-pressed={language === locale}
          onClick={() => setLanguage(locale)}
          disabled={disabled}
        >
          {
            {
              fr: "Français",
              en: "English",
              ar: "العربية",
            }[locale]
          }
        </button>
      ))}
    </div>
  );
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-header-left">
          <Link
            className="admin-account-link"
            href="/abdel/account"
            aria-label="Mon compte"
            title="Mon compte"
          >
            <UserRound size={21} aria-hidden="true" />
          </Link>
          <Link
            className="admin-brand"
            href="/abdel"
            aria-label="NEUZ administration"
          >
            <img
              src="/images/neuz-logo.png"
              alt="NEUZ"
              width="120"
              height="50"
            />
          </Link>
        </div>
        <div>
          <a href="/fr" target="_blank" rel="noopener noreferrer">
            Voir le site ↗
          </a>
          <button onClick={logout} disabled={disabled}>
            Se déconnecter
          </button>
        </div>
      </header>
      <main className="admin-main">
        <div className="admin-title">
          <div>
            <h1>Le catalogue</h1>
            <p>Vos créations, leurs images et leurs catégories.</p>
          </div>
          {data && !editing && (
            <button
              className="admin-primary"
              disabled={
                disabled || (tab === "products" && !data.categories.length)
              }
              onClick={() =>
                tab === "products" ? editProduct() : editCategory()
              }
            >
              {tab === "products"
                ? "Ajouter un produit"
                : "Ajouter une catégorie"}
            </button>
          )}
        </div>
        {data?.storage === "local" && (
          <p className="admin-local">
            Mode local : vos modifications sont enregistrées sur cet ordinateur.
            Connectez Supabase avant la mise en ligne.
          </p>
        )}
        <nav className="admin-tabs" aria-label="Gestion du catalogue">
          <button
            aria-current={tab === "products" ? "page" : undefined}
            onClick={() => switchTab("products")}
            disabled={disabled}
          >
            Produits <span>{data?.products.length || 0}</span>
          </button>
          <button
            aria-current={tab === "categories" ? "page" : undefined}
            onClick={() => switchTab("categories")}
            disabled={disabled}
          >
            Catégories <span>{data?.categories.length || 0}</span>
          </button>
        </nav>
        {error && (
          <div className="admin-message error" role="alert">
            <p>{error}</p>
            <button onClick={load} disabled={disabled}>
              Recharger les données
            </button>
          </div>
        )}
        {notice && (
          <p className="admin-message success" role="status">
            {notice}
          </p>
        )}
        {!data && !error && <p role="status">Chargement du catalogue…</p>}
        {editing && (
          <section className="admin-editor" aria-labelledby="edit-title">
            <div className="admin-editor-heading">
              <h2 id="edit-title">
                {product
                  ? product.id
                    ? "Modifier le produit"
                    : "Nouveau produit"
                  : category?.id
                    ? "Modifier la catégorie"
                    : "Nouvelle catégorie"}
              </h2>
              <button
                type="button"
                onClick={() => {
                  if (
                    window.confirm(
                      "Abandonner les modifications non enregistrées ?",
                    )
                  )
                    closeEditor();
                }}
                disabled={disabled}
              >
                Annuler
              </button>
            </div>
            <form onSubmit={save}>
              {languageButtons}
              <p className="admin-hint">
                Le français est obligatoire. Les traductions laissées vides
                reprennent le texte français.
              </p>
              {product && (
                <>
                  <div
                    className="admin-form-grid"
                    dir={language === "ar" ? "rtl" : "ltr"}
                  >
                    <label>
                      Nom du produit
                      <input
                        value={product.translations[language].name}
                        onChange={(e) => productText("name", e.target.value)}
                        required={language === "fr"}
                        maxLength={120}
                        disabled={disabled}
                      />
                    </label>
                    <label>
                      Sous-titre
                      <input
                        value={product.translations[language].type}
                        onChange={(e) => productText("type", e.target.value)}
                        placeholder="Ex. Miroir sculptural"
                        maxLength={160}
                        disabled={disabled}
                      />
                    </label>
                    <label className="admin-wide">
                      Description
                      <textarea
                        value={product.translations[language].description}
                        onChange={(e) =>
                          productText("description", e.target.value)
                        }
                        required={language === "fr"}
                        minLength={language === "fr" ? 10 : undefined}
                        maxLength={4000}
                        disabled={disabled}
                      />
                    </label>
                    <label className="admin-wide">
                      Description de l’image
                      <input
                        value={product.translations[language].alt}
                        onChange={(e) => productText("alt", e.target.value)}
                        placeholder="Décrivez ce que montre la photo"
                        maxLength={240}
                        disabled={disabled}
                      />
                    </label>
                  </div>
                  <div className="admin-form-grid">
                    <label>
                      Catégorie
                      <select
                        value={product.category}
                        onChange={(e) =>
                          setProduct({ ...product, category: e.target.value })
                        }
                        required
                        disabled={disabled}
                      >
                        <option value="">Choisir une catégorie</option>
                        {data?.categories.map((c) => (
                          <option value={c.id} key={c.id}>
                            {c.translations.fr.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Position dans la galerie
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        value={product.order}
                        onChange={(e) =>
                          setProduct({
                            ...product,
                            order: Number(e.target.value),
                          })
                        }
                        disabled={disabled}
                      />
                    </label>
                  </div>
                  <div className="admin-image-editor">
                    {product.image && (
                      <img
                        src={imageSource(product.image, 480)}
                        alt={
                          product.translations.fr.alt ||
                          product.translations.fr.name ||
                          "Aperçu du produit"
                        }
                        width="150"
                        height="180"
                      />
                    )}
                    <label>
                      {uploading
                        ? "Import de l’image…"
                        : product.image
                          ? "Remplacer l’image"
                          : "Image du produit"}
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => void upload(e.target.files?.[0])}
                        disabled={disabled}
                      />
                      <span className="admin-hint">
                        JPG, PNG ou WebP, 3 Mo maximum. L’image sera optimisée
                        automatiquement.
                      </span>
                    </label>
                  </div>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={product.published}
                      onChange={(e) =>
                        setProduct({ ...product, published: e.target.checked })
                      }
                      disabled={disabled}
                    />
                    Visible sur le site
                  </label>
                </>
              )}
              {category && (
                <>
                  <div
                    className="admin-form-grid"
                    dir={language === "ar" ? "rtl" : "ltr"}
                  >
                    <label>
                      Nom de la catégorie
                      <input
                        value={category.translations[language].name}
                        onChange={(e) => categoryText("name", e.target.value)}
                        required={language === "fr"}
                        maxLength={80}
                        disabled={disabled}
                      />
                    </label>
                    <label>
                      Titre de la page (facultatif)
                      <input
                        value={category.translations[language].title}
                        onChange={(e) => categoryText("title", e.target.value)}
                        placeholder="Ex. Poufs sur mesure à Marrakech"
                        maxLength={160}
                        disabled={disabled}
                      />
                    </label>
                    <label className="admin-wide">
                      Description
                      <textarea
                        value={category.translations[language].description}
                        onChange={(e) =>
                          categoryText("description", e.target.value)
                        }
                        required={language === "fr"}
                        minLength={language === "fr" ? 10 : undefined}
                        maxLength={4000}
                        disabled={disabled}
                      />
                    </label>
                  </div>
                  <details className="admin-details">
                    <summary>
                      Texte complémentaire de la page (facultatif)
                    </summary>
                    <div
                      className="admin-form-grid"
                      dir={language === "ar" ? "rtl" : "ltr"}
                    >
                      {(
                        [
                          ["intro", "Introduction"],
                          ["detail", "Détails"],
                          ["question", "Question fréquente"],
                          ["answer", "Réponse"],
                        ] as const
                      ).map(([key, label]) => (
                        <label className="admin-wide" key={key}>
                          {label}
                          <textarea
                            value={category.translations[language][key]}
                            onChange={(e) => categoryText(key, e.target.value)}
                            maxLength={key === "question" ? 240 : 4000}
                            disabled={disabled}
                          />
                        </label>
                      ))}
                    </div>
                  </details>
                  <div className="admin-form-grid">
                    <label>
                      Adresse de la page
                      <input
                        value={category.slug}
                        onChange={(e) =>
                          setCategory({ ...category, slug: e.target.value })
                        }
                        required
                        pattern="[a-z0-9]+(-[a-z0-9]+)*"
                        minLength={2}
                        maxLength={80}
                        readOnly={Boolean(category.id)}
                        disabled={disabled}
                      />
                      <span className="admin-hint">
                        /fr/creations/{category.slug || "nouvelle-categorie"}
                        {category.id
                          ? " · Adresse conservée pour les liens existants."
                          : ""}
                      </span>
                    </label>
                    <label>
                      Type dans les demandes de devis
                      <select
                        value={category.creation}
                        onChange={(e) =>
                          setCategory({
                            ...category,
                            creation: e.target
                              .value as CatalogCategory["creation"],
                          })
                        }
                        disabled={disabled}
                      >
                        {creations.map((c) => (
                          <option key={c} value={c}>
                            {fr.form.creations[c]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Position dans les filtres
                      <input
                        type="number"
                        min={0}
                        max={10000}
                        value={category.order}
                        onChange={(e) =>
                          setCategory({
                            ...category,
                            order: Number(e.target.value),
                          })
                        }
                        disabled={disabled}
                      />
                    </label>
                  </div>
                  <label className="admin-checkbox">
                    <input
                      type="checkbox"
                      checked={category.published}
                      onChange={(e) =>
                        setCategory({
                          ...category,
                          published: e.target.checked,
                        })
                      }
                      disabled={disabled}
                    />
                    Visible sur le site
                  </label>
                  <p className="admin-hint">
                    Une catégorie apparaît sur le site dès qu’elle contient un
                    produit visible.
                  </p>
                </>
              )}
              <div className="admin-form-actions">
                <button className="admin-primary" disabled={disabled}>
                  {uploading
                    ? "Import en cours…"
                    : busy
                      ? "Enregistrement…"
                      : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Abandonner les modifications non enregistrées ?",
                      )
                    )
                      closeEditor();
                  }}
                  disabled={disabled}
                >
                  Annuler
                </button>
              </div>
            </form>
          </section>
        )}
        {data && !editing && (
          <>
            <label className="admin-search">
              Rechercher
              <input
                type="search"
                placeholder={
                  tab === "products"
                    ? "Nom du produit…"
                    : "Nom de la catégorie…"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <div className="admin-list">
              {tab === "products"
                ? data.products
                    .filter((p) =>
                      p.translations.fr.name
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .sort((a, b) => a.order - b.order)
                    .map((p) => (
                      <article className="admin-row" key={p.id}>
                        <img
                          src={imageSource(p.image, 480)}
                          alt={p.translations.fr.alt || p.translations.fr.name}
                          width="76"
                          height="88"
                        />
                        <div className="admin-row-copy">
                          <h2>{p.translations.fr.name}</h2>
                          <p>
                            {
                              data.categories.find((c) => c.id === p.category)
                                ?.translations.fr.name
                            }
                          </p>
                          <span className="admin-status">
                            {p.published &&
                            data.categories.find((c) => c.id === p.category)
                              ?.published
                              ? "Visible"
                              : "Masqué"}
                          </span>
                        </div>
                        <div className="admin-row-actions">
                          <button
                            onClick={() => editProduct(p)}
                            disabled={disabled}
                            aria-label={"Modifier " + p.translations.fr.name}
                          >
                            Modifier
                          </button>
                          <button
                            className="admin-danger"
                            onClick={() => {
                              if (
                                window.confirm(
                                  "Supprimer le produit « " +
                                    p.translations.fr.name +
                                    " » ?",
                                )
                              )
                                void mutate("product", "delete", p.id);
                            }}
                            disabled={disabled}
                            aria-label={"Supprimer " + p.translations.fr.name}
                          >
                            Supprimer
                          </button>
                        </div>
                      </article>
                    ))
                : data.categories
                    .filter((c) =>
                      c.translations.fr.name
                        .toLowerCase()
                        .includes(query.toLowerCase()),
                    )
                    .sort((a, b) => a.order - b.order)
                    .map((c) => {
                      const count = data.products.filter(
                        (p) => p.category === c.id,
                      ).length;
                      return (
                        <article className="admin-row category" key={c.id}>
                          <div className="admin-row-copy">
                            <h2>{c.translations.fr.name}</h2>
                            <p>
                              {count} produit{count !== 1 ? "s" : ""} ·
                              /creations/{c.slug}
                            </p>
                            <span className="admin-status">
                              {!c.published
                                ? "Masquée"
                                : data.products.some(
                                      (p) => p.category === c.id && p.published,
                                    )
                                  ? "Visible"
                                  : "En attente de produits"}
                            </span>
                          </div>
                          <div className="admin-row-actions">
                            <button
                              onClick={() => editCategory(c)}
                              disabled={disabled}
                              aria-label={"Modifier " + c.translations.fr.name}
                            >
                              Modifier
                            </button>
                            <button
                              className="admin-danger"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Supprimer la catégorie « " +
                                      c.translations.fr.name +
                                      " » ?",
                                  )
                                )
                                  void mutate("category", "delete", c.id);
                              }}
                              disabled={disabled || count > 0}
                              title={
                                count
                                  ? "Déplacez ou supprimez ses produits avant de supprimer cette catégorie."
                                  : undefined
                              }
                              aria-label={"Supprimer " + c.translations.fr.name}
                            >
                              Supprimer
                            </button>
                          </div>
                        </article>
                      );
                    })}
              {(tab === "products" ? data.products : data.categories).filter(
                (item) =>
                  item.translations.fr.name
                    .toLowerCase()
                    .includes(query.toLowerCase()),
              ).length === 0 && (
                <p className="admin-empty">
                  {query
                    ? "Aucun résultat."
                    : tab === "products"
                      ? data.categories.length
                        ? "Ajoutez votre premier produit."
                        : "Créez une catégorie avant d’ajouter un produit."
                      : "Ajoutez votre première catégorie."}
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
