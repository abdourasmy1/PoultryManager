import React, { useState } from "react";
import {
  View,
  Pressable,
  FlatList,
  useWindowDimensions,
  RefreshControl,
} from "react-native";
import { Image } from "expo-image";
import { useApp } from "../lib/context";
import { t, TextKey } from "../lib/ar";
import { formatDate, periodStart, weight } from "../lib/domain";
import {
  Button,
  Card,
  Empty,
  Icon,
  IconName,
  Money,
  Row,
  SectionHeading,
  T,
} from "../components/ui";
import { Transactions } from "../components/TransactionList";
import { exportCsv } from "../lib/files";
export function StatCard({
  title,
  value,
  icon,
  tone = "green",
  subtitle,
  onPress,
  weightValue,
}: {
  title: string;
  value: number;
  icon: IconName;
  tone?: "green" | "blue" | "amber" | "neutral";
  subtitle: string;
  onPress?: () => void;
  weightValue?: boolean;
}) {
  const { theme } = useApp();
  const bg =
    tone === "green"
      ? theme.primarySoft
      : tone === "blue"
        ? theme.blueSoft
        : tone === "amber"
          ? theme.amberSoft
          : theme.surface2;
  const color =
    tone === "green"
      ? theme.primary
      : tone === "blue"
        ? theme.blue
        : tone === "amber"
          ? theme.amber
          : theme.secondary;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={{ flex: 1, minWidth: 145 }}
    >
      <Card style={{ padding: 19, gap: 12, minHeight: 143 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <T medium style={{ fontSize: 13, color: theme.secondary }}>
            {title}
          </T>
          <View
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              backgroundColor: bg,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon name={icon} color={color} size={17} />
          </View>
        </Row>
        <Money
          value={value}
          size={28}
          color={tone === "green" ? theme.primary : theme.text}
        />
        <Row style={{ gap: 5 }}>
          <View
            style={{
              width: 5,
              height: 5,
              borderRadius: 3,
              backgroundColor: theme.muted,
              opacity: 0.6,
            }}
          />
          <T style={{ fontSize: 11, color: theme.muted }}>{subtitle}</T>
        </Row>
      </Card>
    </Pressable>
  );
}
function Chart() {
  const { repo, theme } = useApp();
  const data = repo!.chart();
  const hasData = data.some((d) => d.sales || d.purchases);
  const max = Math.max(
    10000,
    ...data.map((d) => Math.max(d.sales, d.purchases)),
  );
  const weekdays = [
    "الأحد",
    "الإثنين",
    "الثلاثاء",
    "الأربعاء",
    "الخميس",
    "الجمعة",
    "السبت",
  ];
  return (
    <Card style={{ padding: 21, flex: 1, minHeight: 280 }}>
      <SectionHeading
        title={t("financialActivity")}
        subtitle={t("last7days")}
      />
      <Row style={{ gap: 16, marginTop: 12 }}>
        {[
          { label: t("sales"), color: theme.primary },
          { label: t("purchases"), color: "#D9BF8B" },
        ].map((l) => (
          <Row key={l.label} style={{ gap: 6 }}>
            <View
              style={{
                width: 8,
                height: 8,
                backgroundColor: l.color,
                borderRadius: 2,
              }}
            />
            <T style={{ fontSize: 11, color: theme.secondary }}>{l.label}</T>
          </Row>
        ))}
      </Row>
      <View style={{ height: 158, marginTop: 15, marginLeft: 7 }}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              position: "absolute",
              top: i * 42,
              left: 0,
              right: 31,
              flexDirection: "row",
              borderTopWidth: 1,
              borderStyle: "dashed",
              borderColor: theme.border,
            }}
          />
        ))}
        <View
          style={{
            position: "absolute",
            right: 0,
            top: -8,
            bottom: 12,
            justifyContent: "space-between",
          }}
        >
          {[3, 2, 1, 0].map((n) => (
            <T key={n} number style={{ fontSize: 9, color: theme.muted }}>
              {hasData ? Math.round((max * n) / 300).toLocaleString() : "0"}
            </T>
          ))}
        </View>
        <Row
          style={{
            height: 150,
            paddingRight: 40,
            alignItems: "flex-end",
            justifyContent: "space-around",
          }}
        >
          {data.map((d, i) => (
            <View key={d.date} style={{ alignItems: "center", flex: 1 }}>
              <Row style={{ height: 122, alignItems: "flex-end", gap: 5 }}>
                <View
                  style={{
                    width: 12,
                    height: hasData ? Math.max(2, (d.sales / max) * 113) : 2,
                    borderRadius: 3,
                    backgroundColor: hasData ? theme.primary : "#DCE8DF",
                  }}
                />
                <View
                  style={{
                    width: 12,
                    height: hasData
                      ? Math.max(2, (d.purchases / max) * 113)
                      : 2,
                    borderRadius: 3,
                    backgroundColor: hasData ? "#D9BF8B" : "#E9E4D8",
                  }}
                />
              </Row>
              <T style={{ fontSize: 9, color: theme.muted, marginTop: 8 }}>
                {weekdays[new Date(d.date).getDay()]}
              </T>
            </View>
          ))}
        </Row>
        {!hasData && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              right: 30,
              top: 17,
              alignItems: "center",
              gap: 5,
            }}
          >
            <View
              style={{
                backgroundColor: theme.surface,
                paddingHorizontal: 18,
                alignItems: "center",
              }}
            >
              <Icon name="stats-chart-outline" size={25} color="#B1BFB4" />
              <T
                medium
                style={{ fontSize: 13, color: theme.secondary, marginTop: 8 }}
              >
                {t("noChart")}
              </T>
              <T style={{ fontSize: 10, color: theme.muted }}>
                {t("noChartHint")}
              </T>
            </View>
          </View>
        )}
      </View>
    </Card>
  );
}
export default function Dashboard() {
  const { theme, repo, settings, setPage, open, refresh, notify } = useApp();
  const width = useWindowDimensions().width;
  const wide = width >= 1050;
  const mobile = width < 700;
  const [period, setPeriod] = useState<TextKey>("month");
  const [showPeriod, setShowPeriod] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const stats = repo!.stats(periodStart(period));
  const stock = repo!.inventory();
  const docs = repo!.documents({ limit: 4 });
  const stockValue = stock.reduce((a, b) => a + b.pool, 0);
  const stockWeight = stock.reduce((a, b) => a + b.weight, 0);
  const birds = stock.reduce((a, b) => a + b.quantity, 0);
  const steps = [
    {
      label: t("stepBusiness"),
      done: !!settings.business_name,
      onPress: () => setPage("settings"),
    },
    {
      label: t("stepSupplier"),
      done: repo!.parties("supplier").length > 0,
      onPress: () => open({ type: "party", kind: "supplier" }),
    },
    {
      label: t("stepPurchase"),
      done: repo!.stats().purchaseCount > 0,
      onPress: () => open({ type: "invoice", kind: "purchase" }),
    },
  ];
  const progress = steps.filter((s) => s.done).length;
  const onRefresh = () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 400);
  };
  return (
    <FlatList
      data={[]}
      renderItem={() => null}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={theme.primary}
        />
      }
      contentContainerStyle={{ padding: mobile ? 18 : 29, paddingBottom: 28 }}
      ListHeaderComponent={
        <View style={{ gap: 23 }}>
          <Row
            style={{
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 15,
              flexWrap: "wrap",
            }}
          >
            <View style={{ flex: 1, minWidth: 220 }}>
              <Row style={{ gap: 9 }}>
                <T bold style={{ fontSize: mobile ? 25 : 29, lineHeight: 40 }}>
                  {t("greeting")}
                </T>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    backgroundColor: "#D8BA7A",
                    borderRadius: 4,
                    marginTop: 2,
                  }}
                />
              </Row>
              <T style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>
                {t("greetingSub")}
              </T>
            </View>
            <Row style={{ gap: 9, paddingTop: 4, zIndex: 10 }}>
              <View style={{ zIndex: 10 }}>
                <Button
                  variant="outline"
                  label={t(period)}
                  icon="calendar-outline"
                  small
                  onPress={() => setShowPeriod(!showPeriod)}
                  style={{ backgroundColor: theme.surface, minHeight: 39 }}
                />
                {showPeriod && (
                  <Card
                    style={{
                      position: "absolute",
                      top: 45,
                      right: 0,
                      width: 150,
                      padding: 5,
                      zIndex: 99,
                      shadowOpacity: 0.1,
                      shadowRadius: 15,
                      shadowColor: "#000",
                    }}
                  >
                    {(["today", "week", "month", "allTime"] as TextKey[]).map(
                      (p) => (
                        <Pressable
                          key={p}
                          onPress={() => {
                            setPeriod(p);
                            setShowPeriod(false);
                          }}
                          style={{
                            padding: 10,
                            backgroundColor:
                              period === p ? theme.primarySoft : "transparent",
                            borderRadius: 6,
                          }}
                        >
                          <T style={{ fontSize: 13 }}>{t(p)}</T>
                        </Pressable>
                      ),
                    )}
                  </Card>
                )}
              </View>
              <Button
                variant="outline"
                label={t("export")}
                icon="download-outline"
                small
                onPress={async () => {
                  try {
                    await exportCsv(
                      repo!.documents({
                        start: periodStart(period),
                        limit: 100000,
                      }),
                    );
                    notify(t("reportReady"));
                  } catch (e: any) {
                    notify(e.message);
                  }
                }}
                style={{ backgroundColor: theme.surface, minHeight: 39 }}
              />
            </Row>
          </Row>
          <View
            style={{ flexDirection: wide ? "row-reverse" : "column", gap: 18 }}
          >
            <View
              style={{
                flex: wide ? 2.12 : undefined,
                backgroundColor: theme.hero,
                borderRadius: 15,
                overflow: "hidden",
                minHeight: 207,
                position: "relative",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: -85,
                  top: -138,
                  width: 370,
                  height: 370,
                  borderWidth: 1,
                  borderColor: "#FFFFFF0B",
                  borderRadius: 185,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: -55,
                  top: -105,
                  width: 305,
                  height: 305,
                  borderWidth: 1,
                  borderColor: "#FFFFFF0B",
                  borderRadius: 160,
                }}
              />
              {!mobile && (
                <Image
                  source={require("../assets/images/overview.svg")}
                  contentFit="contain"
                  style={{
                    position: "absolute",
                    left: -13,
                    top: 0,
                    width: "46%",
                    height: 215,
                  }}
                />
              )}
              <View
                style={{
                  padding: 25,
                  alignItems: "flex-end",
                  paddingLeft: mobile ? 25 : "39%",
                }}
              >
                <Row style={{ gap: 6 }}>
                  <View
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 5,
                      backgroundColor: "#E1C88C",
                    }}
                  />
                  <T
                    medium
                    style={{
                      fontSize: 10,
                      color: "#DDCCA0",
                      letterSpacing: 0.2,
                    }}
                  >
                    {t("heroEyebrow")}
                  </T>
                </Row>
                <T
                  bold
                  style={{
                    color: "#fff",
                    fontSize: 25,
                    lineHeight: 35,
                    marginTop: 8,
                  }}
                >
                  {t("heroTitle")}
                </T>
                <T
                  style={{
                    fontSize: 11,
                    lineHeight: 18,
                    color: "#C1D5C8",
                    marginTop: 5,
                  }}
                >
                  {t("heroText")}
                </T>
                <Row style={{ gap: 8, marginTop: 15 }}>
                  <Button
                    label={t("newPurchase")}
                    variant="white"
                    small
                    icon="add"
                    onPress={() => open({ type: "invoice", kind: "purchase" })}
                  />
                  <Pressable onPress={() => setPage("settings")}>
                    <Row style={{ gap: 6, paddingHorizontal: 7 }}>
                      <T style={{ color: "#EDF4EC", fontSize: 10 }}>
                        {t("setupBusiness")}
                      </T>
                      <Icon name="arrow-back" size={14} color="#DFEBDD" />
                    </Row>
                  </Pressable>
                </Row>
              </View>
            </View>
            <Card
              style={{
                flex: wide ? 1 : undefined,
                padding: 21,
                minHeight: 207,
              }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <T bold style={{ fontSize: 16 }}>
                  {t("getStarted")}
                </T>
                <T number medium style={{ fontSize: 11, color: theme.primary }}>
                  {progress} / 3
                </T>
              </Row>
              <T style={{ fontSize: 11, color: theme.muted, marginTop: 5 }}>
                {t("progress")}
              </T>
              <Row style={{ gap: 5, marginTop: 13, marginBottom: 10 }}>
                {[0, 1, 2].map((n) => (
                  <View
                    key={n}
                    style={{
                      height: 4,
                      flex: 1,
                      backgroundColor:
                        n < progress ? theme.primary : theme.primarySoft,
                      borderRadius: 4,
                    }}
                  />
                ))}
              </Row>
              {steps.map((step, n) => (
                <Pressable
                  key={n}
                  onPress={step.onPress}
                  style={({ hovered }: any) => ({
                    paddingVertical: 8,
                    opacity: hovered ? 0.7 : 1,
                  })}
                >
                  <Row style={{ gap: 10 }}>
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: step.done
                          ? theme.primarySoft
                          : theme.border,
                        backgroundColor: step.done
                          ? theme.primarySoft
                          : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {step.done ? (
                        <Icon
                          name="checkmark"
                          size={13}
                          color={theme.primary}
                        />
                      ) : (
                        <T
                          number
                          style={{
                            fontSize: 10,
                            color: theme.muted,
                            lineHeight: 16,
                          }}
                        >
                          {n + 1}
                        </T>
                      )}
                    </View>
                    <T
                      medium
                      style={{
                        fontSize: 12,
                        flex: 1,
                        color: step.done ? theme.muted : theme.secondary,
                      }}
                    >
                      {step.label}
                    </T>
                    <Icon
                      name={step.done ? "checkmark" : "chevron-back"}
                      size={13}
                      color={step.done ? theme.primary : theme.muted}
                    />
                  </Row>
                </Pressable>
              ))}
            </Card>
          </View>
          <View style={{ gap: 13 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <T bold style={{ fontSize: 15 }}>
                {t("overview")}
              </T>
              <Row style={{ gap: 5 }}>
                <View
                  style={{
                    width: 5,
                    height: 5,
                    backgroundColor: theme.green,
                    borderRadius: 3,
                  }}
                />
                <T style={{ fontSize: 10, color: theme.muted }}>
                  {t("savedLocally")}
                </T>
              </Row>
            </Row>
            <View
              style={{
                flexDirection: "row-reverse",
                gap: 14,
                flexWrap: "wrap",
              }}
            >
              <StatCard
                title={t("todaySales")}
                value={stats.sales}
                icon="trending-up-outline"
                subtitle={`${stats.saleCount} ${t("invoice")} · ${t(period)}`}
                onPress={() => setPage("sales")}
              />
              <StatCard
                title={t("todayPurchases")}
                value={stats.purchases}
                icon="bag-handle-outline"
                tone="blue"
                subtitle={`${stats.purchaseCount} ${t("invoice")} · ${t(period)}`}
                onPress={() => setPage("purchases")}
              />
              <StatCard
                title={t("netProfit")}
                value={stats.profit}
                icon="pie-chart-outline"
                tone="amber"
                subtitle={stats.count ? t("reportsSummary") : t("noChange")}
                onPress={() => setPage("reports")}
              />
              <StatCard
                title={t("inventoryValue")}
                value={stockValue}
                icon="cube-outline"
                tone="neutral"
                subtitle={`${weight(stockWeight)} ${t("kg")} · ${birds} ${t("bird")}`}
                onPress={() => setPage("inventory")}
              />
            </View>
          </View>
          <Row style={{ gap: 9, flexWrap: "wrap" }}>
            <T
              medium
              style={{ fontSize: 11, color: theme.muted, marginLeft: 4 }}
            >
              {t("quickActions")}
            </T>
            {[
              {
                key: "newSale",
                icon: "add-circle-outline",
                type: "invoice",
                kind: "sale",
              },
              {
                key: "newPurchase",
                icon: "bag-add-outline",
                type: "invoice",
                kind: "purchase",
              },
              {
                key: "newReceipt",
                icon: "arrow-down-circle-outline",
                type: "money",
                kind: "receipt",
              },
              {
                key: "newVoucher",
                icon: "arrow-up-circle-outline",
                type: "money",
                kind: "voucher",
              },
              {
                key: "newExpense",
                icon: "receipt-outline",
                type: "money",
                kind: "expense",
              },
            ].map((a) => (
              <Button
                key={a.key}
                small
                variant="outline"
                label={t(a.key as TextKey)}
                icon={a.icon as IconName}
                onPress={() => open({ type: a.type as any, kind: a.kind })}
                style={{
                  backgroundColor: theme.surface,
                  flex: mobile ? undefined : 1,
                  paddingHorizontal: 10,
                }}
              />
            ))}
          </Row>
          <View
            style={{ flexDirection: wide ? "row-reverse" : "column", gap: 18 }}
          >
            <View style={{ flex: wide ? 2.12 : undefined }}>
              <Chart />
            </View>
            <Card
              style={{
                flex: wide ? 1 : undefined,
                padding: 21,
                minHeight: 280,
              }}
            >
              <SectionHeading
                title={t("financialBalances")}
                subtitle={t("balanceHint")}
              />
              <View style={{ gap: 15, marginTop: 21 }}>
                <Row style={{ gap: 11 }}>
                  <View
                    style={{
                      width: 37,
                      height: 37,
                      backgroundColor: theme.primarySoft,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name="arrow-down-outline"
                      size={19}
                      color={theme.primary}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T
                      style={{
                        fontSize: 11,
                        color: theme.secondary,
                        marginBottom: 4,
                      }}
                    >
                      {t("customerDebts")}
                    </T>
                    <Money value={stats.customerDebts} size={22} />
                  </View>
                  <Button
                    label={t("collect")}
                    variant="soft"
                    small
                    onPress={() => open({ type: "money", kind: "receipt" })}
                  />
                </Row>
                <View style={{ height: 1, backgroundColor: theme.border }} />
                <Row style={{ gap: 11 }}>
                  <View
                    style={{
                      width: 37,
                      height: 37,
                      backgroundColor: theme.amberSoft,
                      borderRadius: 11,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Icon
                      name="arrow-up-outline"
                      size={19}
                      color={theme.amber}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T
                      style={{
                        fontSize: 11,
                        color: theme.secondary,
                        marginBottom: 4,
                      }}
                    >
                      {t("supplierDebts")}
                    </T>
                    <Money value={stats.supplierDebts} size={22} />
                  </View>
                  <Button
                    label={t("pay")}
                    variant="outline"
                    small
                    onPress={() => open({ type: "money", kind: "voucher" })}
                  />
                </Row>
              </View>
              <Row
                style={{
                  gap: 5,
                  marginTop: 20,
                  justifyContent: "center",
                  backgroundColor: theme.surface2,
                  padding: 8,
                  borderRadius: 7,
                }}
              >
                <Icon
                  name="shield-checkmark-outline"
                  size={12}
                  color={theme.muted}
                />
                <T style={{ fontSize: 10, color: theme.muted }}>
                  {t("balanceFooter")}
                </T>
              </Row>
            </Card>
          </View>
          <View
            style={{ flexDirection: wide ? "row-reverse" : "column", gap: 18 }}
          >
            <Card style={{ flex: wide ? 2.12 : undefined, overflow: "hidden" }}>
              <View style={{ padding: 20 }}>
                <SectionHeading
                  title={t("recentTransactions")}
                  action={{
                    label: t("viewAll"),
                    onPress: () => setPage("transactions"),
                  }}
                />
              </View>
              {docs.length > 0 ? (
                <Transactions docs={docs} compact />
              ) : (
                <View style={{ borderTopWidth: 1, borderColor: theme.border }}>
                  <Empty
                    compact
                    icon="documents-outline"
                    title={t("noTransactions")}
                    description={t("noTransactionsHint")}
                    action={{
                      label: t("firstTransaction"),
                      onPress: () =>
                        open({ type: "invoice", kind: "purchase" }),
                    }}
                  />
                </View>
              )}
            </Card>
            <Card style={{ flex: wide ? 1 : undefined, padding: 20 }}>
              <SectionHeading
                title={t("inventoryOverview")}
                action={{
                  label: t("viewAll"),
                  onPress: () => setPage("inventory"),
                }}
              />
              <FlatList
                scrollEnabled={false}
                style={{ marginTop: 15 }}
                data={stock.slice(0, 3)}
                keyExtractor={(s) => String(s.id)}
                renderItem={({ item, index }) => (
                  <Row
                    style={{
                      paddingVertical: 12,
                      borderTopWidth: index ? 1 : 0,
                      borderColor: theme.border,
                      gap: 10,
                    }}
                  >
                    <View
                      style={{
                        width: 32,
                        height: 32,
                        backgroundColor: theme.surface2,
                        borderRadius: 10,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon
                        name="leaf-outline"
                        size={15}
                        color={theme.secondary}
                      />
                    </View>
                    <T medium style={{ fontSize: 12, flex: 1 }}>
                      {item.name}
                    </T>
                    <T number medium style={{ fontSize: 13 }}>
                      {weight(item.weight)}{" "}
                      <T style={{ fontSize: 10, color: theme.muted }}>
                        {t("kg")}
                      </T>
                    </T>
                  </Row>
                )}
              />
              <T
                style={{
                  fontSize: 10,
                  color: theme.muted,
                  textAlign: "center",
                  marginTop: 14,
                }}
              >
                {t("stockNote")}
              </T>
            </Card>
          </View>
          <Row
            style={{
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 8,
              paddingTop: 2,
            }}
          >
            <Row style={{ gap: 6 }}>
              <Icon
                name="cloud-offline-outline"
                size={14}
                color={theme.muted}
              />
              <T style={{ fontSize: 10, color: theme.muted }}>
                {t("offlineNote")}
              </T>
            </Row>
            <T style={{ fontSize: 10, color: theme.muted }}>{t("privacy")}</T>
          </Row>
        </View>
      }
    />
  );
}
