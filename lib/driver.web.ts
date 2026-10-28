import initSqlJs, { Database } from "sql.js";
import type { Driver } from "./driver.types";
const KEY = "poultry-manager-sqlite-v1";
function encode(a: Uint8Array): string {
  let s = "";
  for (let i = 0; i < a.length; i += 8192)
    s += String.fromCharCode(...a.subarray(i, i + 8192));
  return btoa(s);
}
function decode(s: string): Uint8Array {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
export async function openDriver(): Promise<Driver> {
  const SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  const saved = localStorage.getItem(KEY);
  let db: Database = saved
    ? new SQL.Database(decode(saved))
    : new SQL.Database();
  db.run("PRAGMA foreign_keys=ON");
  return {
    exec: (sql) => {
      db.run(sql);
    },
    run: (sql, p = []) => {
      db.run(sql, p);
    },
    all: <T>(sql: string, p: any[] = []): T[] => {
      const stmt = db.prepare(sql);
      try {
        stmt.bind(p);
        const rows: T[] = [];
        while (stmt.step()) rows.push(stmt.getAsObject() as T);
        return rows;
      } finally {
        stmt.free();
      }
    },
    persist: async () => {
      localStorage.setItem(KEY, encode(db.export()));
    },
    export: () => db.export(),
    restore: (data) => {
      const next = new SQL.Database(data);
      try {
        const check = next.exec("PRAGMA integrity_check");
        if (check[0]?.values[0]?.[0] !== "ok")
          throw new Error("Invalid database");
        const version = next.exec("PRAGMA user_version");
        if (version[0]?.values[0]?.[0] !== 1)
          throw new Error("Invalid version");
        next.exec("SELECT id, kind, doc_no FROM documents LIMIT 1");
      } catch (e) {
        next.close();
        throw e;
      }
      db.close();
      db = next;
      db.run("PRAGMA foreign_keys=ON");
    },
  };
}
