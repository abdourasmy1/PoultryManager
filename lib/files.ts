import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import * as DocumentPicker from "expo-document-picker";
import { Asset } from "expo-asset";
import { Repository } from "./repository";
import { Document, money, formatDate, weight } from "./domain";
import { t } from "./ar";
const escape = (s: any): string =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const backupPrefix = "poultry_backup";
const safetyPrefix = "poultry_restore";
function stamp(d = new Date()): string {
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}_${pad(d.getMilliseconds(), 3)}`;
}
export function backupFileName(kind = backupPrefix): string {
  return `${kind}_${stamp()}.sqlite`;
}
async function writeLocalBackup(name: string, contents: Uint8Array): Promise<string> {
  if (Platform.OS === "web") throw new Error("LOCAL_BACKUP_UNAVAILABLE");
  const dir = FileSystem.documentDirectory;
  if (!dir) throw new Error("LOCAL_BACKUP_UNAVAILABLE");
  const path = dir + name;
  let binary = "";
  contents.forEach((c) => (binary += String.fromCharCode(c)));
  await FileSystem.writeAsStringAsync(path, btoa(binary), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return path;
}
export async function saveFile(
  name: string,
  contents: string | Uint8Array,
  mime: string,
) {
  if (Platform.OS === "web") {
    const blob = new Blob(
      [
        typeof contents === "string"
          ? contents
          : new Uint8Array(contents).buffer,
      ],
      { type: mime },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } else {
    const path = FileSystem.documentDirectory + name;
    if (typeof contents === "string")
      await FileSystem.writeAsStringAsync(path, contents);
    else {
      let binary = "";
      contents.forEach((c) => (binary += String.fromCharCode(c)));
      await FileSystem.writeAsStringAsync(path, btoa(binary), {
        encoding: FileSystem.EncodingType.Base64,
      });
    }
    await Sharing.shareAsync(path, {
      mimeType: mime,
      dialogTitle: t("export"),
    });
  }
}
export async function backup(repo: Repository) {
  const name = backupFileName(backupPrefix);
  const bytes = repo.db.export();
  if (Platform.OS === "web") {
    await saveFile(name, bytes, "application/vnd.sqlite3");
  } else {
    const path = await writeLocalBackup(name, bytes);
    await Sharing.shareAsync(path, {
      mimeType: "application/vnd.sqlite3",
      dialogTitle: t("export"),
    });
  }
  await repo.setSettings({ last_backup: String(Date.now()) });
}
export async function pickBackup(): Promise<Uint8Array | null> {
  if (Platform.OS === "web")
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".sqlite,.db";
      input.onchange = async () => {
        const f = input.files?.[0];
        resolve(f ? new Uint8Array(await f.arrayBuffer()) : null);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  const result = await DocumentPicker.getDocumentAsync({
    type: "*/*",
    copyToCacheDirectory: true,
  });
  if (result.canceled) return null;
  const base = await FileSystem.readAsStringAsync(result.assets[0].uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return Uint8Array.from(atob(base), (c) => c.charCodeAt(0));
}
export async function listBackups() {
  if (Platform.OS === "web" || !FileSystem.documentDirectory) return [];
  const names = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
  const backups = names
    .filter((name) =>
      /^poultry_(?:backup|restore)_.*\.sqlite$/i.test(name),
    )
    .map((name) => ({ name, uri: FileSystem.documentDirectory! + name }))
    .map(async (entry) => {
      try {
        const info = await FileSystem.getInfoAsync(entry.uri);
        return {
          ...entry,
          size: info.exists && typeof info.size === "number" ? info.size : null,
          modified: info.exists && typeof info.modificationTime === "number" ? info.modificationTime * 1000 : null,
        };
      } catch {
        return { ...entry, size: null, modified: null };
      }
    });
  return Promise.all(backups).then((rows) =>
    rows.sort((a, b) => (b.modified || 0) - (a.modified || 0)),
  );
}
export async function readBackupBytes(uri: string): Promise<Uint8Array> {
  const base = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return Uint8Array.from(atob(base), (c) => c.charCodeAt(0));
}
export async function backupSafetyCopy(repo: Repository) {
  const name = backupFileName(safetyPrefix);
  const bytes = repo.db.export();
  if (Platform.OS === "web") return null;
  return writeLocalBackup(name, bytes);
}
export async function exportCsv(docs: Document[]) {
  const cell = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = [
    [
      t("document"),
      t("type"),
      t("date"),
      t("party"),
      t("total"),
      t("paidAmount"),
      t("remaining"),
    ],
    ...docs.map((d) => [
      d.doc_no,
      t(d.kind),
      formatDate(d.occurred_at),
      d.party_name,
      money(d.total),
      money(d.paid),
      money(d.payable - d.paid),
    ]),
  ];
  await saveFile(
    "poultry_report.csv",
    "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n"),
    "text/csv;charset=utf-8",
  );
}
async function printHtml(
  title: string,
  body: string,
  settings: Record<string, string>,
) {
  let font = "";
  if (Platform.OS !== "web") {
    const a = Asset.fromModule(require("../assets/fonts/Tajawal-Regular.ttf"));
    await a.downloadAsync();
    const base = await FileSystem.readAsStringAsync(a.localUri!, {
      encoding: FileSystem.EncodingType.Base64,
    });
    font = `@font-face{font-family:Arabic;src:url(data:font/ttf;base64,${base})}`;
  }
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)}</title><style>${font}*{box-sizing:border-box}body{font-family:Arabic,Tahoma,Arial,sans-serif;color:#20382b;padding:32px;line-height:1.8;direction:rtl;unicode-bidi:plaintext}h1{font-size:25px;margin:0}h2{font-size:20px;margin:0 0 8px}header{border-bottom:3px solid #216a50;padding-bottom:18px;margin-bottom:24px}.muted{color:#829087;font-size:12px}.meta{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-top:8px}table{width:100%;border-collapse:collapse;margin:18px 0 8px;table-layout:fixed}th,td{padding:10px 8px;text-align:right;border-bottom:1px solid #e2e9e5;vertical-align:top;word-break:break-word;overflow-wrap:anywhere}th{background:#edf4ee;font-size:12px}tfoot td{font-weight:bold;border-top:2px solid #c9d8cf}footer{margin-top:34px;border-top:1px solid #ddd;padding-top:15px}.total{font-size:18px;font-weight:bold}</style></head><body><header><h1>${escape(settings.business_name || t("appName"))}</h1><div class="meta"><div>${escape(settings.phone || "")}</div><div>${escape(settings.address || "")}</div></div><div class="muted">${formatDate(Date.now())}</div></header><h2>${escape(title)}</h2>${body}<footer class="muted">${escape(settings.footer || t("tagline"))}</footer></body></html>`;
  if (Platform.OS === "web") {
    const win = window.open("", "_blank");
    if (!win) throw new Error("يرجى السماح بفتح نافذة الطباعة");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  } else {
    const file = await Print.printToFileAsync({ html });
    await Sharing.shareAsync(file.uri, { mimeType: "application/pdf" });
  }
}
export async function printInvoice(repo: Repository, doc: Document) {
  const types = repo.inventory();
  const rows = (doc.items || [])
    .map(
      (i) =>
        `<tr><td>${escape(types.find((p) => p.id === i.type_id)?.name || t("poultry"))}</td><td>${i.quantity}</td><td>${weight(i.weight)}</td><td>${money(i.price)}</td><td>${money(i.total)}</td></tr>`,
    )
    .join("");
  await printHtml(
    `${t(doc.kind)} · ${doc.doc_no}`,
    `<div>${escape(doc.party_name)} · ${formatDate(doc.occurred_at)}</div>${rows ? `<table><thead><tr><th>${t("poultry")}</th><th>${t("quantity")}</th><th>${t("weight")}</th><th>${t("price")}</th><th>${t("total")}</th></tr></thead><tbody>${rows}</tbody></table>` : ""}<p class="total">${t("total")}: ${money(doc.total)} ${t("currency")}</p>${doc.kind === "purchase" ? `<p>${t("transport")}: ${money(doc.transport)} · ${t("otherCosts")}: ${money(doc.other)}</p>` : ""}<p>${t("paidAmount")}: ${money(doc.paid)} · ${t("remaining")}: ${money(doc.payable - doc.paid)}</p><p>${escape(doc.notes)}</p>${doc.status === "cancelled" ? `<h2>${t("cancelled")}</h2>` : ""}`,
    repo.settings(),
  );
}
export async function printReport(
  repo: Repository,
  docs: Document[],
  title = t("reports"),
) {
  await printHtml(
    title,
    `<table><thead><tr><th>${t("document")}</th><th>${t("date")}</th><th>${t("party")}</th><th>${t("type")}</th><th>${t("total")}</th></tr></thead><tbody>${docs.map((d) => `<tr><td>${escape(d.doc_no)}</td><td>${formatDate(d.occurred_at)}</td><td>${escape(d.party_name)}</td><td>${t(d.kind)}</td><td>${money(d.total)}</td></tr>`).join("")}</tbody></table>`,
    repo.settings(),
  );
}
