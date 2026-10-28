import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Platform,
  Linking,
  ActivityIndicator,
  AppState,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useApp } from "../lib/context";
import {
  checkLicense,
  licenseDeviceId,
  licenseMessage,
  loadLicenseState,
} from "../lib/license";
import { LicenseDecision, strictTime } from "../lib/license-core";
import { formatDate } from "../lib/domain";
import { t } from "../lib/ar";
import { Button, Card, Icon, Row, T } from "./ui";
const messages: Record<string, string> = {
  NOT_CONFIGURED: "لم يُضبط مفتاح توقيع الترخيص للإصدار الأصلي بعد.",
  VERIFIED: "الترخيص ساري وتم التحقق منه",
  OFFLINE_GRACE: "الترخيص ساري ضمن مهلة الاستخدام دون اتصال",
  NOT_FOUND: "لا يوجد ترخيص لهذا الجهاز",
  EXPIRED: "انتهت صلاحية الترخيص",
  REVOKED: "تم إيقاف الترخيص",
  NOT_YET_VALID: "لم تبدأ صلاحية الترخيص بعد",
  GRACE_EXPIRED: "انتهت مهلة الاستخدام دون اتصال",
  CLOCK_ERROR: "تحقق من تاريخ ووقت الجهاز ثم أعد المحاولة",
  STALE_FILE: "الخادم يعرض نسخة قديمة، أعد المحاولة بعد قليل",
  INVALID_SIGNATURE: "تعذّر التحقق من توقيع ملف الترخيص",
  TIMEOUT: "انتهت مهلة الاتصال، أعد المحاولة",
  CONNECTION_FAILED: "تعذّر الاتصال بخادم الترخيص",
  NOT_JSON: "استجابة الخادم ليست ملف ترخيص صالحاً",
  HTTP_ERROR: "تعذّر تحميل ملف الترخيص",
  ANDROID_REQUIRED: "الترخيص متاح في تطبيق Android فقط",
  INVALID_SCHEMA: "ملف الترخيص غير صالح",
};
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <Row style={{ justifyContent: "space-between", gap: 12 }}>
      <T style={{ fontSize: 12, color: "#6B7B70", flexShrink: 0 }}>{label}</T>
      <T number bold style={{ fontSize: 12, flex: 1, textAlign: "left" }}>
        {value}
      </T>
    </Row>
  );
}
export function LicenseContent({
  onDecision,
}: {
  onDecision?: (d: LicenseDecision) => void;
}) {
  const { theme, notify } = useApp();
  const [id, setId] = useState<string | null>(null);
  const [decision, setDecision] = useState<LicenseDecision | null>(null);
  const [stored, setStored] = useState<Awaited<ReturnType<typeof loadLicenseState>>>(null);
  const [busy, setBusy] = useState(false);
  const [linkFailed, setLinkFailed] = useState(false);
  const reload = async (runCheck = false) => {
    const device = await licenseDeviceId().catch(() => null);
    setId(device);
    setStored(await loadLicenseState());
    if (runCheck) {
      const result = await checkLicense();
      setDecision(result);
      onDecision?.(result);
      setStored(await loadLicenseState());
    }
  };
  const verify = async () => {
    setBusy(true);
    try {
      await reload(true);
    } catch {
      setDecision({ granted: false, code: "CONNECTION_FAILED" });
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    reload(Platform.OS === "android").catch(() => {});
  }, []);
  const request = async () => {
    try {
      await Linking.openURL(
        "https://wa.me/201028965962?text=" +
          encodeURIComponent(licenseMessage(id, decision || undefined)),
      );
    } catch {
      setLinkFailed(true);
    }
  };
  const remaining = useMemo(() => {
    const rec = decision?.record || stored?.record;
    if (!rec) return null;
    try {
      const ms = strictTime(rec.end_date) - Date.now();
      if (ms < 0) return 0;
      return Math.ceil(ms / 86400000);
    } catch {
      return null;
    }
  }, [decision?.record, stored?.record]);
  const lastVerified = stored?.lastVerified ? formatDate(stored.lastVerified) : null;
  const lastSeen = stored?.lastSeen ? formatDate(stored.lastSeen) : null;
  const record = decision?.record || stored?.record || null;
  return (
    <View style={{ gap: 20 }}>
      <View
        style={{
          width: 65,
          height: 65,
          alignSelf: "center",
          borderRadius: 21,
          backgroundColor: theme.primarySoft,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon name="key-outline" color={theme.primary} size={29} />
      </View>
      <T bold style={{ fontSize: 23, textAlign: "center" }}>
        {t("licenseTitle")}
      </T>
      {Platform.OS === "web" ? (
        <T style={{ color: theme.secondary, textAlign: "center" }}>
          {t("licenseWeb")}
        </T>
      ) : (
        <>
          <T
            style={{
              color: decision?.granted ? theme.primary : theme.amber,
              textAlign: "center",
            }}
          >
            {decision ? messages[decision.code] || t("error") : t("loading")}
          </T>
          <Card style={{ padding: 17, gap: 8 }}>
            <DetailRow label={t("licenseStatus")} value={decision?.granted ? t("paid") : decision ? t("unpaid") : t("pending")} />
            <DetailRow label={t("deviceId")} value={id || t("pending")} />
            <DetailRow label={t("licenseId")} value={record?.license_id || t("pending")} />
            <DetailRow label={t("startDate")} value={record?.start_date ? formatDate(strictTime(record.start_date)) : t("pending")} />
            <DetailRow label={t("endDate")} value={record?.end_date ? formatDate(strictTime(record.end_date)) : t("pending")} />
            <DetailRow label={t("remainingTime")} value={remaining === null ? t("pending") : remaining === 0 ? "0" : `${remaining} ${t("day")}`} />
            <DetailRow label={t("lastVerified")} value={lastVerified || t("pending")} />
            <DetailRow label={t("lastSeen")} value={lastSeen || t("pending")} />
          </Card>
          {id && (
            <Card style={{ padding: 17, gap: 8 }}>
              <T medium>{t("deviceId")}</T>
              <Row style={{ justifyContent: "space-between" }}>
                <T number bold style={{ fontSize: 18 }}>
                  {id}
                </T>
                <Button
                  small
                  variant="outline"
                  label={t("copy")}
                  icon="copy-outline"
                  onPress={async () => {
                    await Clipboard.setStringAsync(id);
                    notify(t("copied"));
                  }}
                />
              </Row>
            </Card>
          )}
          <Button
            label={t("checkLicense")}
            icon="refresh"
            onPress={verify}
            loading={busy}
          />
        </>
      )}
      <Button
        label={t("requestLicense")}
        icon="logo-whatsapp"
        onPress={request}
        variant="soft"
      />
      {linkFailed && (
        <Card style={{ padding: 18, gap: 12 }}>
          <T number>+20 102 896 5962</T>
          <Button
            label={t("copy")}
            icon="copy-outline"
            onPress={async () => {
              await Clipboard.setStringAsync(
                licenseMessage(id, decision || undefined),
              );
              notify(t("copied"));
            }}
          />
        </Card>
      )}
      <T style={{ fontSize: 11, color: theme.muted, textAlign: "center" }}>
        {t("licenseDataSafe")}
      </T>
    </View>
  );
}
export function LicenseGate({ children }: { children: React.ReactNode }) {
  const { theme } = useApp();
  const [decision, setDecision] = useState<LicenseDecision | null>(null);
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const subscription = AppState.addEventListener("change", async (state) => {
      if (state === "active") {
        const next = await checkLicense();
        setDecision(next);
      }
    });
    return () => subscription.remove();
  }, []);
  if (Platform.OS !== "android" || decision?.granted) return <>{children}</>;
  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        backgroundColor: theme.bg,
      }}
    >
      <Card style={{ padding: 27, maxWidth: 500, width: "100%" }}>
        <LicenseContent onDecision={setDecision} />
      </Card>
    </View>
  );
}
