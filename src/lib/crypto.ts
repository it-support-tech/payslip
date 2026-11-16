import crypto from "node:crypto";

const VERSION = "v1";

let cachedKey: Buffer | null = null;
function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error("ບໍ່ພົບ ENCRYPTION_KEY ໃນ .env.local — run: npm run setup");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY ຕ້ອງເປັນ 32 bytes (base64)");
  return (cachedKey = key);
}

const subKeys = new Map<string, Buffer>();
function subKey(purpose: string): Buffer {
  let k = subKeys.get(purpose);
  if (!k) {
    k = Buffer.from(crypto.hkdfSync("sha256", masterKey(), Buffer.alloc(0), purpose, 32));
    subKeys.set(purpose, k);
  }
  return k;
}

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", subKey("data-encryption"), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [version, iv, tag, ct] = payload.split(".");
  if (version !== VERSION) throw new Error("ຮູບແບບຂໍ້ມູນ encrypt ບໍ່ຮູ້ຈັກ");
  const decipher = crypto.createDecipheriv("aes-256-gcm", subKey("data-encryption"), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

export const encryptJson = (v: unknown) => encrypt(JSON.stringify(v));
export const decryptJson = <T>(payload: string): T => JSON.parse(decrypt(payload)) as T;

export const blindIndex = (value: string) =>
  crypto.createHmac("sha256", subKey("blind-index")).update(value).digest("base64url");

export const sha256 = (v: string) => crypto.createHash("sha256").update(v).digest("base64url");
export const randomToken = () => crypto.randomBytes(32).toString("base64url");

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, salt, 64, SCRYPT, (err, key) =>
      err ? reject(err) : resolve(["scrypt", salt.toString("base64url"), key.toString("base64url")].join("$")),
    ),
  );
}

export function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, salt, hash] = stored.split("$");
  if (algo !== "scrypt" || !salt || !hash) return Promise.resolve(false);
  const expected = Buffer.from(hash, "base64url");
  return new Promise((resolve, reject) =>
    crypto.scrypt(password, Buffer.from(salt, "base64url"), expected.length, SCRYPT, (err, key) =>
      err ? reject(err) : resolve(crypto.timingSafeEqual(key, expected)),
    ),
  );
}
