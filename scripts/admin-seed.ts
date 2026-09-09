import { AdminAccounts } from "../src/lib/admin-account";
import { adminConfigured } from "../src/lib/admin-auth";
if (!adminConfigured())
  throw Error(
    "Run bun run admin:setup first and retain ADMIN_SESSION_SECRET in the server environment.",
  );
await new AdminAccounts().seed(
  process.argv.includes("--reset")
    ? {
        username: process.env.ADMIN_USERNAME || "admin",
        passwordHash: process.env.ADMIN_PASSWORD_HASH!,
      }
    : undefined,
);
console.log(
  process.argv.includes("--reset")
    ? "Compte réinitialisé depuis les variables de configuration. Les anciennes sessions sont invalides."
    : "Compte initialisé. Un compte existant conserve ses identifiants.",
);
