"use client";
import { useRef, useState, type FormEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import * as Dialog from "@radix-ui/react-dialog";
import { BotCheck } from "./bot-check";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowLeft,
  X,
  Upload,
  Check,
  LoaderCircle,
  FileText,
} from "lucide-react";
import {
  profiles,
  projects,
  creations,
  budgets,
  methods,
  fileTypes,
  MAX_FILES,
  MAX_FILE_BYTES,
} from "@/lib/quote";
import { localized } from "@/lib/catalog-model";
import { contact, type Product } from "@/lib/catalog";

const initial = {
  name: "",
  email: "",
  phone: "",
  profile: "",
  project: "",
  creation: "",
  quantity: "1",
  width: "",
  height: "",
  unit: "cm",
  budget: "discuss",
  brief: "",
  method: "whatsapp",
  consent: false,
  website: "",
};
type Draft = typeof initial;
export function QuoteForm({
  open,
  onOpenChange,
  inspiration,
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inspiration?: Product;
  onCloseAutoFocus: (event: Event) => void;
}) {
  const t = useTranslations("form");
  const all = useTranslations();
  const locale = useLocale();
  const [draft, setDraft] = useState<Draft>(initial);
  const [previousInspiration, setPreviousInspiration] = useState<
    Product | undefined
  >();
  const [step, setStep] = useState(0);
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState("");
  const [notice, setNotice] = useState(false);
  const [token, setToken] = useState("");
  const [botReset, setBotReset] = useState(0);
  const requestId = useRef("");
  const formRef = useRef<HTMLFormElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  if (inspiration !== previousInspiration) {
    setPreviousInspiration(inspiration);
    if (inspiration) setDraft({ ...draft, creation: inspiration.creation });
  }
  function change<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setError("");
    requestId.current = "";
  }
  function changeStep(next: number) {
    setStep(next);
    setError("");
    requestAnimationFrame(() => {
      headingRef.current?.focus();
      document.querySelector(".quote-scroll")?.scrollTo({ top: 0 });
    });
  }
  function addFiles(list: FileList | null) {
    if (!list) return;
    const incoming = Array.from(list);
    const combined = [...files, ...incoming];
    if (
      combined.length > MAX_FILES ||
      combined.reduce((sum, f) => sum + f.size, 0) > MAX_FILE_BYTES ||
      incoming.some((f) => !fileTypes.includes(f.type) || f.size === 0)
    ) {
      setFileError(true);
      return;
    }
    setFiles(combined);
    setFileError(false);
    requestId.current = "";
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (step < 2) {
      changeStep(step + 1);
      return;
    }
    setBusy(true);
    setError("");
    if (!requestId.current) requestId.current = crypto.randomUUID();
    const data = new FormData();
    data.set(
      "data",
      JSON.stringify({
        ...draft,
        locale,
        requestId: requestId.current,
        turnstile: token,
        inspiration: inspiration
          ? localized(inspiration, locale).name
          : undefined,
      }),
    );
    files.forEach((f) => data.append("files", f));
    try {
      const response = await fetch("/api/quote", {
        method: "POST",
        body: data,
        signal: AbortSignal.timeout(30000),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.code === "UNAVAILABLE"
            ? "unavailable"
            : result.code === "QUOTA_LIMIT"
              ? "quotaLimit"
              : result.code === "RATE_LIMIT"
                ? "rateLimit"
                : result.code === "INVALID"
                  ? "invalid"
                  : "error",
        );
        setBotReset((v) => v + 1);
        setToken("");
        requestAnimationFrame(() => errorRef.current?.focus());
      } else {
        setSuccess(result.reference);
      }
    } catch {
      setError("error");
      setBotReset((value) => value + 1);
      setToken("");
      requestAnimationFrame(() => errorRef.current?.focus());
    } finally {
      setBusy(false);
    }
  }
  function input(
    key: keyof Draft,
    type = "text",
    extra: Record<string, unknown> = {},
  ) {
    return (
      <div className="field">
        <label htmlFor={`quote-${key}`}>
          {t(key)} <span>*</span>
        </label>
        <input
          id={`quote-${key}`}
          name={key}
          type={type}
          value={String(draft[key])}
          onChange={(e) => change(key, e.target.value)}
          required
          {...extra}
        />
      </div>
    );
  }
  function select(
    key: keyof Draft,
    options: readonly string[],
    namespace: string,
  ) {
    return (
      <div className="field">
        <label htmlFor={`quote-${key}`}>
          {t(key)} <span>*</span>
        </label>
        <select
          id={`quote-${key}`}
          name={key}
          value={String(draft[key])}
          onChange={(e) => change(key, e.target.value)}
          required
        >
          <option value="" disabled>
            {t("select")}
          </option>
          {options.map((value) => (
            <option key={value} value={value}>
              {t(`${namespace}.${value}`)}
            </option>
          ))}
        </select>
      </div>
    );
  }
  const steps = t.raw("steps") as string[];
  function changeOpen(value: boolean) {
    if (busy) return;
    onOpenChange(value);
    if (!value && success) {
      setDraft({ ...initial, creation: inspiration?.creation || "" });
      setFiles([]);
      setStep(0);
      setSuccess("");
      setFileError(false);
      setNotice(false);
      setToken("");
      requestId.current = "";
    }
  }
  return (
    <Dialog.Root open={open} onOpenChange={changeOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className="quote-dialog"
          onCloseAutoFocus={onCloseAutoFocus}
          onPointerDownOutside={(e) => e.preventDefault()}
          aria-describedby="quote-description"
        >
          <div className="quote-sidebar">
            <a className="wordmark" href={`/${locale}`}>
              NEUZ
            </a>
            <p className="eyebrow">{t("label")}</p>
            <p className="quote-sidebar-title">
              {all("hero.line1")}
              <br />
              <em>{all("hero.line2")}</em>
              <br />
              {all("hero.line3")}
            </p>
            <div className="quote-sidebar-bottom">
              <span>{all("contact.location")}</span>
              <a href={`mailto:${contact.email}`} dir="ltr">
                {contact.email}
              </a>
            </div>
          </div>
          <div className="quote-main">
            <Dialog.Close
              className="icon-button dialog-close"
              aria-label={t("close")}
              disabled={busy}
            >
              <X strokeWidth={1.5} />
            </Dialog.Close>
            <div className="quote-scroll">
              {success ? (
                <div className="quote-success">
                  <div className="success-check">
                    <Check size={32} strokeWidth={1.2} />
                  </div>
                  <Dialog.Title>{t("successTitle")}</Dialog.Title>
                  <Dialog.Description id="quote-description">
                    {t("successText")}
                  </Dialog.Description>
                  <p className="eyebrow" dir="ltr">
                    {t("successRef", { id: success })}
                  </p>
                  <button
                    className="button button-dark"
                    onClick={() => changeOpen(false)}
                  >
                    {t("done")}
                    <ArrowUpRight size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <p className="eyebrow">
                    {t("step", { current: step + 1, total: 3 })}
                  </p>
                  <Dialog.Title>{t("title")}</Dialog.Title>
                  <Dialog.Description id="quote-description">
                    {t("description")}
                  </Dialog.Description>
                  <ol className="form-progress">
                    {steps.map((label, i) => (
                      <li
                        className={
                          i === step ? "current" : i < step ? "complete" : ""
                        }
                        key={label}
                        aria-current={i === step ? "step" : undefined}
                      >
                        <span>
                          {i < step ? (
                            <Check size={12} />
                          ) : (
                            String(i + 1).padStart(2, "0")
                          )}
                        </span>
                        {label}
                      </li>
                    ))}
                  </ol>
                  <h3 className="sr-only" ref={headingRef} tabIndex={-1}>
                    {steps[step]}
                  </h3>
                  {inspiration && (
                    <p className="inspiration-note">
                      {t("inspiration", {
                        name: localized(inspiration, locale).name,
                      })}
                    </p>
                  )}
                  <form ref={formRef} onSubmit={submit} className="quote-form">
                    <div className="honeypot" aria-hidden="true">
                      <label htmlFor="quote-website">Website</label>
                      <input
                        tabIndex={-1}
                        autoComplete="off"
                        id="quote-website"
                        value={draft.website}
                        onChange={(e) => change("website", e.target.value)}
                      />
                    </div>
                    {step === 0 && (
                      <div className="form-grid">
                        {input("name", "text", {
                          autoComplete: "name",
                          minLength: 2,
                          maxLength: 120,
                        })}
                        {input("email", "email", {
                          autoComplete: "email",
                          dir: "ltr",
                          maxLength: 254,
                        })}
                        {input("phone", "tel", {
                          autoComplete: "tel",
                          dir: "ltr",
                          minLength: 7,
                          maxLength: 32,
                          pattern: "[+0-9 ().\\-]{7,32}",
                          placeholder: "+212 …",
                        })}
                        {select("profile", profiles, "profiles")}
                      </div>
                    )}
                    {step === 1 && (
                      <div className="form-grid">
                        {select("project", projects, "projects")}
                        {select("creation", creations, "creations")}
                        {input("quantity", "number", {
                          min: 1,
                          max: 10000,
                          step: 1,
                          inputMode: "numeric",
                        })}
                        {select("budget", budgets, "budgets")}
                        <fieldset className="dimensions field-wide">
                          <legend>{t("dimensions")}</legend>
                          <div className="dimension-grid">
                            <div className="field">
                              <label htmlFor="quote-width">{t("width")}</label>
                              <input
                                type="number"
                                id="quote-width"
                                min="0.01"
                                max="100000"
                                step="any"
                                inputMode="decimal"
                                value={draft.width}
                                onChange={(e) =>
                                  change("width", e.target.value)
                                }
                              />
                            </div>
                            <span aria-hidden="true">×</span>
                            <div className="field">
                              <label htmlFor="quote-height">
                                {t(
                                  ["rug", "table", "cushion"].includes(
                                    draft.creation,
                                  )
                                    ? "length"
                                    : "vertical",
                                )}
                              </label>
                              <input
                                type="number"
                                id="quote-height"
                                min="0.01"
                                max="100000"
                                step="any"
                                inputMode="decimal"
                                value={draft.height}
                                onChange={(e) =>
                                  change("height", e.target.value)
                                }
                              />
                            </div>
                            <div className="field">
                              <label htmlFor="quote-unit">{t("unit")}</label>
                              <select
                                id="quote-unit"
                                value={draft.unit}
                                onChange={(e) => change("unit", e.target.value)}
                              >
                                {["cm", "m", "mm"].map((unit) => (
                                  <option key={unit}>{unit}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <p className="field-hint">{t("dimensionHint")}</p>
                        </fieldset>
                      </div>
                    )}
                    {step === 2 && (
                      <div className="form-grid">
                        <div className="field field-wide">
                          <label htmlFor="quote-brief">{t("brief")} *</label>
                          <textarea
                            id="quote-brief"
                            value={draft.brief}
                            onChange={(e) => change("brief", e.target.value)}
                            required
                            minLength={10}
                            maxLength={6000}
                            rows={4}
                            placeholder={t("briefPlaceholder")}
                          />
                        </div>
                        <div className="field field-wide">
                          <label htmlFor="quote-files">{t("files")}</label>
                          <div className="upload-area">
                            <Upload size={22} strokeWidth={1.2} />
                            <button
                              type="button"
                              className="text-link"
                              onClick={() => fileRef.current?.click()}
                            >
                              {t("upload")}
                              <PlusSmall />
                            </button>
                            <input
                              ref={fileRef}
                              id="quote-files"
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              multiple
                              className="sr-only"
                              tabIndex={-1}
                              onChange={(e) => {
                                addFiles(e.target.files);
                                e.target.value = "";
                              }}
                              aria-describedby="file-hint"
                            />
                            <p className="field-hint" id="file-hint">
                              {t("fileHint")}
                            </p>
                          </div>
                          {fileError && (
                            <p role="alert" className="field-error">
                              {t("fileError")}{" "}
                              <button
                                type="button"
                                onClick={() => setFileError(false)}
                                aria-label={all("nav.close")}
                              >
                                <X size={14} />
                              </button>
                            </p>
                          )}
                          {files.length > 0 && (
                            <ul className="file-list">
                              {files.map((file, i) => (
                                <li key={`${file.name}-${i}`}>
                                  <FileText size={15} />
                                  <span dir="auto">{file.name}</span>
                                  <small>
                                    {Math.ceil(file.size / 1024)} KB
                                  </small>
                                  <button
                                    type="button"
                                    className="icon-button"
                                    aria-label={t("remove", {
                                      name: file.name,
                                    })}
                                    onClick={() => {
                                      setFiles(
                                        files.filter((_, index) => i !== index),
                                      );
                                      setFileError(false);
                                      requestId.current = "";
                                    }}
                                  >
                                    <X size={15} />
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                        <fieldset className="contact-method field-wide">
                          <legend>{t("method")} *</legend>
                          <div>
                            {methods.map((method) => (
                              <label key={method}>
                                <input
                                  type="radio"
                                  name="method"
                                  value={method}
                                  checked={draft.method === method}
                                  onChange={() => change("method", method)}
                                />
                                <span>{t(`methods.${method}`)}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <div className="consent field-wide">
                          <label>
                            <input
                              type="checkbox"
                              checked={draft.consent}
                              onChange={(e) =>
                                change("consent", e.target.checked)
                              }
                              required
                            />
                            <span>{t("consent")} *</span>
                          </label>
                          <button
                            className="privacy-link"
                            type="button"
                            onClick={() => setNotice(!notice)}
                            aria-expanded={notice}
                          >
                            {t("privacy")}
                          </button>
                          {notice && (
                            <div className="inline-privacy">
                              <p>{all("privacy.text")}</p>
                              <p>
                                {all("privacy.rights", {
                                  email: contact.email,
                                })}
                              </p>
                            </div>
                          )}
                        </div>
                        <BotCheck
                          onToken={setToken}
                          reset={botReset}
                          action="quote"
                          errorText={t("botError")}
                          retryText={t("botRetry")}
                        />
                      </div>
                    )}
                    {error && (
                      <div
                        className="form-error"
                        role="alert"
                        tabIndex={-1}
                        ref={errorRef}
                      >
                        <p>{t(error)}</p>
                        <a href={`mailto:${contact.email}`}>
                          Email <ArrowUpRight size={14} />
                        </a>
                        <a
                          href={contact.whatsapp}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          WhatsApp <ArrowUpRight size={14} />
                        </a>
                      </div>
                    )}
                    <div className="form-actions">
                      <div>
                        {step > 0 ? (
                          <button
                            type="button"
                            className="text-link"
                            onClick={() => changeStep(step - 1)}
                            disabled={busy}
                          >
                            <ArrowLeft size={16} className="directional" />
                            {t("back")}
                          </button>
                        ) : (
                          <span className="field-hint">{t("required")}</span>
                        )}
                      </div>
                      <button
                        className="button button-dark"
                        type="submit"
                        disabled={
                          busy ||
                          (step === 2 &&
                            Boolean(
                              process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
                            ) &&
                            !token)
                        }
                      >
                        {busy ? (
                          <>
                            <LoaderCircle className="spinner" size={17} />
                            {t("sending")}
                          </>
                        ) : (
                          <>
                            {t(step === 2 ? "send" : "next")}
                            <ArrowRight size={18} className="directional" />
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </>
              )}
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function PlusSmall() {
  return <span aria-hidden="true">+</span>;
}
