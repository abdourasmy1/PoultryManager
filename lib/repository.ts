import type { Driver } from "./driver.types";
import {
  DocInput,
  Document,
  Item,
  Kind,
  Party,
  PartyKind,
  Poultry,
  StockEvent,
  lineTotal,
  normalize,
  replay,
  splitAmount,
} from "./domain";
import { poultryNames, expenseNames, t } from "./ar";
export const schema = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS counters (kind TEXT PRIMARY KEY, next_number INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS poultry_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, active INTEGER NOT NULL DEFAULT 1, sort_order INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS parties (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('customer','supplier')), name TEXT NOT NULL, normalized TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', address TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', opening INTEGER NOT NULL DEFAULT 0, walk_in INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(kind, normalized));
CREATE TABLE IF NOT EXISTS documents (id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('sale','purchase','receipt','voucher','expense')), doc_no TEXT UNIQUE NOT NULL, party_id TEXT REFERENCES parties(id), occurred_at INTEGER NOT NULL, total INTEGER NOT NULL CHECK(total>0), transport INTEGER NOT NULL DEFAULT 0, other INTEGER NOT NULL DEFAULT 0, payable INTEGER NOT NULL, category TEXT NOT NULL DEFAULT '', notes TEXT NOT NULL DEFAULT '', method TEXT NOT NULL DEFAULT 'نقدي', parent_id TEXT REFERENCES documents(id), charge_extras INTEGER NOT NULL DEFAULT 0, status TEXT NOT NULL DEFAULT 'active', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL REFERENCES documents(id), type_id INTEGER NOT NULL REFERENCES poultry_types(id), quantity INTEGER NOT NULL CHECK(quantity>0), cages INTEGER NOT NULL CHECK(cages>=0), weight INTEGER NOT NULL CHECK(weight>0), price INTEGER NOT NULL CHECK(price>0), total INTEGER NOT NULL, transport INTEGER NOT NULL DEFAULT 0, other INTEGER NOT NULL DEFAULT 0, cogs INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS allocations (payment_id TEXT NOT NULL REFERENCES documents(id), document_id TEXT REFERENCES documents(id), party_id TEXT NOT NULL REFERENCES parties(id), amount INTEGER NOT NULL CHECK(amount>0));
CREATE TABLE IF NOT EXISTS ledger (document_id TEXT PRIMARY KEY REFERENCES documents(id), party_id TEXT REFERENCES parties(id), effect INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS inventory (type_id INTEGER PRIMARY KEY REFERENCES poultry_types(id), quantity INTEGER NOT NULL, cages INTEGER NOT NULL, weight INTEGER NOT NULL, pool INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, entity_id TEXT NOT NULL, action TEXT NOT NULL, before_json TEXT, after_json TEXT, created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS docs_date ON documents(occurred_at DESC);
CREATE INDEX IF NOT EXISTS docs_kind_date ON documents(kind, occurred_at DESC);
CREATE INDEX IF NOT EXISTS docs_party ON documents(party_id, occurred_at);
CREATE INDEX IF NOT EXISTS items_doc ON items(document_id);
CREATE INDEX IF NOT EXISTS items_type ON items(type_id);
CREATE INDEX IF NOT EXISTS alloc_doc ON allocations(document_id);
CREATE INDEX IF NOT EXISTS ledger_party ON ledger(party_id);
PRAGMA user_version=1;`;
const prefix: Record<Kind, string> = {
  sale: "S",
  purchase: "P",
  receipt: "R",
  voucher: "V",
  expense: "E",
};
export class Repository {
  constructor(public db: Driver) {}
  private hasColumn(table: string, column: string): boolean {
    return this.db
      .all<{ name: string }>(`PRAGMA table_info(${table})`)
      .some((c) => c.name === column);
  }
  private migratePoultryTypes() {
    if (!this.hasColumn("poultry_types", "active")) {
      this.db.exec(
        "ALTER TABLE poultry_types ADD COLUMN active INTEGER NOT NULL DEFAULT 1",
      );
    }
    if (!this.hasColumn("poultry_types", "sort_order")) {
      this.db.exec(
        "ALTER TABLE poultry_types ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
      );
    }
    this.db.exec(
      "UPDATE poultry_types SET sort_order = id WHERE sort_order = 0 OR sort_order IS NULL",
    );
  }
  async initialize() {
    this.db.exec(schema);
    if (!this.db.all("SELECT id FROM poultry_types LIMIT 1").length)
      poultryNames.forEach((name) =>
        this.db.run("INSERT INTO poultry_types(name) VALUES (?)", [name]),
      );
    this.db.run(
      "INSERT OR IGNORE INTO parties(id,kind,name,normalized,walk_in,created_at,updated_at) VALUES (?,?,?,?,1,?,?)",
      [
        "walk-in",
        "customer",
        t("walkIn"),
        normalize(t("walkIn")),
        Date.now(),
        Date.now(),
      ],
    );
    Object.keys(prefix).forEach((kind) =>
      this.db.run("INSERT OR IGNORE INTO counters VALUES (?,1)", [kind]),
    );
    this.migratePoultryTypes();
    await this.db.persist();
  }
  settings(): Record<string, string> {
    return Object.fromEntries(
      this.db
        .all<{ key: string; value: string }>("SELECT * FROM settings")
        .map((r) => [r.key, r.value]),
    );
  }
  async setSettings(values: Record<string, string>) {
    await this.atomic(() =>
      Object.entries(values).forEach(([k, v]) =>
        this.db.run("INSERT OR REPLACE INTO settings VALUES (?,?)", [k, v]),
      ),
    );
  }
  async atomic(fn: () => void) {
    const before = this.db.export();
    this.db.exec("BEGIN TRANSACTION");
    try {
      fn();
      this.db.exec("COMMIT");
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
    try {
      await this.db.persist();
    } catch (e) {
      this.db.restore(before);
      throw e;
    }
  }
  parties(kind?: PartyKind, query = "", limit = 200): Party[] {
    const q = `%${normalize(query)}%`;
    return this.db.all<Party>(
      `SELECT p.*, p.opening + COALESCE((SELECT SUM(l.effect) FROM ledger l JOIN documents d ON d.id=l.document_id WHERE l.party_id=p.id AND d.status='active'),0) AS balance FROM parties p WHERE (?='' OR p.kind=?) AND (?='' OR p.normalized LIKE ? OR p.phone LIKE ? OR LOWER(p.id) LIKE ?) ORDER BY p.walk_in ASC, p.created_at DESC LIMIT ?`,
      [kind || "", kind || "", q, q, q, q, limit],
    );
  }
  party(id: string): Party | undefined {
    return this.db.all<Party>(
      `SELECT p.*, p.opening + COALESCE((SELECT SUM(l.effect) FROM ledger l JOIN documents d ON d.id=l.document_id WHERE l.party_id=p.id AND d.status='active'),0) AS balance FROM parties p WHERE p.id=? LIMIT 1`,
      [id],
    )[0];
  }
  async saveParty(p: Omit<Party, "balance" | "created_at" | "walk_in">) {
    if (!p.name.trim()) throw new Error(t("nameRequired"));
    const phone = p.phone.replace(/[\s\-()]/g, "");
    if (phone && !/^\+?\d{7,15}$/.test(phone))
      throw new Error(t("phoneInvalid"));
    const duplicate = this.db.all<{ id: string }>(
      "SELECT id FROM parties WHERE kind=? AND normalized=? AND id<>?",
      [p.kind, normalize(p.name), p.id],
    );
    if (duplicate.length) throw new Error(t("duplicate"));
    await this.atomic(() => {
      this.db.run(
        `INSERT INTO parties(id,kind,name,normalized,phone,address,notes,opening,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name,normalized=excluded.normalized,phone=excluded.phone,address=excluded.address,notes=excluded.notes,opening=excluded.opening,updated_at=excluded.updated_at`,
        [
          p.id,
          p.kind,
          p.name.trim(),
          normalize(p.name),
          phone,
          p.address,
          p.notes,
          p.opening,
          Date.now(),
          Date.now(),
        ],
      );
      this.allocate();
      this.audit(p.id, "party.save", null, p);
    });
  }
  inventory(activeOnly = false): Poultry[] {
    return this.db.all<Poultry>(
      "SELECT p.*,COALESCE(i.quantity,0) quantity,COALESCE(i.cages,0) cages,COALESCE(i.weight,0) weight,COALESCE(i.pool,0) pool FROM poultry_types p LEFT JOIN inventory i ON i.type_id=p.id WHERE (?=0 OR p.active=1) ORDER BY p.sort_order ASC, p.id ASC",
      [activeOnly ? 1 : 0],
    );
  }
  async addType(name: string) {
    const clean = name.trim();
    if (!clean) throw new Error(t("nameRequired"));
    if (this.inventory(false).some((p) => normalize(p.name) === normalize(clean)))
      throw new Error(t("duplicate"));
    await this.atomic(() => {
      const next =
        this.db
          .all<{ n: number }>(
            "SELECT COALESCE(MAX(sort_order),0)+1 n FROM poultry_types",
          )[0]?.n || 1;
      this.db.run(
        "INSERT INTO poultry_types(name,active,sort_order) VALUES (?,?,?)",
        [clean, 1, next],
      );
    });
  }
  async updateType(id: number, name: string) {
    const clean = name.trim();
    if (!clean) throw new Error(t("nameRequired"));
    if (
      this.inventory(false).some(
        (p) => p.id !== id && normalize(p.name) === normalize(clean),
      )
    )
      throw new Error(t("duplicate"));
    await this.atomic(() =>
      this.db.run("UPDATE poultry_types SET name=? WHERE id=?", [clean, id]),
    );
  }
  async setTypeActive(id: number, active: boolean) {
    await this.atomic(() =>
      this.db.run("UPDATE poultry_types SET active=? WHERE id=?", [
        active ? 1 : 0,
        id,
      ]),
    );
  }
  async moveType(id: number, direction: -1 | 1) {
    const types = this.inventory(false);
    const index = types.findIndex((t) => t.id === id);
    const next = types[index + direction];
    if (!next) return;
    await this.atomic(() => {
      const a = types[index];
      const b = next;
      this.db.run("UPDATE poultry_types SET sort_order=? WHERE id=?", [
        b.sort_order ?? b.id,
        a.id,
      ]);
      this.db.run("UPDATE poultry_types SET sort_order=? WHERE id=?", [
        a.sort_order ?? a.id,
        b.id,
      ]);
    });
  }
  async deleteType(id: number) {
    const used = this.db.all<{ n: number }>(
      "SELECT COUNT(*) n FROM items WHERE type_id=?",
      [id],
    )[0]?.n || 0;
    if (used > 0) throw new Error(t("typeInUse"));
    await this.atomic(() => this.db.run("DELETE FROM poultry_types WHERE id=?", [id]));
  }
  documents(
    opts: {
      kind?: Kind;
      partyId?: string;
      query?: string;
      start?: number;
      limit?: number;
      cancelled?: boolean;
    } = {},
  ): Document[] {
    const q = `%${normalize(opts.query || "")}%`;
    return this.db.all<Document>(
      `SELECT d.*,COALESCE(p.name,'') party_name, COALESCE((SELECT SUM(a.amount) FROM allocations a JOIN documents pay ON pay.id=a.payment_id WHERE a.document_id=d.id AND pay.status='active'),0) paid,COALESCE((SELECT SUM(i.cogs) FROM items i WHERE i.document_id=d.id),0) cogs FROM documents d LEFT JOIN parties p ON p.id=d.party_id WHERE (?='' OR d.kind=?) AND (?='' OR d.party_id=?) AND d.occurred_at>=? AND (d.status='active' OR ?=1) AND (?='%%' OR p.normalized LIKE ? OR LOWER(d.doc_no) LIKE ? OR d.notes LIKE ? OR d.category LIKE ?) ORDER BY d.occurred_at DESC,d.created_at DESC LIMIT ?`,
      [
        opts.kind || "",
        opts.kind || "",
        opts.partyId || "",
        opts.partyId || "",
        opts.start || 0,
        opts.cancelled ? 1 : 0,
        q,
        q,
        q,
        q,
        q,
        opts.limit || 50,
      ],
    );
  }
  document(id: string): Document | undefined {
    const doc = this.db.all<Document>(
      `SELECT d.*,COALESCE(p.name,'') party_name, COALESCE((SELECT SUM(amount) FROM allocations a JOIN documents pay ON pay.id=a.payment_id WHERE a.document_id=d.id AND pay.status='active'),0) paid, COALESCE((SELECT SUM(cogs) FROM items WHERE document_id=d.id),0) cogs FROM documents d LEFT JOIN parties p ON p.id=d.party_id WHERE d.id=?`,
      [id],
    )[0];
    if (doc)
      doc.items = this.db.all<Item>(
        "SELECT * FROM items WHERE document_id=? ORDER BY id",
        [id],
      );
    return doc;
  }
  nextNumber(kind: Kind): string {
    const n = this.db.all<{ next_number: number }>(
      "SELECT next_number FROM counters WHERE kind=?",
      [kind],
    )[0].next_number;
    this.db.run("UPDATE counters SET next_number=next_number+1 WHERE kind=?", [
      kind,
    ]);
    return `${prefix[kind]}-${String(n).padStart(6, "0")}`;
  }
  audit(id: string, action: string, before: any, after: any) {
    this.db.run(
      "INSERT INTO audit_log(entity_id,action,before_json,after_json,created_at) VALUES (?,?,?,?,?)",
      [
        id,
        action,
        before ? JSON.stringify(before) : null,
        after ? JSON.stringify(after) : null,
        Date.now(),
      ],
    );
  }
  async saveDocument(input: DocInput) {
    const old = this.document(input.id);
    const party = input.party_id ? this.party(input.party_id) : undefined;
    if (input.kind !== "expense" && !party) throw new Error(t("required"));
    if (
      (input.kind === "sale" || input.kind === "receipt") &&
      party?.kind !== "customer"
    )
      throw new Error(t("required"));
    if (
      (input.kind === "purchase" || input.kind === "voucher") &&
      party?.kind !== "supplier"
    )
      throw new Error(t("required"));
    const isInvoice = input.kind === "sale" || input.kind === "purchase";
    const items = input.items || [];
    if (isInvoice && !items.length) throw new Error(t("required"));
    items.forEach((i) => {
      if (
        ![i.quantity, i.cages, i.weight, i.price].every(Number.isSafeInteger) ||
        i.quantity < 1 ||
        i.weight < 1 ||
        i.price < 1 ||
        i.cages < 0 ||
        i.weight > 1000000000 ||
        i.price > 100000000
      )
        throw new Error(t("positive"));
      i.total = lineTotal(i.weight, i.price);
    });
    const total = isInvoice
      ? items.reduce((a, b) => a + b.total, 0)
      : input.amount || 0;
    if (!Number.isSafeInteger(total) || total <= 0 || total > 99999999999999)
      throw new Error(t("positive"));
    const transport = input.kind === "purchase" ? input.transport || 0 : 0;
    const other = input.kind === "purchase" ? input.other || 0 : 0;
    const payable = total + (input.charge_extras ? transport + other : 0);
    if ((input.paid || 0) > payable) throw new Error(t("overpaid"));
    if (party?.walk_in && input.kind === "sale" && input.paid !== total)
      throw new Error(t("cashMustPay"));
    if (old && payable < old.paid) throw new Error(t("overpaid"));
    if (old && old.status !== "active") throw new Error(t("cancelled"));
    await this.atomic(() => {
      const number = old?.doc_no || this.nextNumber(input.kind);
      this.db.run(
        `INSERT INTO documents(id,kind,doc_no,party_id,occurred_at,total,transport,other,payable,category,notes,method,charge_extras,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET party_id=excluded.party_id,occurred_at=excluded.occurred_at,total=excluded.total,transport=excluded.transport,other=excluded.other,payable=excluded.payable,category=excluded.category,notes=excluded.notes,method=excluded.method,charge_extras=excluded.charge_extras,updated_at=excluded.updated_at`,
        [
          input.id,
          input.kind,
          number,
          input.party_id || null,
          input.occurred_at,
          total,
          transport,
          other,
          payable,
          input.category || "",
          input.notes || "",
          input.method || t("cash"),
          input.charge_extras ? 1 : 0,
          Date.now(),
          Date.now(),
        ],
      );
      this.db.run("DELETE FROM items WHERE document_id=?", [input.id]);
      const transportParts = splitAmount(
        transport,
        items.map((i) => i.weight),
      );
      const otherParts = splitAmount(
        other,
        items.map((i) => i.weight),
      );
      items.forEach((i, n) =>
        this.db.run(
          "INSERT INTO items(document_id,type_id,quantity,cages,weight,price,total,transport,other) VALUES (?,?,?,?,?,?,?,?,?)",
          [
            input.id,
            i.type_id,
            i.quantity,
            i.cages,
            i.weight,
            i.price,
            i.total,
            transportParts[n],
            otherParts[n],
          ],
        ),
      );
      const effect =
        input.kind === "sale"
          ? payable
          : input.kind === "purchase"
            ? -payable
            : input.kind === "receipt"
              ? -total
              : input.kind === "voucher"
                ? total
                : 0;
      this.db.run("INSERT OR REPLACE INTO ledger VALUES (?,?,?)", [
        input.id,
        input.party_id || null,
        effect,
      ]);
      if (isInvoice && !old && (input.paid || 0) > 0) {
        const paymentKind: Kind = input.kind === "sale" ? "receipt" : "voucher";
        const paymentId = `${input.id}-payment`;
        const amount = input.paid!;
        this.db.run(
          "INSERT INTO documents(id,kind,doc_no,party_id,occurred_at,total,payable,method,parent_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
          [
            paymentId,
            paymentKind,
            this.nextNumber(paymentKind),
            input.party_id,
            input.occurred_at,
            amount,
            amount,
            input.method || t("cash"),
            input.id,
            Date.now(),
            Date.now(),
          ],
        );
        this.db.run("INSERT INTO ledger VALUES (?,?,?)", [
          paymentId,
          input.party_id,
          paymentKind === "receipt" ? -amount : amount,
        ]);
      }
      this.recalculate();
      this.allocate();
      this.audit(
        input.id,
        old ? "document.edit" : "document.create",
        old,
        input,
      );
    });
  }
  recalculate() {
    const events = this.db.all<StockEvent>(
      `SELECT i.*,d.id doc_id,d.kind,d.occurred_at FROM items i JOIN documents d ON d.id=i.document_id WHERE d.status='active'`,
    );
    const { stocks, costs } = replay(events);
    this.db.run("DELETE FROM inventory");
    stocks.forEach((s, id) =>
      this.db.run("INSERT INTO inventory VALUES (?,?,?,?,?)", [
        id,
        s.quantity,
        s.cages,
        s.weight,
        s.pool,
      ]),
    );
    costs.forEach((cost, id) =>
      this.db.run("UPDATE items SET cogs=? WHERE id=?", [cost, id]),
    );
  }
  allocate() {
    this.db.run("DELETE FROM allocations");
    const parties = this.db.all<Party>("SELECT * FROM parties");
    for (const p of parties) {
      const invoiceKind = p.kind === "customer" ? "sale" : "purchase";
      const payKind = p.kind === "customer" ? "receipt" : "voucher";
      const invoices = this.db.all<{ id: string; payable: number }>(
        "SELECT id,payable FROM documents WHERE party_id=? AND kind=? AND status='active' ORDER BY occurred_at,created_at",
        [p.id, invoiceKind],
      );
      const remaining = new Map(invoices.map((i) => [i.id, i.payable]));
      let opening =
        p.kind === "customer"
          ? Math.max(0, p.opening)
          : Math.max(0, -p.opening);
      const payments = this.db.all<Document>(
        "SELECT * FROM documents WHERE party_id=? AND kind=? AND status='active' ORDER BY CASE WHEN parent_id IS NOT NULL THEN 0 ELSE 1 END,occurred_at,created_at",
        [p.id, payKind],
      );
      const put = (pay: string, doc: string | null, amount: number) => {
        if (amount > 0)
          this.db.run("INSERT INTO allocations VALUES (?,?,?,?)", [
            pay,
            doc,
            p.id,
            amount,
          ]);
      };
      for (const pay of payments) {
        let left = pay.total;
        if (pay.parent_id && remaining.has(pay.parent_id)) {
          const n = Math.min(left, remaining.get(pay.parent_id)!);
          put(pay.id, pay.parent_id, n);
          remaining.set(pay.parent_id, remaining.get(pay.parent_id)! - n);
          left -= n;
        }
        if (!pay.parent_id && opening) {
          const n = Math.min(left, opening);
          put(pay.id, null, n);
          opening -= n;
          left -= n;
        }
        for (const inv of invoices) {
          const n = Math.min(left, remaining.get(inv.id)!);
          put(pay.id, inv.id, n);
          remaining.set(inv.id, remaining.get(inv.id)! - n);
          left -= n;
        }
      }
    }
  }
  async cancelDocument(id: string) {
    const old = this.document(id);
    if (!old) return;
    await this.atomic(() => {
      this.db.run(
        "UPDATE documents SET status='cancelled',updated_at=? WHERE id=? OR parent_id=?",
        [Date.now(), id, id],
      );
      this.recalculate();
      this.allocate();
      this.audit(id, "document.cancel", old, null);
    });
  }
  stats(start = 0) {
    const s = this.db.all<any>(
      `SELECT COALESCE(SUM(CASE WHEN kind='sale' THEN total ELSE 0 END),0) sales,COALESCE(SUM(CASE WHEN kind='purchase' THEN total+transport+other ELSE 0 END),0) purchases,COALESCE(SUM(CASE WHEN kind='expense' THEN total ELSE 0 END),0) expenses,COALESCE(SUM(CASE WHEN kind='sale' THEN 1 ELSE 0 END),0) saleCount,COALESCE(SUM(CASE WHEN kind='purchase' THEN 1 ELSE 0 END),0) purchaseCount,COUNT(*) count FROM documents WHERE status='active' AND occurred_at>=?`,
      [start],
    )[0];
    const cogs = this.db.all<{ n: number }>(
      `SELECT COALESCE(SUM(i.cogs),0) n FROM items i JOIN documents d ON d.id=i.document_id WHERE d.status='active' AND d.kind='sale' AND occurred_at>=?`,
      [start],
    )[0].n;
    const balances = this.db.all<any>(
      `SELECT p.kind,p.opening+COALESCE(SUM(CASE WHEN d.status='active' THEN l.effect ELSE 0 END),0) balance FROM parties p LEFT JOIN ledger l ON l.party_id=p.id LEFT JOIN documents d ON d.id=l.document_id GROUP BY p.id`,
    );
    return {
      ...s,
      cogs,
      profit: s.sales - cogs - s.expenses,
      customerDebts: balances
        .filter((p: any) => p.kind === "customer" && p.balance > 0)
        .reduce((a: number, p: any) => a + p.balance, 0),
      supplierDebts: balances
        .filter((p: any) => p.kind === "supplier" && p.balance < 0)
        .reduce((a: number, p: any) => a - p.balance, 0),
    };
  }
  chart() {
    return Array.from({ length: 7 }, (_, n) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - 6 + n);
      const end = new Date(d);
      end.setDate(end.getDate() + 1);
      const row = this.db.all<any>(
        `SELECT COALESCE(SUM(CASE WHEN kind='sale' THEN total ELSE 0 END),0) sales,COALESCE(SUM(CASE WHEN kind='purchase' THEN total+transport+other ELSE 0 END),0) purchases FROM documents WHERE status='active' AND occurred_at>=? AND occurred_at<?`,
        [d.getTime(), end.getTime()],
      )[0];
      return { ...row, date: d.getTime() };
    });
  }
  async restore(bytes: Uint8Array) {
    const before = this.db.export();
    try {
      this.db.restore(bytes);
      this.migratePoultryTypes();
      this.recalculate();
      this.allocate();
      await this.db.persist();
    } catch {
      this.db.restore(before);
      throw new Error(t("invalidBackup"));
    }
  }
}
export { expenseNames };
