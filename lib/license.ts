import { Platform } from "react-native";
import * as Application from "expo-application";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import { LICENSE_PUBLIC_KEYS } from "./license-keys";
import {
  LICENSE_URL,
  LicenseDecision,
  LicenseState,
  offlineDecision,
  onlineDecision,
  strictTime,
  verifyLicense,
} from "./license-core";
const STORAGE = "poultry_license_v1";
export async function loadLicenseState(): Promise<LicenseState | null> {
  try {
    const json = await SecureStore.getItemAsync(STORAGE);
    return json ? (JSON.parse(json) as LicenseState) : null;
  } catch {
    return null;
  }
}
export async function licenseDeviceId(): Promise<string | null> {
  if (Platform.OS !== "android") return null;
  let raw: string | null = Application.getAndroidId();
  if (!raw || raw === "9774d56d682e549c") {
    raw = await SecureStore.getItemAsync("license_installation_id");
    if (!raw) {
      raw = Crypto.randomUUID();
      await SecureStore.setItemAsync("license_installation_id", raw);
    }
  }
  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    "poultry-manager|" + raw,
  );
  return "PM-" + hash.slice(0, 16).toUpperCase().match(/.{4}/g)!.join("-");
}
export async function checkLicense(): Promise<LicenseDecision> {
  if (!LICENSE_PUBLIC_KEYS.length)
    return { granted: false, code: "NOT_CONFIGURED" };
  const deviceId = await licenseDeviceId();
  if (!deviceId) return { granted: false, code: "ANDROID_REQUIRED" };
  const previous = await loadLicenseState();
  const now = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(LICENSE_URL, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error("HTTP_ERROR");
    const body = await response.text();
    if (body.length > 1000000) throw new Error("INVALID_SCHEMA");
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      throw new Error("NOT_JSON");
    }
    const file = verifyLicense(parsed, LICENSE_PUBLIC_KEYS);
    const decision = onlineDecision(file, deviceId, now, previous || undefined);
    if (decision.code === "STALE_FILE" || decision.code === "CLOCK_ERROR")
      return decision;
    await SecureStore.setItemAsync(
      STORAGE,
      JSON.stringify({
        record: decision.record || null,
        lastVerified: now,
        lastSeen: now,
        maxIssued: Math.max(
          previous?.maxIssued || 0,
          strictTime(file.issued_at),
        ),
        rejected: !decision.granted,
      } satisfies LicenseState),
    );
    return decision;
  } catch (e: any) {
    const fallback = offlineDecision(previous, now);
    if (fallback.granted) {
      await SecureStore.setItemAsync(
        STORAGE,
        JSON.stringify({ ...previous, lastSeen: now }),
      );
      return fallback;
    }
    return {
      ...fallback,
      code:
        fallback.code === "CLOCK_ERROR" || fallback.code === "GRACE_EXPIRED"
          ? fallback.code
          : e.name === "AbortError"
            ? "TIMEOUT"
            : e.message || "CONNECTION_FAILED",
    };
  } finally {
    clearTimeout(timer);
  }
}
export function licenseMessage(
  deviceId: string | null,
  decision?: LicenseDecision,
): string {
  return [
    "مرحباً، أود طلب ترخيص لتطبيق مدير الدواجن.",
    deviceId
      ? `معرّف الجهاز: ${deviceId}`
      : "أستخدم نسخة المتصفح وأرغب في تفعيل تطبيق Android.",
    decision?.record
      ? `رقم الترخيص: ${decision.record.license_id}`
      : "لا يوجد ترخيص ساري متاح.",
    decision?.record ? `نوع الترخيص: ${decision.record.license_type}` : "",
    decision?.record ? `بداية الصلاحية: ${decision.record.start_date}` : "",
    decision?.record ? `نهاية الصلاحية: ${decision.record.end_date}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
