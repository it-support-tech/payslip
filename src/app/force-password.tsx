"use client";

import { PasswordForm } from "@/components/password-form";
import { COMPANY } from "@/config";
import { BASE_PATH } from "@/lib/base-path";

export function ForcePasswordChange() {
  const logout = async () => {
    await fetch(`${BASE_PATH}/api/auth/logout`, { method: "POST" });
    window.location.assign(`${BASE_PATH}/login`);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-ntp-950 via-ntp-800 to-ntp-600 p-6">
      <div className="animate-pop-in w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="h-1.5 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-300" />
        <div className="p-8">
          <div className="mb-6 flex items-center gap-3">
            <img src={`${BASE_PATH}/logo.png`} alt={COMPANY.shortName} className="h-12 w-12 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">ຕັ້ງລະຫັດຜ່ານໃໝ່</h1>
              <p className="text-sm text-slate-500">ສະບາຍດີ — ກະລຸນາປ່ຽນລະຫັດກ່ອນໃຊ້ງານ</p>
            </div>
          </div>
          <PasswordForm submitText="ບັນທຶກ ແລະ ເຂົ້າສູ່ລະບົບ" onDone={() => window.location.assign(`${BASE_PATH}/`)} />
          <button onClick={logout} className="mt-4 w-full text-center text-xs text-slate-400 hover:text-slate-600">
            ອອກຈາກລະບົບ
          </button>
        </div>
      </div>
    </main>
  );
}
