import crypto from "node:crypto";
import fs from "node:fs";

const file = new URL("../.env.local", import.meta.url);
if (fs.existsSync(file)) {
  console.log(".env.local ມີຢູ່ແລ້ວ — ບໍ່ສ້າງທັບ (key ເກົ່າຍັງໃຊ້ຢູ່)");
  process.exit(0);
}

const rand = (n) => crypto.randomBytes(n).toString("base64url");
const content = `# ⚠️ ລະຫັດລັບ — ຫ້າມ commit, ຫ້າມແບ່ງປັນ. BACKUP ENCRYPTION_KEY ໄວ້ບ່ອນປອດໄພ:
# ຖ້າ key ນີ້ເສຍ ຂໍ້ມູນເງິນເດືອນທີ່ encrypt ໄວ້ທັງໝົດຈະເປີດອ່ານບໍ່ໄດ້ອີກ.

# Postgres (ເວລາ run ໃນ Docker, docker-compose ຈະແທນ host ເປັນ "db" ເອງ)
DATABASE_URL=postgres://payslip:payslip_dev@localhost:5433/payslip

# key 32 bytes (base64) ສຳລັບ encrypt ຂໍ້ມູນພະນັກງານ
ENCRYPTION_KEY=${crypto.randomBytes(32).toString("base64")}

# ລະຫັດຜ່ານເລີ່ມຕົ້ນຂອງ admin (ໃຊ້ຄັ້ງດຽວຕອນສ້າງ admin; ຈະຖືກບັງຄັບໃຫ້ປ່ຽນຕອນ login ຄັ້ງທຳອິດ)
INITIAL_ADMIN_PASSWORD=${rand(12)}
`;
fs.writeFileSync(file, content, { mode: 0o600 });
console.log("✓ ສ້າງ .env.local ແລ້ວ");
console.log("  username: admin");
console.log("  password: ເບິ່ງ INITIAL_ADMIN_PASSWORD ໃນ .env.local");
