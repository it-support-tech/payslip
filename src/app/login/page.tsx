import { redirect } from "next/navigation";
import { COMPANY } from "@/config";
import { getSessionUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const FEATURES = [
  { icon: "🔒", title: "ຂໍ້ມູນຖືກເຂົ້າລະຫັດ", text: "ເງິນເດືອນ ແລະ ຂໍ້ມູນພະນັກງານ" },
  { icon: "💬", title: "ສົ່ງຜ່ານ WhatsApp", text: "ສົ່ງ PDF ໃຫ້ພະນັກງານແຕ່ລະຄົນອັດຕະໂນມັດ" },
];

export default async function LoginPage() {
  if (await getSessionUser().catch(() => null)) redirect("/");

  return (
    <main className="grid min-h-screen bg-white lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-gradient-to-br from-ntp-950 via-ntp-800 to-ntp-600 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -right-32 -top-32 h-96 w-96 rounded-full bg-flame-500/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-20 h-[28rem] w-[28rem] rounded-full bg-ntp-400/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-24 right-16 h-40 w-40 rounded-full bg-flame-300/20 blur-2xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)",
            backgroundSize: "28px 28px",
          }}
        />

        <div className="relative flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt={COMPANY.shortName} className="h-16 w-16 object-contain drop-shadow-xl" />
          <div>
            <p className="text-lg font-semibold">{COMPANY.name}</p>
            <p className="text-sm text-ntp-100">{COMPANY.address}</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-medium ring-1 ring-white/20">
            <span className="h-1.5 w-1.5 rounded-full bg-flame-300" />
            HR Payslip System
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight">
            ລະບົບສົ່ງ
            <br />
            <span className="bg-gradient-to-r from-flame-300 via-flame-400 to-flame-500 bg-clip-text text-transparent">
              ໃບແຈ້ງເງິນເດືອນ
            </span>
          </h1>
          <p className="mt-4 text-ntp-100">ນຳເຂົ້າ Excel, ສ້າງ PDF ແລະ ສົ່ງໃຫ້ພະນັກງານຜ່ານ WhatsApp ຢ່າງປອດໄພ</p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4 rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 backdrop-blur-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/10 text-lg">{f.icon}</span>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-ntp-100">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-ntp-200">© {new Date().getFullYear()} {COMPANY.name}</p>
      </section>

      <section className="relative flex flex-col items-center justify-center px-6 py-12">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-flame-600 via-flame-500 to-flame-300 lg:hidden" />
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center lg:hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={COMPANY.shortName} className="h-20 w-20 object-contain" />
            <p className="mt-3 text-sm font-medium text-slate-600">{COMPANY.name}</p>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">ຍິນດີຕ້ອນຮັບ 👋</h2>
          <p className="mb-8 mt-1.5 text-sm text-slate-500">ເຂົ້າສູ່ລະບົບເພື່ອຈັດການໃບແຈ້ງເງິນເດືອນ</p>

          <LoginForm />

          <p className="mt-8 text-center text-xs text-slate-400">
            ລືມລະຫັດຜ່ານ? ກະລຸນາຕິດຕໍ່ admin ເພື່ອ reset
          </p>
        </div>
      </section>
    </main>
  );
}
