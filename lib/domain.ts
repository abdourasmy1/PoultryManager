export type Kind = "sale" | "purchase" | "receipt" | "voucher" | "expense";
export type PartyKind = "customer" | "supplier";
export interface Party {
  id: string;
  kind: PartyKind;
  name: string;
  phone: string;
  address: string;
  notes: string;
  opening: number;
  walk_in: number;
  balance: number;
  created_at: number;
}
export interface Poultry {
  id: number;
  name: string;
  quantity: number;
  cages: number;
  weight: number;
  pool: number;
  active?: number;
  sort_order?: number;
}
export interface Item {
  id?: number;
  type_id: number;
  quantity: number;
  cages: number;
  weight: number;
  price: number;
  total: number;
  transport: number;
  other: number;
  cogs: number;
}
export interface Document {
  id: string;
  kind: Kind;
  doc_no: string;
  party_id: string | null;
  party_name: string;
  occurred_at: number;
  total: number;
  transport: number;
  other: number;
  payable: number;
  paid: number;
  category: string;
  notes: string;
  method: string;
  parent_id: string | null;
  charge_extras: number;
  status: "active" | "cancelled";
  cogs: number;
  items?: Item[];
}
export interface DocInput {
  id: string;
  kind: Kind;
  party_id?: string;
  occurred_at: number;
  items?: Item[];
  amount?: number;
  transport?: number;
  other?: number;
  charge_extras?: boolean;
  paid?: number;
  category?: string;
  notes?: string;
  method?: string;
}
export interface StockEvent {
  id: number;
  doc_id: string;
  type_id: number;
  kind: "sale" | "purchase";
  occurred_at: number;
  quantity: number;
  cages: number;
  weight: number;
  total: number;
  transport: number;
  other: number;
}
export interface Stock {
  quantity: number;
  cages: number;
  weight: number;
  pool: number;
  poultry: number;
  transport: number;
  other: number;
}
export function western(s: string): string {
  return s
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776));
}
export function normalize(s: string): string {
  return western(s)
    .replace(/[\u064B-\u065F\u0670ـ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
export function parseDecimal(s: string, digits = 2): number {
  const val = western(s).trim().replace(/[٫,]/g, ".");
  if (!val) return 0;
  if (!new RegExp(`^\\d+(?:\\.\\d{0,${digits}})?$`).test(val))
    throw new Error("أدخل قيمة رقمية صحيحة");
  const [whole, fraction = ""] = val.split(".");
  const value =
    BigInt(whole) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, "0"));
  if (value > 99999999999999n) throw new Error("القيمة أكبر من الحد المسموح");
  return Number(value);
}
export const lineTotal = (weight: number, price: number) =>
  Number((BigInt(weight) * BigInt(price) + 500n) / 1000n);
export const roundedRatio = (amount: number, weight: number, total: number) =>
  total
    ? Number(
        (BigInt(amount) * BigInt(weight) + BigInt(Math.floor(total / 2))) /
          BigInt(total),
      )
    : 0;
export function splitAmount(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (!sum) return weights.map(() => 0);
  const parts = weights.map((w, index) => ({
    index,
    value: Number((BigInt(total) * BigInt(w)) / BigInt(sum)),
    remainder: (BigInt(total) * BigInt(w)) % BigInt(sum),
  }));
  let left = total - parts.reduce((n, p) => n + p.value, 0);
  [...parts]
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.index - b.index
        : a.remainder > b.remainder
          ? -1
          : 1,
    )
    .forEach((p) => {
      if (left > 0) {
        p.value++;
        left--;
      }
    });
  return parts.map((p) => p.value);
}
export function money(value: number, decimals = true): string {
  const n = Math.abs(Math.trunc(value));
  const whole = Math.floor(n / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return (
    (value < 0 ? "−" : "") +
    whole +
    (decimals ? "." + String(n % 100).padStart(2, "0") : "")
  );
}
export function decimalString(value: number, digits = 2): string {
  const pow = 10 ** digits;
  return `${Math.trunc(value / pow)}.${String(value % pow).padStart(digits, "0")}`;
}
export function weight(value: number): string {
  return (
    decimalString(value, 3)
      .replace(/\.?0+$/, "")
      .replace(/\.$/, "") || "0"
  );
}
export function replay(events: StockEvent[]): {
  stocks: Map<number, Stock>;
  costs: Map<number, number>;
} {
  const stocks = new Map<number, Stock>();
  const costs = new Map<number, number>();
  const ordered = [...events].sort(
    (a, b) =>
      a.occurred_at - b.occurred_at ||
      (a.kind === b.kind ? a.id - b.id : a.kind === "purchase" ? -1 : 1),
  );
  for (const e of ordered) {
    const s = stocks.get(e.type_id) || {
      quantity: 0,
      cages: 0,
      weight: 0,
      pool: 0,
      poultry: 0,
      transport: 0,
      other: 0,
    };
    if (e.kind === "purchase") {
      s.quantity += e.quantity;
      s.cages += e.cages;
      s.weight += e.weight;
      s.poultry += e.total;
      s.transport += e.transport;
      s.other += e.other;
    } else {
      if (e.weight > s.weight || e.quantity > s.quantity)
        throw new Error(
          `الكمية المطلوبة أكبر من المتاح بالمخزون (${weight(s.weight)} كجم)`,
        );
      const poultry = roundedRatio(s.poultry, e.weight, s.weight);
      const transport = roundedRatio(s.transport, e.weight, s.weight);
      const other = roundedRatio(s.other, e.weight, s.weight);
      costs.set(e.id, poultry + transport + other);
      s.quantity -= e.quantity;
      s.cages -= e.cages;
      s.weight -= e.weight;
      s.poultry -= poultry;
      s.transport -= transport;
      s.other -= other;
    }
    s.pool = s.poultry + s.transport + s.other;
    stocks.set(e.type_id, s);
  }
  return { stocks, costs };
}
export function periodStart(period: string, now = new Date()): number {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (period === "week")
    date.setDate(date.getDate() - ((date.getDay() + 1) % 7));
  else if (period === "month") date.setDate(1);
  else if (period === "allTime") return 0;
  return date.getTime();
}
export function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
export function inputDate(ts = Date.now()): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function parseDate(s: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
    throw new Error("أدخل التاريخ بصيغة سنة-شهر-يوم");
  const [y, m, d] = s.split("-").map(Number);
  const value = new Date(y, m - 1, d, 12);
  if (
    y < 2000 ||
    value.getFullYear() !== y ||
    value.getMonth() !== m - 1 ||
    value.getDate() !== d
  )
    throw new Error("التاريخ غير صالح");
  if (value.getTime() > Date.now() + 86400000)
    throw new Error("لا يمكن تسجيل تاريخ في المستقبل");
  return value.getTime();
}
