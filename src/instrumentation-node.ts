import { seedAdmin } from "./lib/auth";
import { migrate } from "./lib/db";
import { recoverStuckSending } from "./lib/payslips";
import { importLegacySettings } from "./lib/settings";

try {
  await migrate();
  await seedAdmin();
  await importLegacySettings();
  await recoverStuckSending();
} catch (err) {
  console.error("[startup] ເຊື່ອມຕໍ່ຖານຂໍ້ມູນບໍ່ໄດ້ — ກວດ DATABASE_URL ແລະ ວ່າ Postgres run ຢູ່ບໍ່", err);
}
