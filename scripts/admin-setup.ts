import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { hashPassword } from "../src/lib/admin-auth";
const existing = await readFile(".env.local", "utf8").catch(() => "");
if (
  /^ADMIN_PASSWORD_HASH=.+/m.test(existing) &&
  !process.argv.includes("--reset")
) {
  console.log(
    "Le compte administrateur existe d\u00E9j\u00E0. Utilisez --reset pour changer son mot de passe.",
  );
  process.exit(0);
}
const password = randomBytes(18).toString("base64url");
const values = {
  ADMIN_USERNAME: "admin",
  ADMIN_PASSWORD_HASH: hashPassword(password),
  ADMIN_SESSION_SECRET: randomBytes(48).toString("hex"),
};
let result = existing;
for (const [key, value] of Object.entries(values)) {
  const pattern = new RegExp("^" + key + "=.*$", "m");
  result = pattern.test(result)
    ? result.replace(pattern, key + "=" + value)
    : result.trimEnd() + "\n" + key + "=" + value + "\n";
}
await writeFile(".env.local", result, { mode: 0o600 });
await mkdir("tmp", { recursive: true });
await writeFile(
  "tmp/admin-access.txt",
  "NEUZ admin\nURL: http://127.0.0.1:3000/abdel\nUtilisateur: admin\nMot de passe: " +
    password +
    "\n\nIdentifiants locaux priv\u00E9s. Ne pas publier ce fichier.\n",
  { mode: 0o600 },
);
console.log(
  "Compte configur\u00E9. Identifiants priv\u00E9s : tmp/admin-access.txt. Exécutez bun run admin:seed pour initialiser le compte (ajoutez --reset pour remplacer un compte existant), puis redémarrez le serveur.",
);
