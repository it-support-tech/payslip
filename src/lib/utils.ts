import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(n: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(n || 0);
}

export function monthPeriod(offset = 0, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth() + offset, 1);
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export function periodKey(p: string) {
  const [m, y] = p.split("/").map(Number);
  return y * 100 + m;
}
