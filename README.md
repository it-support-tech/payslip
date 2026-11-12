# NTP Payslip Sender

ນຳເຂົ້າ Excel → ສ້າງ PDF ໃບແຈ້ງເງິນເດືອນ → ສົ່ງໃຫ້ພະນັກງານຜ່ານ WhatsApp (`whatsapp-web.js`).
ຂໍ້ມູນພະນັກງານທຸກຢ່າງເກັບໃນ PostgreSQL ແບບ encrypt (AES-256-GCM).

## Dev (Docker — ຄຳສັ່ງດຽວ)

```bash
npm run setup          # ສ້າງ .env.local ພ້ອມ key ແບບສຸ່ມ (ຄັ້ງທຳອິດຄັ້ງດຽວ)
docker compose up      # Postgres + app → http://localhost:3000
```

- Postgres ຢູ່ port **5433** ຂອງເຄື່ອງ (5432 ໃຊ້ໂດຍ project ອື່ນ).
- Login ຄັ້ງທຳອິດ: `admin` / ຄ່າ `INITIAL_ADMIN_PASSWORD` ໃນ `.env.local` → ລະບົບບັງຄັບໃຫ້ປ່ຽນລະຫັດ.

ຫຼື run app ເທິງເຄື່ອງ (ໃຊ້ Docker ແຕ່ຖານຂໍ້ມູນ):

```bash
docker compose up -d db
npm run dev
```

## ລະຫັດລັບ (.env.local)

| ຕົວແປ | ໃຊ້ສຳລັບ |
|---|---|
| `DATABASE_URL` | ເຊື່ອມຕໍ່ Postgres |
| `ENCRYPTION_KEY` | encrypt ຂໍ້ມູນພະນັກງານ — **ຕ້ອງ backup**: ຖ້າເສຍ ຂໍ້ມູນເກົ່າເປີດອ່ານບໍ່ໄດ້ອີກ |
| `INITIAL_ADMIN_PASSWORD` | ລະຫັດ admin ຄັ້ງທຳອິດ (ໃຊ້ຕອນຍັງບໍ່ມີ user ເທົ່ານັ້ນ) |

ການຕັ້ງຄ່າອື່ນ (ຊື່ບໍລິສັດ, ໂລໂກ້, delay ການສົ່ງ) ຢູ່ `src/config.ts`.

## Deploy (manual)

1. ຕິດຕັ້ງ Node.js 20+ ແລະ PostgreSQL 15+ ເທິງ server, ສ້າງ database + user.
2. Copy project ໄປ server, ສ້າງ `.env.local` (copy ຈາກ dev ຫຼື `npm run setup` ແລ້ວແກ້ `DATABASE_URL`).
   ໃຊ້ `ENCRYPTION_KEY` ດຽວກັບທີ່ໃຊ້ encrypt ຂໍ້ມູນທີ່ມີຢູ່.
3. `npm ci && npm run build && npm start` (migration ຈະ run ເອງຕອນ start).
4. ໃຊ້ HTTPS (reverse proxy ເຊັ່ນ nginx) — cookie login ເປັນ `Secure` ໃນ production.
5. ຕ້ອງເປັນ server ທີ່ run ຕະຫຼອດ (ບໍ່ແມ່ນ serverless) ເພາະ WhatsApp ຕ້ອງເປີດ Chrome ຄ້າງໄວ້.
   ຢ່າລຶບໂຟນເດີ `.wwebjs_auth/` (session WhatsApp).

## ການເຮັດວຽກ

**ນຳເຂົ້າ:** ອັບໂຫລດ Excel → ກວດຜົນ (ໃໝ່ / ອັບເດດ / ສົ່ງແລ້ວ-ລັອກ / ຜິດ) → ກົດ "ນຳເຂົ້າ".
1 ໃບ = ງວດ + ລະຫັດພະນັກງານ. ນຳເຂົ້າໄຟລ໌ຊ້ຳໄດ້: ໃບທີ່ສົ່ງແລ້ວຈະບໍ່ຖືກແກ້.

**ສົ່ງ:** ກົດ "ສົ່ງ N ຄົນທີ່ຍັງບໍ່ໄດ້ຮັບ" — ສົ່ງສະເພາະໃບ ລໍຖ້າ/ລົ້ມເຫຼວ. ແຕ່ລະໃບຖືກ "ຈອງ" ໃນຖານຂໍ້ມູນກ່ອນສົ່ງ,
ຈຶ່ງບໍ່ສົ່ງຊ້ຳ ເຖິງແມ່ນກົດພ້ອມກັນຫຼາຍເຄື່ອງ.

**ຕິກ "ສົ່ງແລ້ວ":** ເອົາຕິກອອກ = ໃຫ້ສົ່ງຄືນໄດ້ (ເຊັ່ນ ສົ່ງຜິດ). ຕິກເອງ = ໝາຍວ່າສົ່ງແລ້ວໂດຍບໍ່ສົ່ງ.

**ລະບົບຢຸດກາງທາງ:** ໃບທີ່ຄ້າງ "ກຳລັງສົ່ງ" ຈະກາຍເປັນ "ລົ້ມເຫຼວ" ພ້ອມໝາຍເຫດ "ບໍ່ແນ່ໃຈວ່າໄປເຖິງບໍ່"
— ກວດໃນ WhatsApp ກ່ອນ ຖ້າໄດ້ຮັບແລ້ວໃຫ້ຕິກ "ສົ່ງແລ້ວ", ຖ້າບໍ່ ກົດສົ່ງໃໝ່.

**ຜູ້ໃຊ້:** admin ເພີ່ມ/ປິດບັນຊີ, reset ລະຫັດ (ລະຫັດຊົ່ວຄາວ, ບັງຄັບປ່ຽນຕອນ login). ທຸກຄົນປ່ຽນລະຫັດເອງໄດ້ທີ່ເມນູຊື່.
ໃສ່ລະຫັດຜິດ 5 ເທື່ອ → ລັອກ 15 ນາທີ. ທຸກການກະທຳສຳຄັນຖືກບັນທຶກໃນ `audit_logs`.

## ຖັນ Excel

| ຖັນ | ຊື່ຫົວຖັນທີ່ຮອງຮັບ |
|---|---|
| ຊື່ (ຕ້ອງມີ) | Name, ຊື່ |
| ເບີໂທ (ຕ້ອງມີ) | Phone, WhatsApp, ເບີໂທ |
| ລະຫັດ | Employee ID, ລະຫັດ |
| ເດືອນ | Month, ເດືອນ, ງວດ (ຖ້າບໍ່ມີ ໃຊ້ງວດທີ່ເລືອກຕອນນຳເຂົ້າ) |
| ເງິນ | Salary, Bonus, Allowance, OT, Tax, Social Security, Deduction |
| ອື່ນໆ | Position, Department |

ດາວໂຫລດ template ໄດ້ຈາກໜ້າເວັບ. ເບີ `020 5555 1234` ຖືກປ່ຽນເປັນ `8562055551234` ອັດຕະໂນມັດ.
