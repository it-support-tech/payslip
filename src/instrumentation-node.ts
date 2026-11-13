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
  console.error("[startup]", err);
}
