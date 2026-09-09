"use client";
import Link from "next/link";
import { AdminPasswordField } from "./admin-password-field";
import { useState, type FormEvent } from "react";
export function AdminAccountForm({ username }: { username: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    if (data.newPassword !== data.confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      setBusy(false);
      return;
    }
    try {
      const response = await fetch("/api/admin/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();
      if (!response.ok)
        throw Error(result.error || "Impossible de modifier le compte.");
      form.reset();
      setDone(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Réessayez.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="admin-main admin-account">
      <Link href="/admin">← Retour au catalogue</Link>
      <div className="admin-title">
        <div>
          <h1>Mon compte</h1>
          <p>Modifier vos identifiants de connexion.</p>
        </div>
      </div>
      {done ? (
        <div role="status">
          <p>
            Vos identifiants ont été modifiés. Toutes les sessions ont été
            fermées.
          </p>
          <Link href="/admin/login">Se reconnecter</Link>
        </div>
      ) : (
        <form className="admin-editor" onSubmit={submit}>
          <div className="admin-form-grid">
            <label className="admin-wide">
              Identifiant
              <input
                name="username"
                defaultValue={username}
                autoComplete="username"
                required
                minLength={3}
                maxLength={100}
                pattern="[a-zA-Z0-9._@\-]+"
                disabled={busy}
              />
            </label>
            <AdminPasswordField
              label="Mot de passe actuel"
              name="currentPassword"
              autoComplete="current-password"
              disabled={busy}
            />
            <AdminPasswordField
              label="Nouveau mot de passe"
              name="newPassword"
              autoComplete="new-password"
              minLength={8}
              disabled={busy}
            />
            <AdminPasswordField
              label="Confirmer le nouveau mot de passe"
              name="confirmPassword"
              autoComplete="new-password"
              minLength={8}
              disabled={busy}
            />
          </div>
          <p className="admin-hint">
            8 caractères minimum. Vous devrez vous reconnecter après
            l’enregistrement.
          </p>
          {error && (
            <p className="admin-message error" role="alert">
              {error}
            </p>
          )}
          <div className="admin-form-actions">
            <button className="admin-primary" disabled={busy}>
              {busy ? "Enregistrement…" : "Enregistrer les identifiants"}
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
