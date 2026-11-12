import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireUser, route } from "@/lib/auth";
import { createUser, listUsers } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  await requireUser(req, { role: "admin" });
  return NextResponse.json({ users: await listUsers() });
});

/** ສ້າງຜູ້ໃຊ້ໃໝ່ — ຄືນລະຫັດຊົ່ວຄາວ ໃຫ້ admin ແຈ້ງຜູ້ໃຊ້ (ຈະຖືກບັງຄັບປ່ຽນຕອນ login) */
export const POST = route(async (req) => {
  const admin = await requireUser(req, { role: "admin" });
  const body = await req.json().catch(() => ({}));
  const result = await createUser({
    username: String(body.username ?? ""),
    displayName: String(body.displayName ?? ""),
    role: body.role === "admin" ? "admin" : "hr",
  });
  await audit(admin.id, "user_created", { userId: result.user.id, username: result.user.username, role: result.user.role });
  return NextResponse.json(result, { status: 201 });
});
