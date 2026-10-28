import nacl from "tweetnacl";
export const LICENSE_URL =
  "https://raw.githubusercontent.com/abdourasmy1/licenses/main/licenses.json";
export const GRACE_MS = 3 * 24 * 60 * 60 * 1000;
export type LicenseRecord = {
  license_id: string;
  device_id: string;
  license_type: "trial" | "paid";
  status: "active" | "revoked";
  start_date: string;
  end_date: string;
};
export type LicenseFile = {
  version: 1;
  issued_at: string;
  licenses: LicenseRecord[];
  signature: string;
};
export type LicenseState = {
  record: LicenseRecord | null;
  lastVerified: number;
  lastSeen: number;
  maxIssued: number;
  rejected: boolean;
};
export type LicenseDecision = {
  granted: boolean;
  code: string;
  record?: LicenseRecord;
  offline?: boolean;
};
export function canonical(value: any): string {
  if (value === null || typeof value === "boolean" || typeof value === "string")
    return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) throw new Error("INVALID_SCHEMA");
    return String(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  throw new Error("INVALID_SCHEMA");
}
export function strictTime(s: any): number {
  if (
    typeof s !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(s)
  )
    throw new Error("INVALID_DATE");
  const n = Date.parse(s);
  if (
    !Number.isFinite(n) ||
    new Date(n).toISOString().replace(".000", "") !== s
  )
    throw new Error("INVALID_DATE");
  return n;
}
const fromBase64 = (s: string) =>
  Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
export function verifyLicense(
  value: any,
  keys: readonly string[],
): LicenseFile {
  if (
    !value ||
    typeof value !== "object" ||
    value.version !== 1 ||
    !Array.isArray(value.licenses)
  )
    throw new Error("INVALID_SCHEMA");
  strictTime(value.issued_at);
  const seen = new Set<string>();
  for (const r of value.licenses) {
    if (!r || typeof r !== "object") throw new Error("INVALID_SCHEMA");
    for (const k of [
      "license_id",
      "device_id",
      "license_type",
      "status",
      "start_date",
      "end_date",
    ])
      if (typeof r[k] !== "string" || !r[k].trim())
        throw new Error("INVALID_SCHEMA");
    if (
      !["trial", "paid"].includes(r.license_type) ||
      !["active", "revoked"].includes(r.status) ||
      r.device_id.length > 128 ||
      seen.has(r.license_id)
    )
      throw new Error("INVALID_SCHEMA");
    seen.add(r.license_id);
    if (strictTime(r.end_date) <= strictTime(r.start_date))
      throw new Error("INVALID_DATE");
  }
  if (
    typeof value.signature !== "string" ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(value.signature)
  )
    throw new Error("INVALID_SIGNATURE");
  let signature: Uint8Array;
  try {
    signature = fromBase64(value.signature);
  } catch {
    throw new Error("INVALID_SIGNATURE");
  }
  if (signature.length !== 64) throw new Error("INVALID_SIGNATURE");
  const { signature: ignored, ...payload } = value;
  const message = new TextEncoder().encode(canonical(payload));
  if (
    !keys.some((k) => {
      try {
        const bytes = fromBase64(k);
        return (
          bytes.length === 32 &&
          nacl.sign.detached.verify(message, signature, bytes)
        );
      } catch {
        return false;
      }
    })
  )
    throw new Error("INVALID_SIGNATURE");
  return value;
}
export function onlineDecision(
  file: LicenseFile,
  deviceId: string,
  now: number,
  previous?: LicenseState,
): LicenseDecision {
  const issued = strictTime(file.issued_at);
  if (issued > now) return { granted: false, code: "CLOCK_ERROR" };
  if (previous && issued < previous.maxIssued)
    return { granted: false, code: "STALE_FILE" };
  const records = file.licenses.filter((r) => r.device_id.trim() === deviceId);
  const valid = records
    .filter(
      (r) =>
        r.status === "active" &&
        strictTime(r.start_date) <= now &&
        strictTime(r.end_date) > now,
    )
    .sort((a, b) => strictTime(b.end_date) - strictTime(a.end_date));
  if (valid[0]) return { granted: true, code: "VERIFIED", record: valid[0] };
  return {
    granted: false,
    code: records.some((r) => r.status === "revoked")
      ? "REVOKED"
      : records.some((r) => strictTime(r.start_date) > now)
        ? "NOT_YET_VALID"
        : records.length
          ? "EXPIRED"
          : "NOT_FOUND",
  };
}
export function offlineDecision(
  state: LicenseState | null,
  now: number,
): LicenseDecision {
  if (!state || state.rejected || !state.record)
    return { granted: false, code: "CONNECTION_FAILED" };
  if (now < state.lastSeen - 60000)
    return { granted: false, code: "CLOCK_ERROR" };
  if (
    now >= strictTime(state.record.end_date) ||
    now - state.lastVerified >= GRACE_MS
  )
    return { granted: false, code: "GRACE_EXPIRED" };
  if (now < strictTime(state.record.start_date))
    return { granted: false, code: "NOT_YET_VALID" };
  return {
    granted: true,
    code: "OFFLINE_GRACE",
    record: state.record,
    offline: true,
  };
}
