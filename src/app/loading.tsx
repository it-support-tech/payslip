import { COMPANY } from "@/config";
import { BASE_PATH } from "@/lib/base-path";

export default function Loading() {
  return (
    <main className="animate-fade-in fixed inset-0 z-50 grid place-items-center bg-gradient-to-br from-ntp-950 via-ntp-800 to-ntp-600">
      <div className="flex flex-col items-center gap-5 text-white">
        <div className="relative grid h-24 w-24 place-items-center">
          <span className="absolute inset-0 animate-ping rounded-full bg-white/10" />
          <span className="absolute inset-2 rounded-full bg-white/10 ring-1 ring-white/20" />
          <img src={`${BASE_PATH}/logo.png`} alt={COMPANY.shortName} className="relative h-14 w-14 object-contain drop-shadow-lg" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold">ລະບົບສົ່ງໃບແຈ້ງເງິນເດືອນ</p>
          <p className="mt-1 text-xs text-ntp-100">ກຳລັງໂຫລດ...</p>
        </div>
        <div className="h-1 w-44 overflow-hidden rounded-full bg-white/15">
          <div className="animate-loader h-full w-full origin-left rounded-full bg-gradient-to-r from-flame-600 via-flame-500 to-flame-300" />
        </div>
      </div>
    </main>
  );
}
