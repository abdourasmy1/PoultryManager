import * as SQLite from "expo-sqlite";
import type { Driver } from "./driver.types";
export async function openDriver(): Promise<Driver> {
  let db = SQLite.openDatabaseSync("poultry-manager.db");
  db.execSync("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  return {
    exec: (sql) => db.execSync(sql),
    run: (sql, params = []) => {
      db.runSync(sql, params);
    },
    all: <T>(sql: string, params: any[] = []): T[] =>
      db.getAllSync<T>(sql, params),
    persist: async () => {},
    export: () => db.serializeSync(),
    restore: (data) => {
      const temp = SQLite.deserializeDatabaseSync(data);
      const check = temp.getFirstSync<{ integrity_check: string }>(
        "PRAGMA integrity_check",
      );
      const version = temp.getFirstSync<{ user_version: number }>(
        "PRAGMA user_version",
      );
      if (check?.integrity_check !== "ok" || version?.user_version !== 1) {
        temp.closeSync();
        throw new Error("Invalid backup");
      }
      temp.getAllSync("SELECT id, kind, doc_no FROM documents LIMIT 1");
      SQLite.backupDatabaseSync({ sourceDatabase: temp, destDatabase: db });
      temp.closeSync();
    },
  };
}