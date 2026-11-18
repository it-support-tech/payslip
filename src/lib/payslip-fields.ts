export interface Employee {
  row: number;
  employeeId: string;
  name: string;
  position: string;
  department: string;
  bankAccount: string;
  bankAccountName: string;
  phone: string;
  socialSecurityNo: string;
  baseSalary: number;
  livingAllowance: number;
  lateMinutes: number;
  absentDays: number;
  workDaysPerMonth: number;
  actualWorkDays: number;
  lateDeduction: number;
  absentDeduction: number;
  trips: number;
  distanceKm: number;
  tripPay: number;
  positionPay: number;
  mealHolidayPay: number;
  economicRelief: number;
  hazardPay: number;
  provincialPay: number;
  otherIncome: number;
  bonus: number;
  tax: number;
  advanceLoan: number;
  forkliftDeposit: number;
  otherDeduction: number;
  socialSecurity: number;
  month: string;
  totalEarnings: number;
  totalDeductions: number;
  netPay: number;
  error?: string;
}

type KeysOfType<T> = { [K in keyof Employee]-?: Employee[K] extends T ? K : never }[keyof Employee];
export type TextKey = Exclude<KeysOfType<string>, "error">;
export type NumberKey = Exclude<KeysOfType<number>, "row">;

export const COLUMNS: { key: TextKey | NumberKey; header: string; type: "text" | "number"; width?: number }[] = [
  { key: "employeeId", header: "ລະຫັດ", type: "text", width: 12 },
  { key: "name", header: "ຊື່ ແລະ ນາມສະກຸນ", type: "text", width: 22 },
  { key: "position", header: "ຕໍາແໜ່ງ", type: "text", width: 18 },
  { key: "department", header: "ພະແນກ", type: "text", width: 14 },
  { key: "bankAccount", header: "ເລກບັນຊີ", type: "text", width: 18 },
  { key: "bankAccountName", header: "ຊື່ບັນຊີ", type: "text", width: 18 },
  { key: "phone", header: "ເບີໂທລະສັບ", type: "text", width: 14 },
  { key: "socialSecurityNo", header: "ເລກບັດ\nປະກັນສັງຄົມ", type: "text", width: 14 },
  { key: "baseSalary", header: "ເງີນເດືອນພື້ນຖານ", type: "number" },
  { key: "livingAllowance", header: "ອຸດໜູນ\nຄ່າຄອງຊິບ", type: "number" },
  { key: "lateMinutes", header: "ມາຊ້າ\n(ນາທີ)", type: "number", width: 9 },
  { key: "absentDays", header: "ຂາດງານ\n(ວັນ)", type: "number", width: 9 },
  { key: "workDaysPerMonth", header: "ຈຳນວນວັນ\nເຮັດວຽກຕໍ່ເດືອນ", type: "number" },
  { key: "actualWorkDays", header: "ຈຳນວນວັນ\nເຮັດວຽກຕົວຈິງ", type: "number" },
  { key: "lateDeduction", header: "ຫັກເງິນມາຊ້າ", type: "number" },
  { key: "absentDeduction", header: "ຫັກເງິນຂາດງານ", type: "number" },
  { key: "trips", header: "ຈຳນວນຖ້ຽວ", type: "number", width: 10 },
  { key: "distanceKm", header: "ໄລຍະທາງ", type: "number", width: 10 },
  { key: "tripPay", header: "ລວມເງິນຖ້ຽວ", type: "number" },
  { key: "positionPay", header: "ເງີນຕຳແໜ່ງ", type: "number" },
  { key: "mealHolidayPay", header: "ເງີນອັດຕາກີນ\nແລະ ທຳງານວັນຢຸດ", type: "number" },
  { key: "economicRelief", header: "ເງິນຊ່ວຍສະຖານະການ\nເສດຖະກິດຊົ່ວຄາວ", type: "number" },
  { key: "hazardPay", header: "ເງີນທາດເບື່ອ", type: "number" },
  { key: "provincialPay", header: "ອັດຕາປະຈຳຕ່າງໆແຂວງ", type: "number" },
  { key: "otherIncome", header: "ເງິນໄດ້ອື່ນໆ", type: "number" },
  { key: "bonus", header: "ໂບນັດ", type: "number" },
  { key: "totalEarnings", header: "ລວມລາຍຮັບ", type: "number" },
  { key: "tax", header: "ຫັກອາກອນ\nເງິນເດືອນ", type: "number" },
  { key: "advanceLoan", header: "ຫັກເງີນ\nກູ້ຢືມລ່ວງໜ້າ", type: "number" },
  { key: "forkliftDeposit", header: "ຫັກເງີນຄໍ້າປະກັນ\nຂອງໂຊເຟີລົດ", type: "number" },
  { key: "otherDeduction", header: "ຫັກເງີນອື່ນໆ", type: "number" },
  { key: "socialSecurity", header: "ຫັກເງິນປະກັນສັງຄົມ", type: "number" },
  { key: "totalDeductions", header: "ລວມລາຍການຫັກ", type: "number" },
  { key: "netPay", header: "ລວມຮັບສຸດທິ", type: "number" },
  { key: "month", header: "ຮອບເດືອນຈ່າຍ", type: "text", width: 12 },
];

export const EARNINGS: [string, NumberKey][] = [
  ["ອັດຕາເງິນເດືອນພື້ນຖານ", "baseSalary"],
  ["ເງິນອຸດໜູນຄ່າຄອງຊີບ", "livingAllowance"],
  ["ເງິນຕຳແໜ່ງ", "positionPay"],
  ["ອັດຕາກິນ ແລະ ທຳງານວັນຢຸດ", "mealHolidayPay"],
  ["ເງິນທາດເບື່ອ", "hazardPay"],
  ["ເງິນປະຕິບັດງານຕ່າງແຂວງ", "provincialPay"],
  ["ເງິນຖ້ຽວຂົນສົ່ງ", "tripPay"],
  ["ອຸດໜູນເສດຖະກິດຊົ່ວຄາວ", "economicRelief"],
  ["ເງິນໄດ້ອື່ນໆ", "otherIncome"],
  ["ໂບນັດ", "bonus"],
];

export const DEDUCTIONS: [string, NumberKey][] = [
  ["ຫັກເງິນມາຊ້າ", "lateDeduction"],
  ["ຫັກເງິນຂາດງານ", "absentDeduction"],
  ["ຫັກອາກອນເງິນເດືອນ", "tax"],
  ["ຫັກປະກັນສັງຄົມ", "socialSecurity"],
  ["ຫັກເງິນກູ້ຢືມລ່ວງໜ້າ", "advanceLoan"],
  ["ຫັກເງິນຄ້ຳປະກັນ", "forkliftDeposit"],
  ["ຫັກເງິນອື່ນໆ", "otherDeduction"],
];
