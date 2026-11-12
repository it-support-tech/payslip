import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { requireUser, route } from "@/lib/auth";
import { updateUser } from "@/lib/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** ແກ້ຊື່ / ສິດ / ເປີດ-ປິດບັນຊີ / ປົດລັອກ / reset ລະຫັດ (ສະເພາະ admin) */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const admin = await requireUser(req, { role: "admin" });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const patch = {
    displayName: typeof body.displayName === "string" ? body.displayName : undefined,
    role: body.role === "admin" || body.role === "hr" ? body.role : undefined,
    isActive: typeof body.isActive === "boolean" ? body.isActive : undefined,
    resetPassword: body.resetPassword === true,
    unlock: body.unlock === true,
  } as const;
  const result = await updateUser(admin.id, id, patch);
  await audit(admin.id, patch.resetPassword ? "password_reset" : "user_updated", {
    userId: id,
    ...patch,
  });
  return NextResponse.json(result);
});
