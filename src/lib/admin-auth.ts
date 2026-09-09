import {
  createHmac,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
export const adminCookie = "neuz_admin";
export const sessionSeconds = 8 * 60 * 60;
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return (
    "scrypt:" + salt + ":" + scryptSync(password, salt, 64).toString("hex")
  );
}
export function verifyPassword(password: string, encoded: string) {
  const [algorithm, salt, hash] = encoded.split(":");
  if (
    algorithm !== "scrypt" ||
    !salt ||
    !hash ||
    !/^[a-f0-9]{128}$/.test(hash) ||
    password.length > 256
  )
    return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return timingSafeEqual(actual, expected);
}
export function adminConfigured(
  passwordHash = process.env.ADMIN_PASSWORD_HASH,
) {
  return Boolean(
    passwordHash?.startsWith("scrypt:") &&
    (process.env.ADMIN_SESSION_SECRET?.length || 0) >= 32,
  );
}
function fingerprint(passwordHash: string | undefined) {
  return createHash("sha256")
    .update(passwordHash || "")
    .digest("hex");
}
export function createSession(
  now = Date.now(),
  passwordHash = process.env.ADMIN_PASSWORD_HASH,
) {
  if (!adminConfigured(passwordHash)) throw Error("Admin not configured");
  const payload = Buffer.from(
    JSON.stringify({
      exp: now + sessionSeconds * 1000,
      nonce: randomBytes(16).toString("hex"),
      credential: fingerprint(passwordHash),
    }),
  ).toString("base64url");
  return (
    payload +
    "." +
    createHmac("sha256", process.env.ADMIN_SESSION_SECRET!)
      .update(payload)
      .digest("hex")
  );
}
export function validSession(
  token: string | undefined,
  now = Date.now(),
  passwordHash = process.env.ADMIN_PASSWORD_HASH,
) {
  if (!adminConfigured(passwordHash) || !token || token.length > 2048)
    return false;
  const [payload, signature, ...extra] = token.split(".");
  if (extra.length || !payload || !/^[a-f0-9]{64}$/.test(signature || ""))
    return false;
  const expected = createHmac("sha256", process.env.ADMIN_SESSION_SECRET!)
    .update(payload)
    .digest();
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) return false;
  try {
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return (
      typeof value.exp === "number" &&
      value.exp > now &&
      value.credential === fingerprint(passwordHash)
    );
  } catch {
    return false;
  }
}
