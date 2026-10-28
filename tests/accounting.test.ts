import test from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import { Repository } from "../lib/repository";
import {
  lineTotal,
  parseDecimal,
  splitAmount,
  normalize,
  periodStart,
  weight,
  Item,
  DocInput,
} from "../lib/domain";
import type { Driver } from "../lib/driver.types";
async function setup() {
  const SQL = await initSqlJs();
  let db = new SQL.Database();
  const driver: Driver = {
    exec: (s) => {
      db.run(s);
    },
    run: (s, p = []) => {
      db.run(s, p);
    },
    all: <T>(s: string, p: any[] = []) => {
      const q = db.prepare(s);
      q.bind(p);
      const rows: T[] = [];
      while (q.step()) rows.push(q.getAsObject() as T);
      q.free();
      return rows;
    },
    persist: async () => {},
    export: () => db.export(),
    restore: (data) => {
      const next = new SQL.Database(data);
      const check = next.exec("PRAGMA integrity_check");
      if (check[0]?.values[0]?.[0] !== "ok") throw Error("invalid");
      next.exec("SELECT id FROM documents LIMIT 1");
      db = next;
    },
  };
  const repo = new Repository(driver);
  await repo.initialize();
  return repo;
}
const item = (
  kg: string,
  price: string,
  quantity: number,
  cages: number,
): Item => ({
  type_id: 1,
  quantity,
  cages,
  weight: parseDecimal(kg, 3),
  price: parseDecimal(price),
  total: 0,
  cogs: 0,
  transport: 0,
  other: 0,
});
async function parties(r: Repository) {
  await r.saveParty({
    id: "farm",
    kind: "supplier",
    name: "Farm A",
    phone: "",
    address: "",
    notes: "",
    opening: 0,
  });
  await r.saveParty({
    id: "ahmed",
    kind: "customer",
    name: "أحمد",
    phone: "01012345678",
    address: "",
    notes: "",
    opening: 0,
  });
}
const P1: DocInput = {
  id: "p1",
  kind: "purchase",
  party_id: "farm",
  occurred_at: new Date(2026, 9, 25, 12).getTime(),
  items: [item("1000", "50", 500, 25)],
  transport: 60000,
  other: 40000,
  paid: 2000000,
};
const S1: DocInput = {
  id: "s1",
  kind: "sale",
  party_id: "ahmed",
  occurred_at: new Date(2026, 9, 26, 12).getTime(),
  items: [item("400", "60", 200, 10)],
  paid: 1000000,
};
test("GS1 exact rounding and large integer multiplication", () => {
  assert.equal(
    lineTotal(parseDecimal("12.345", 3), parseDecimal("33.33")),
    41146,
  );
  assert.equal(
    lineTotal(parseDecimal("100000", 3), parseDecimal("1000")),
    10000000000,
  );
  assert.equal(parseDecimal("١٢٫٣٤"), 1234);
  assert.throws(() => parseDecimal("12.345"));
  assert.equal(weight(12345), "12.345");
  assert.equal(weight(1000000), "1000");
});
test("largest remainder, normalization, Saturday period", () => {
  assert.deepEqual(splitAmount(100, [1, 1, 1]), [34, 33, 33]);
  assert.equal(normalize(" أَحـمد "), "احمد");
  assert.equal(
    new Date(periodStart("week", new Date(2026, 9, 27))).getDay(),
    6,
  );
});
test("GS2–GS6 purchase, sale, expense, payment and edit remain coherent", async () => {
  const r = await setup();
  await parties(r);
  await r.saveDocument(structuredClone(P1));
  assert.equal(r.document("p1")!.total, 5000000);
  assert.equal(r.document("p1")!.paid, 2000000);
  assert.equal(r.party("farm")!.balance, -3000000);
  assert.equal(r.inventory()[0].pool, 5100000);
  assert.equal(r.inventory()[0].weight, 1000000);
  assert.equal(r.stats().purchases, 5100000);
  assert.equal(r.documents().length, 2);
  await r.saveDocument(structuredClone(S1));
  assert.equal(r.party("ahmed")!.balance, 1400000);
  assert.equal(r.document("s1")!.cogs, 2040000);
  assert.equal(r.inventory()[0].pool, 3060000);
  assert.equal(r.stats().profit, 360000);
  await r.saveDocument({
    id: "expense1",
    kind: "expense",
    occurred_at: Date.now(),
    amount: 30000,
    category: "عمالة",
  });
  assert.equal(r.stats().profit, 330000);
  await r.saveDocument({
    id: "receipt2",
    kind: "receipt",
    party_id: "ahmed",
    occurred_at: Date.now(),
    amount: 500000,
  });
  assert.equal(r.document("s1")!.paid, 1500000);
  assert.equal(r.party("ahmed")!.balance, 900000);
  await r.saveDocument({
    ...structuredClone(S1),
    items: [item("450", "60", 200, 10)],
    paid: 1500000,
  });
  assert.equal(r.document("s1")!.total, 2700000);
  assert.equal(r.document("s1")!.cogs, 2295000);
  assert.equal(r.inventory()[0].weight, 550000);
  assert.equal(r.inventory()[0].pool, 2805000);
  assert.equal(r.party("ahmed")!.balance, 1200000);
  assert.equal(r.stats().profit, 375000);
});
test("GS7 block oversell atomically; GS8 block purchase cancellation", async () => {
  const r = await setup();
  await parties(r);
  await r.saveDocument(structuredClone(P1));
  await r.saveDocument({
    ...structuredClone(S1),
    items: [item("450", "60", 200, 10)],
  });
  const count = r.documents().length;
  await assert.rejects(
    () =>
      r.saveDocument({
        ...structuredClone(S1),
        id: "oversell",
        items: [item("600", "60", 200, 10)],
      }),
    /المتاح/,
  );
  assert.equal(r.documents().length, count);
  assert.equal(r.inventory()[0].weight, 550000);
  await assert.rejects(() => r.cancelDocument("p1"), /المتاح/);
  assert.equal(r.document("p1")!.status, "active");
});
test("GS9 cancel sale and its invoice-created payment restores inventory and balance", async () => {
  const r = await setup();
  await parties(r);
  await r.saveDocument(structuredClone(P1));
  await r.saveDocument(structuredClone(S1));
  await r.cancelDocument("s1");
  assert.equal(r.party("ahmed")!.balance, 0);
  assert.equal(r.inventory()[0].weight, 1000000);
  assert.equal(r.stats().profit, 0);
});
test("GS10 supplier payment allocates on oldest invoice", async () => {
  const r = await setup();
  await parties(r);
  await r.saveDocument(structuredClone(P1));
  await r.saveDocument({
    id: "supplier-pay",
    kind: "voucher",
    party_id: "farm",
    occurred_at: Date.now(),
    amount: 1000000,
  });
  assert.equal(r.document("p1")!.paid, 3000000);
  assert.equal(r.party("farm")!.balance, -2000000);
});
test("GS12 allocation pays opening balance before invoices", async () => {
  const r = await setup();
  await parties(r);
  await r.saveParty({
    id: "ahmed",
    kind: "customer",
    name: "أحمد",
    phone: "",
    address: "",
    notes: "",
    opening: 100000,
  });
  await r.saveDocument(structuredClone(P1));
  await r.saveDocument({
    ...structuredClone(S1),
    items: [item("100", "20", 20, 1)],
    paid: 0,
  });
  await r.saveDocument({
    ...structuredClone(S1),
    id: "s2",
    occurred_at: S1.occurred_at + 10000,
    items: [item("100", "30", 20, 1)],
    paid: 0,
  });
  await r.saveDocument({
    id: "receipt",
    kind: "receipt",
    party_id: "ahmed",
    occurred_at: Date.now(),
    amount: 250000,
  });
  assert.equal(r.document("s1")!.paid, 150000);
  assert.equal(r.document("s2")!.paid, 0);
  assert.equal(r.party("ahmed")!.balance, 350000);
});
test("GS13 backdated purchases replay average cost", async () => {
  const r = await setup();
  await parties(r);
  await r.saveDocument({ ...structuredClone(P1), transport: 0, other: 0 });
  await r.saveDocument({
    ...structuredClone(S1),
    occurred_at: S1.occurred_at + 86400000,
  });
  assert.equal(r.document("s1")!.cogs, 2000000);
  await r.saveDocument({
    ...structuredClone(P1),
    id: "p2",
    occurred_at: S1.occurred_at,
    items: [item("1000", "70", 500, 25)],
    transport: 0,
    other: 0,
    paid: 0,
  });
  assert.equal(r.document("s1")!.cogs, 2400000);
  assert.equal(r.inventory()[0].pool, 9600000);
});
test("GS14 same document uuid does not duplicate documents/payments; GS15 backup roundtrip", async () => {
  const r = await setup();
  await parties(r);
  await r.saveDocument(structuredClone(P1));
  await r.saveDocument(structuredClone(P1));
  assert.equal(r.documents().length, 2);
  await r.saveDocument(structuredClone(S1));
  const bytes = r.db.export();
  const snapshot = r.stats();
  await r.saveDocument({
    id: "exp",
    kind: "expense",
    occurred_at: Date.now(),
    amount: 100,
  });
  await r.restore(bytes);
  assert.deepEqual(r.stats(), snapshot);
  await assert.rejects(() => r.restore(new Uint8Array([1, 2, 3])));
  assert.deepEqual(r.stats(), snapshot);
  await r.saveDocument({
    ...structuredClone(S1),
    id: "s2",
    items: [item("10", "60", 5, 0)],
    paid: 0,
  });
  assert.equal(r.document("s2")!.doc_no, "S-000002");
});
test("GS16 normalized party and document search; GS17 walk-in payment validation", async () => {
  const r = await setup();
  await parties(r);
  assert.equal(r.parties("customer", "احمد")[0].name, "أحمد");
  assert.equal(r.parties("customer", "1234")[0].name, "أحمد");
  await r.saveDocument(structuredClone(P1));
  await r.saveDocument(structuredClone(S1));
  assert.equal(r.documents({ query: "S-000001" })[0].id, "s1");
  await assert.rejects(
    () =>
      r.saveDocument({
        ...structuredClone(S1),
        id: "cash-sale",
        party_id: "walk-in",
        paid: 0,
      }),
    /النقدي/,
  );
});
