// ການຕັ້ງຄ່າຂອງລະບົບ (ແທນ .env) — ແກ້ໄຂຢູ່ບ່ອນນີ້ບ່ອນດຽວ
export const COMPANY = {
  name: "ບໍລິສັດ ເອັນທີພີ ການຄ້ານ້ຳມັນເຊື້ອໄຟ ຈຳກັດ",
  shortName: "NTP",
  address: "ນະຄອນຫຼວງວຽງຈັນ, ສປປ ລາວ",
  currency: "ກີບ",
  // ໂລໂກ້ (ໃຊ້ທັງໜ້າເວັບ ແລະ PDF)
  logo: "public/logo.png",
};

// ໄລຍະຫ່າງລະຫວ່າງການສົ່ງແຕ່ລະຄົນ (ms) ເພື່ອປ້ອງກັນ Spam Block
export const SEND_DELAY = { minMs: 4000, maxMs: 5000 };

// ສີ theme NTP (ອີງຕາມໂລໂກ້)
export const NTP_COLORS = {
  blue950: "#0a2545",
  blue900: "#0e3a66",
  blue700: "#0a5296",
  blue600: "#0b65b5",
  blue500: "#1a7dcc",
  blue100: "#d6eafa",
  blue50: "#eef6fd",
  flameYellow: "#ffd23a",
  flameOrange: "#f7741f",
  flameRed: "#e63a1e",
};
