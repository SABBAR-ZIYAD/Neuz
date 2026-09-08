import { type QuoteData } from "./quote";
import fr from "../../messages/fr.json";
export function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
}
export function quoteEmail(
  data: QuoteData,
  reference: string,
  filenames: string[],
) {
  const f = fr.form;
  const rows: [string, string][] = [
    ["Référence", reference],
    ["Nom complet", data.name],
    ["Email", data.email],
    ["Téléphone / WhatsApp", data.phone],
    ["Profil client", f.profiles[data.profile]],
    ["Type de projet", f.projects[data.project]],
    ["Type de création", f.creations[data.creation]],
    ["Quantité", String(data.quantity)],
    [
      "Dimensions (largeur × hauteur / longueur)",
      `${data.width || "À définir"} × ${data.height || "À définir"} ${data.unit}`,
    ],
    ["Budget indicatif", f.budgets[data.budget]],
    ["Description / brief", data.brief],
    [
      "Références jointes",
      filenames.length ? filenames.join("\n") : "Aucune pièce jointe",
    ],
    ["Contact souhaité", f.methods[data.method]],
    ["Pièce d’inspiration", data.inspiration || "Non précisée"],
    [
      "Langue du formulaire",
      { fr: "Français", en: "English", ar: "العربية" }[data.locale],
    ],
    ["Accord de contact", "Oui"],
  ];
  const phone = data.phone.replace(/[^\d+]/g, "");
  const action =
    data.method === "email"
      ? `mailto:${data.email}`
      : data.method === "whatsapp"
        ? `https://wa.me/${phone.replace(/\D/g, "")}`
        : `tel:${phone}`;
  const text =
    `NEUZ — Nouvelle demande de devis\nContact souhaité : ${f.methods[data.method]}\n${action}\n\n` +
    rows.map(([k, v]) => `${k} : ${v}`).join("\n\n");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f3ece2;font-family:Arial,sans-serif;color:#4a2b18"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:32px 12px"><table role="presentation" width="100%" style="max-width:640px;margin:auto;background:#fffaf3" cellpadding="0" cellspacing="0"><tr><td style="padding:32px;background:#4a2b18;color:#f3ece2"><div style="font-family:Georgia,serif;font-size:38px;letter-spacing:6px">NEUZ</div><p style="font-size:11px;letter-spacing:2px">CRÉATEUR D’ÉMOTIONS VISUELLES</p></td></tr><tr><td style="padding:32px"><h1 style="font-family:Georgia,serif;font-weight:400;font-size:28px">Une nouvelle idée à faire vivre.</h1><p>Nouvelle demande de devis depuis le site NEUZ.</p><p style="padding:18px;background:#f3ece2"><strong>Contact souhaité : ${escapeHtml(f.methods[data.method])}</strong><br><a href="${escapeHtml(action)}" style="color:#4a2b18;display:inline-block;margin-top:10px">Contacter ${escapeHtml(data.name)}</a></p><table width="100%" cellpadding="0" cellspacing="0">${rows.map(([label, value]) => `<tr><th scope="row" align="left" valign="top" style="width:38%;padding:13px 12px 13px 0;border-bottom:1px solid #e8dfd3;font-size:12px">${escapeHtml(label)}</th><td dir="auto" style="padding:13px 0;border-bottom:1px solid #e8dfd3;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere">${escapeHtml(value)}</td></tr>`).join("")}</table><p style="font-size:12px;color:#756253;margin-top:24px">Les fichiers ci-joints proviennent du demandeur. Vérifiez leur provenance avant de les ouvrir. Répondre à cet email adresse votre réponse au client.</p></td></tr></table></td></tr></table></body></html>`;
  return {
    html,
    text,
    subject: `[NEUZ · ${reference}] Devis — ${f.creations[data.creation]} — ${data.name.replace(/[\r\n]/g, " ")}`,
  };
}
