"use client";
import Link from "next/link";
import { BotCheck } from "./bot-check";
import { AdminPasswordField } from "./admin-password-field";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
export function AdminLogin({ configured }: { configured: boolean }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [botReset, setBotReset] = useState(0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: form.get("username"),
          password: form.get("password"),
          turnstile: token,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Connexion impossible.");
      router.replace("/abdel");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Connexion impossible.",
      );
      setBusy(false);
      setToken("");
      setBotReset((value) => value + 1);
    }
  }
  return (
    <main className="admin-login">
      <Link
        href="/fr"
        className="admin-brand"
        aria-label="NEUZ, retour au site"
      >
        <img src="/images/neuz-logo.png" alt="NEUZ" width="140" height="58" />
      </Link>
      <h1>Votre espace de création</h1>
      <p>Connectez-vous pour gérer les produits et les catégories.</p>
      {!configured && (
        <p className="admin-message error" role="status">
          L’accès administrateur n’est pas encore configuré. Consultez le guide
          d’installation du projet.
        </p>
      )}
      <form onSubmit={submit}>
        <label>
          Identifiant
          <input
            name="username"
            autoComplete="username"
            required
            autoFocus
            maxLength={100}
          />
        </label>
        <AdminPasswordField
          label="Mot de passe"
          name="password"
          autoComplete="current-password"
          disabled={busy}
        />
        <BotCheck
          onToken={setToken}
          reset={botReset}
          action="admin_login"
          errorText="La vérification de sécurité a échoué. Réessayez."
          retryText="Réessayer"
        />
        {error && (
          <p role="alert" className="admin-message error">
            {error}
          </p>
        )}
        <button
          className="admin-primary"
          disabled={
            busy ||
            !configured ||
            Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && !token)
          }
        >
          {busy ? "Connexion…" : "Se connecter"}
        </button>
      </form>
      <Link href="/fr" className="admin-back">
        Retour au site
      </Link>
    </main>
  );
}
