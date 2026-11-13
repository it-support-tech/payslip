import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { audit } from "./audit";
import { hashPassword, randomToken, sha256, verifyPassword } from "./crypto";
import { BASE_PATH } from "./base-path";
import { query } from "./db";

export const SESSION_COOKIE = "ntp_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 ຊົ່ວໂມງ
const MAX_FAILED = 5;
const LOCK_MS = 1 * 60 * 1000; // ລັອກ 15 ນາທີ ຫຼັງໃສ່ຜິດ 5 ຄັ້ງ

export type Role = "admin" | "hr";

export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  mustChangePassword: boolean;
}

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  failed_attempts: number;
  locked_until: Date | null;
}

const toSessionUser = (u: UserRow): SessionUser => ({
  id: u.id,
  username: u.username,
  displayName: u.display_name,
  role: u.role,
  mustChangePassword: u.must_change_password,
});

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

/** ກົດລະບຽບລະຫັດຜ່ານ — ຄືນຂໍ້ຄວາມ error ຫຼື null ຖ້າຜ່ານ */
export function passwordProblem(password: string, username?: string): string | null {
  if (password.length < 8) return "ລະຫັດຜ່ານຕ້ອງມີຢ່າງໜ້ອຍ 8 ຕົວອັກສອນ";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) return "ລະຫັດຜ່ານຕ້ອງມີທັງຕົວອັກສອນ ແລະ ຕົວເລກ";
  if (username && password.toLowerCase().includes(username.toLowerCase())) return "ລະຫັດຜ່ານຫ້າມມີຊື່ຜູ້ໃຊ້ຢູ່ນຳ";
  return null;
}

// ໃຊ້ກວດລະຫັດຜ່ານຫຼອກ ເມື່ອບໍ່ພົບ user — ເພື່ອໃຫ້ເວລາຕອບເທົ່າກັນ (ບໍ່ບອກໃບ້ວ່າ username ມີຢູ່ບໍ່)
let dummyHash: Promise<string> | null = null;

export async function login(username: string, password: string): Promise<{ token: string; user: SessionUser }> {
  const name = username.trim().toLowerCase();
  const [u] = await query<UserRow>("SELECT * FROM users WHERE username = $1", [name]);

  if (!u) {
    await verifyPassword(password, await (dummyHash ??= hashPassword("dummy-password-1")));
    throw new HttpError(401, "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ");
  }
  if (!u.is_active) throw new HttpError(403, "ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ — ກະລຸນາຕິດຕໍ່ admin");
  if (u.locked_until && u.locked_until.getTime() > Date.now()) {
    const min = Math.ceil((u.locked_until.getTime() - Date.now()) / 60000);
    throw new HttpError(429, `ໃສ່ລະຫັດຜິດຫຼາຍເທື່ອ — ກະລຸນາລອງໃໝ່ໃນ ${min} ນາທີ`);
  }

  if (!(await verifyPassword(password, u.password_hash))) {
    const failed = u.failed_attempts + 1;
    const lock = failed >= MAX_FAILED ? new Date(Date.now() + LOCK_MS) : null;
    await query("UPDATE users SET failed_attempts = $2, locked_until = $3 WHERE id = $1", [
      u.id,
      lock ? 0 : failed,
      lock,
    ]);
    await audit(u.id, "login_failed", { locked: !!lock });
    throw new HttpError(
      401,
      lock ? "ໃສ່ລະຫັດຜິດ 5 ເທື່ອ — ບັນຊີຖືກລັອກ 15 ນາທີ" : "ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ",
    );
  }

  await query("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1", [u.id]);
  const token = await createSession(u.id);
  await audit(u.id, "login");
  return { token, user: toSessionUser(u) };
}

async function createSession(userId: string) {
  const token = randomToken();
  await query("DELETE FROM sessions WHERE expires_at < now()");
  await query("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)", [
    sha256(token),
    userId,
    new Date(Date.now() + SESSION_TTL_MS),
  ]);
  return token;
}

export function setSessionCookie(res: NextResponse, token: string) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: BASE_PATH || "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: BASE_PATH || "/", maxAge: 0 });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const [u] = await query<UserRow>(
    `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > now() AND u.is_active`,
    [sha256(token)],
  );
  return u ? toSessionUser(u) : null;
}

export async function destroySession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await query("DELETE FROM sessions WHERE token_hash = $1", [sha256(token)]);
}

interface RequireOpts {
  role?: Role;
  allowMustChange?: boolean;
}

export async function requireUser(req: Request, opts: RequireOpts = {}): Promise<SessionUser> {
  // ກັນ CSRF: request ທີ່ປ່ຽນຂໍ້ມູນຕ້ອງມາຈາກເວັບເຮົາເອງ
  if (req.method !== "GET" && req.method !== "HEAD") {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (origin && host && new URL(origin).host !== host) throw new HttpError(403, "Origin ບໍ່ຖືກຕ້ອງ");
  }
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "ກະລຸນາ login ກ່ອນ");
  if (user.mustChangePassword && !opts.allowMustChange) throw new HttpError(403, "ກະລຸນາປ່ຽນລະຫັດຜ່ານກ່ອນ");
  if (opts.role === "admin" && user.role !== "admin") throw new HttpError(403, "ສະເພາະ admin ເທົ່ານັ້ນ");
  return user;
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** ຫໍ່ route handler: ແປງ HttpError ເປັນ JSON response */
export function route<C = unknown>(fn: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof HttpError) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error(err);
      return NextResponse.json({ error: "ເກີດຂໍ້ຜິດພາດໃນລະບົບ — ກະລຸນາລອງໃໝ່ ຫຼື ຕິດຕໍ່ admin" }, { status: 500 });
    }
  };
}

export async function changePassword(user: SessionUser, current: string, next: string) {
  const [u] = await query<UserRow>("SELECT * FROM users WHERE id = $1", [user.id]);
  if (!u || !(await verifyPassword(current, u.password_hash))) throw new HttpError(400, "ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ");
  const problem = passwordProblem(next, u.username);
  if (problem) throw new HttpError(400, problem);
  if (await verifyPassword(next, u.password_hash)) throw new HttpError(400, "ລະຫັດຜ່ານໃໝ່ຕ້ອງບໍ່ຊ້ຳກັບອັນເກົ່າ");

  await query("UPDATE users SET password_hash = $2, must_change_password = false, updated_at = now() WHERE id = $1", [
    u.id,
    await hashPassword(next),
  ]);
  await query("DELETE FROM sessions WHERE user_id = $1", [u.id]);
  await audit(u.id, "password_changed");
  return createSession(u.id);
}

/** ສ້າງ admin ຄົນທຳອິດ ຖ້າຍັງບໍ່ມີ user ໃນລະບົບ */
export async function seedAdmin() {
  const [{ count }] = await query<{ count: string }>("SELECT count(*) FROM users");
  if (Number(count) > 0) return;
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!password) {
    console.warn("[auth] ບໍ່ມີ INITIAL_ADMIN_PASSWORD ໃນ .env.local — ຍັງບໍ່ສ້າງ admin");
    return;
  }
  await query(
    "INSERT INTO users (username, display_name, password_hash, role, must_change_password) VALUES ('admin', 'Administrator', $1, 'admin', true)",
    [await hashPassword(password)],
  );
}
