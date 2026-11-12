import crypto from "node:crypto";
import { HttpError, passwordProblem, type Role } from "./auth";
import { hashPassword } from "./crypto";
import { query } from "./db";

export interface UserView {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  mustChangePassword: boolean;
  lockedUntil: string | null;
  createdAt: string;
}

interface Row {
  id: string;
  username: string;
  display_name: string;
  role: Role;
  is_active: boolean;
  must_change_password: boolean;
  locked_until: Date | null;
  created_at: Date;
}

const toView = (r: Row): UserView => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  role: r.role,
  isActive: r.is_active,
  mustChangePassword: r.must_change_password,
  lockedUntil: r.locked_until && r.locked_until.getTime() > Date.now() ? r.locked_until.toISOString() : null,
  createdAt: r.created_at.toISOString(),
});

export const listUsers = async () => (await query<Row>("SELECT * FROM users ORDER BY created_at")).map(toView);

/** ລະຫັດຊົ່ວຄາວ (ອ່ານງ່າຍ ບໍ່ມີຕົວທີ່ສັບສົນ ເຊັ່ນ 0/O, 1/l) — ຜູ້ໃຊ້ຕ້ອງປ່ຽນຕອນ login */
export function tempPassword() {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const pick = (s: string) => s[crypto.randomInt(s.length)];
  const body = Array.from({ length: 8 }, () => pick(chars)).join("");
  return `${body}${pick(digits)}${pick(digits)}`;
}

export async function createUser(input: { username: string; displayName: string; role: Role; password?: string }) {
  const username = input.username.trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    throw new HttpError(400, "ຊື່ຜູ້ໃຊ້ຕ້ອງເປັນ a-z, 0-9, . _ - ຍາວ 3–32 ຕົວ");
  }
  if (!input.displayName.trim()) throw new HttpError(400, "ກະລຸນາໃສ່ຊື່ທີ່ສະແດງ");
  if (!["admin", "hr"].includes(input.role)) throw new HttpError(400, "ສິດບໍ່ຖືກຕ້ອງ");
  const password = input.password || tempPassword();
  const problem = passwordProblem(password, username);
  if (problem) throw new HttpError(400, problem);

  const [exists] = await query("SELECT 1 FROM users WHERE username = $1", [username]);
  if (exists) throw new HttpError(409, "ຊື່ຜູ້ໃຊ້ນີ້ມີແລ້ວ");

  const [r] = await query<Row>(
    `INSERT INTO users (username, display_name, password_hash, role, must_change_password)
     VALUES ($1, $2, $3, $4, true) RETURNING *`,
    [username, input.displayName.trim(), await hashPassword(password), input.role],
  );
  return { user: toView(r), tempPassword: password };
}

export async function updateUser(
  actorId: string,
  id: string,
  patch: { displayName?: string; role?: Role; isActive?: boolean; resetPassword?: boolean; unlock?: boolean },
) {
  const [target] = await query<Row>("SELECT * FROM users WHERE id = $1", [id]);
  if (!target) throw new HttpError(404, "ບໍ່ພົບຜູ້ໃຊ້");

  // ກັນບໍ່ໃຫ້ລະບົບບໍ່ເຫຼືອ admin ທີ່ໃຊ້ງານໄດ້
  const demoting = (patch.role && patch.role !== "admin") || patch.isActive === false;
  if (target.role === "admin" && demoting) {
    const [{ count }] = await query<{ count: string }>(
      "SELECT count(*) FROM users WHERE role = 'admin' AND is_active AND id <> $1",
      [id],
    );
    if (Number(count) === 0) throw new HttpError(400, "ຕ້ອງມີ admin ທີ່ໃຊ້ງານໄດ້ຢ່າງໜ້ອຍ 1 ຄົນ");
  }
  if (id === actorId && patch.isActive === false) throw new HttpError(400, "ປິດບັນຊີຕົນເອງບໍ່ໄດ້");

  let tempPw: string | undefined;
  if (patch.displayName !== undefined) {
    if (!patch.displayName.trim()) throw new HttpError(400, "ກະລຸນາໃສ່ຊື່ທີ່ສະແດງ");
    await query("UPDATE users SET display_name = $2, updated_at = now() WHERE id = $1", [id, patch.displayName.trim()]);
  }
  if (patch.role) {
    if (!["admin", "hr"].includes(patch.role)) throw new HttpError(400, "ສິດບໍ່ຖືກຕ້ອງ");
    await query("UPDATE users SET role = $2, updated_at = now() WHERE id = $1", [id, patch.role]);
  }
  if (patch.isActive !== undefined) {
    await query("UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1", [id, patch.isActive]);
    if (!patch.isActive) await query("DELETE FROM sessions WHERE user_id = $1", [id]);
  }
  if (patch.unlock) {
    await query("UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1", [id]);
  }
  if (patch.resetPassword) {
    tempPw = tempPassword();
    await query(
      `UPDATE users SET password_hash = $2, must_change_password = true, failed_attempts = 0,
         locked_until = NULL, updated_at = now() WHERE id = $1`,
      [id, await hashPassword(tempPw)],
    );
    await query("DELETE FROM sessions WHERE user_id = $1", [id]);
  }

  const [r] = await query<Row>("SELECT * FROM users WHERE id = $1", [id]);
  return { user: toView(r), tempPassword: tempPw };
}
