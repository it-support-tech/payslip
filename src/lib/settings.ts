import fs from "node:fs/promises";
import path from "node:path";
import { query } from "./db";
import { DEFAULT_MESSAGE_TEMPLATE } from "./message";

const MESSAGE_KEY = "message_template";

export async function getMessageTemplate(): Promise<string> {
  const [r] = await query<{ value: string }>("SELECT value FROM settings WHERE key = $1", [MESSAGE_KEY]);
  return r?.value || DEFAULT_MESSAGE_TEMPLATE;
}

export async function saveMessageTemplate(value: string, userId: string) {
  await query(
    `INSERT INTO settings (key, value, updated_by) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now()`,
    [MESSAGE_KEY, value, userId],
  );
}

export async function importLegacySettings() {
  const file = path.join(process.cwd(), "data", "settings.json");
  try {
    const { messageTemplate } = JSON.parse(await fs.readFile(file, "utf-8"));
    if (!messageTemplate) return;
    const rows = await query("INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING RETURNING key", [
      MESSAGE_KEY,
      messageTemplate,
    ]);
    if (rows.length) console.log("[settings] ຍ້າຍຂໍ້ຄວາມ WhatsApp ຈາກ data/settings.json ເຂົ້າຖານຂໍ້ມູນແລ້ວ");
  } catch {
  }
}
