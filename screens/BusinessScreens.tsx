import React, { useEffect, useState } from "react";
import {
  View,
  FlatList,
  Pressable,
  RefreshControl,
  useWindowDimensions,
} from "react-native";
import { useApp } from "../lib/context";
import { t, TextKey } from "../lib/ar";
import {
  Kind,
  PartyKind,
  money,
  periodStart,
  weight,
  roundedRatio,
  formatDate,
} from "../lib/domain";
import {
  Badge,
  Button,
  Card,
  Chips,
  Empty,
  Field,
  Icon,
  IconName,
  Money,
  Row,
  SearchBox,
  SectionHeading,
  T,
} from "../components/ui";
import { TransactionRow, Transactions } from "../components/TransactionList";
import { StatCard } from "./Dashboard";
import { backup, backupSafetyCopy, exportCsv, listBackups, pickBackup, readBackupBytes, printReport } from "../lib/files";
import { ask } from "../lib/confirm";
const pagePadding = (width: number) => (width < 700 ? 18 : 29);
export function PageTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle: string;
  action?: { label: string; onPress: () => void; icon?: IconName };
}) {
  const { theme } = useApp();
  return (
    <Row
      style={{
        justifyContent: "space-between",
        gap: 15,
        flexWrap: "wrap",
        marginBottom: 24,
      }}
    >
      <View style={{ flex: 1, minWidth: 180 }}>
        <T bold style={{ fontSize: 27, lineHeight: 38 }}>
          {title}
        </T>
        <T style={{ fontSize: 12, color: theme.muted, marginTop: 5 }}>
          {subtitle}
        </T>
      </View>
      {action && (
        <Button
          label={action.label}
          icon={action.icon || "add"}
          onPress={action.onPress}
        />
      )}
    </Row>
  );
}
export function DocumentScreen({ kind }: { kind?: Kind }) {
  const { repo, theme, open, refresh, revision } = useApp();
  const width = useWindowDimensions().width;
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("allTime");
  const [status, setStatus] = useState("all");
  const [limit, setLimit] = useState(50);
  const [refreshing, setRefreshing] = useState(false);
  const docs = repo!
    .documents({
      kind,
      query,
      start: periodStart(period),
      limit,
      cancelled: status === "cancelled",
    })
    .filter(
      (d) =>
        status === "all" ||
        (status === "cancelled" && d.status === "cancelled") ||
        (status === "paid" && d.paid >= d.payable) ||
        (status === "unpaid" && d.paid < d.payable),
    );
  const stats = repo!.stats(periodStart(period));
  const isInvoice = kind === "sale" || kind === "purchase";
  const title: TextKey =
    kind === "sale"
      ? "sales"
      : kind === "purchase"
        ? "purchases"
        : kind === "expense"
          ? "expenses"
          : kind === "receipt" || kind === "voucher"
            ? "payments"
            : "transactions";
  const subtitle: TextKey =
    kind === "sale"
      ? "noSalesHint"
      : kind === "purchase"
        ? "noPurchasesHint"
        : kind === "expense"
          ? "noExpensesHint"
          : "noPaymentsHint";
  const emptyTitle: TextKey =
    kind === "sale"
      ? "noSales"
      : kind === "purchase"
        ? "noPurchases"
        : kind === "expense"
          ? "noExpenses"
          : "noTransactions";
  const onAdd = () =>
    open({ type: isInvoice ? "invoice" : "money", kind: kind || "receipt" });
  return (
    <FlatList
      data={docs}
      keyExtractor={(d) => d.id}
      renderItem={({ item }) => (
        <View style={{ backgroundColor: theme.surface }}>
          <TransactionRow doc={item} />
        </View>
      )}
      contentContainerStyle={{ padding: pagePadding(width), paddingBottom: 40 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            refresh();
            setTimeout(() => setRefreshing(false), 350);
          }}
        />
      }
      onEndReached={() => {
        if (docs.length >= limit) setLimit((n) => n + 50);
      }}
      ListHeaderComponent={
        <View>
          <PageTitle
            title={t(title)}
            subtitle={t(subtitle)}
            action={{
              label: t(
                isInvoice
                  ? "newInvoice"
                  : kind === "expense"
                    ? "newExpense"
                    : kind === "voucher"
                      ? "newVoucher"
                      : "newReceipt",
              ),
              onPress: onAdd,
            }}
          />
          <View
            style={{
              flexDirection: "row-reverse",
              gap: 15,
              flexWrap: "wrap",
              marginBottom: 23,
            }}
          >
            <StatCard
              title={t(
                kind === "purchase"
                  ? "totalPurchases"
                  : kind === "expense"
                    ? "expenses"
                    : kind === "receipt" || kind === "voucher"
                      ? "total"
                      : "totalSales",
              )}
              value={
                kind === "purchase"
                  ? stats.purchases
                  : kind === "expense"
                    ? stats.expenses
                    : kind === "receipt" || kind === "voucher"
                      ? repo!
                          .documents({
                            kind,
                            start: periodStart(period),
                            limit: 100000,
                          })
                          .reduce((n, d) => n + d.total, 0)
                      : stats.sales
              }
              icon={
                kind === "purchase"
                  ? "bag-handle-outline"
                  : "trending-up-outline"
              }
              subtitle={t(period as TextKey)}
            />
            {isInvoice && (
              <StatCard
                title={t("remaining")}
                value={repo!
                  .documents({
                    kind,
                    start: periodStart(period),
                    limit: 100000,
                  })
                  .reduce((n, d) => n + d.payable - d.paid, 0)}
                icon="wallet-outline"
                tone="amber"
                subtitle={t(
                  kind === "sale" ? "customerDebts" : "supplierDebts",
                )}
              />
            )}
          </View>
          <Card
            style={{
              padding: 16,
              borderBottomLeftRadius: 0,
              borderBottomRightRadius: 0,
            }}
          >
            <Row
              style={{
                gap: 15,
                justifyContent: "space-between",
                flexWrap: "wrap",
              }}
            >
              <SearchBox value={query} onChangeText={setQuery} />
              <Chips
                value={period}
                onChange={setPeriod}
                options={(
                  ["today", "week", "month", "allTime"] as TextKey[]
                ).map((p) => ({ value: p, label: t(p) }))}
              />
            </Row>
            {isInvoice && (
              <View style={{ marginTop: 14 }}>
                <Chips
                  value={status}
                  onChange={setStatus}
                  options={(
                    ["all", "paid", "unpaid", "cancelled"] as TextKey[]
                  ).map((s) => ({ value: s, label: t(s) }))}
                />
              </View>
            )}
          </Card>
        </View>
      }
      ListEmptyComponent={
        <Card style={{ borderTopLeftRadius: 0, borderTopRightRadius: 0 }}>
          <Empty
            icon={
              kind === "purchase" ? "bag-handle-outline" : "documents-outline"
            }
            title={query ? t("noResults") : t(emptyTitle)}
            description={query ? t("noResultsHint") : t(subtitle)}
            action={
              !query
                ? {
                    label: t(
                      isInvoice
                        ? "newInvoice"
                        : kind === "expense"
                          ? "newExpense"
                          : kind === "voucher"
                            ? "newVoucher"
                            : "newReceipt",
                    ),
                    onPress: onAdd,
                  }
                : undefined
            }
          />
        </Card>
      }
    />
  );
}
export function AccountsScreen() {
  const { repo, theme, open } = useApp();
  const width = useWindowDimensions().width;
  const [kind, setKind] = useState<PartyKind>("customer");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const data = repo!
    .parties(kind, query)
    .filter(
      (p) =>
        filter === "all" ||
        (filter === "owes" && p.balance > 0) ||
        (filter === "owed" && p.balance < 0) ||
        (filter === "paid" && p.balance === 0),
    );
  return (
    <FlatList
      data={data}
      keyExtractor={(p) => p.id}
      contentContainerStyle={{ padding: pagePadding(width), paddingBottom: 40 }}
      renderItem={({ item }) => (
        <Pressable
          onPress={() => open({ type: "partyDetail", id: item.id })}
          style={{
            backgroundColor: theme.surface,
            borderWidth: 1,
            borderColor: theme.border,
            borderRadius: 12,
            padding: 20,
            marginBottom: 10,
          }}
        >
          <Row style={{ gap: 16 }}>
            <View
              style={{
                width: 47,
                height: 47,
                backgroundColor:
                  kind === "customer" ? theme.primarySoft : theme.amberSoft,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <T
                bold
                style={{
                  fontSize: 22,
                  color: kind === "customer" ? theme.primary : theme.amber,
                }}
              >
                {item.name.charAt(0)}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T bold style={{ fontSize: 16 }}>
                {item.name}
              </T>
              <T number style={{ fontSize: 12, color: theme.muted }}>
                {item.phone ||
                  item.address ||
                  t(kind === "customer" ? "customer" : "supplier")}
              </T>
            </View>
            <View style={{ alignItems: "flex-end", gap: 5 }}>
              <Money value={Math.abs(item.balance)} size={21} />
              <Badge
                label={t(
                  item.balance > 0
                    ? "owes"
                    : item.balance < 0
                      ? "owed"
                      : "paid",
                )}
                tone={item.balance === 0 ? "green" : "amber"}
              />
            </View>
            <Icon name="chevron-back" size={17} />
          </Row>
        </Pressable>
      )}
      ListHeaderComponent={
        <View>
          <PageTitle
            title={t("accounts")}
            subtitle={t("balanceHint")}
            action={{
              label: t(kind === "customer" ? "newCustomer" : "newSupplier"),
              onPress: () => open({ type: "party", kind }),
            }}
          />
          <Row style={{ gap: 12, marginBottom: 22, flexWrap: "wrap" }}>
            <Button
              variant={kind === "customer" ? "primary" : "outline"}
              label={`${t("customers")} (${repo!.parties("customer").length})`}
              icon="people-outline"
              onPress={() => setKind("customer")}
            />
            <Button
              variant={kind === "supplier" ? "primary" : "outline"}
              label={`${t("suppliers")} (${repo!.parties("supplier").length})`}
              icon="business-outline"
              onPress={() => setKind("supplier")}
            />
          </Row>
          <Card style={{ padding: 16, marginBottom: 20 }}>
            <Row
              style={{
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 15,
              }}
            >
              <SearchBox value={query} onChangeText={setQuery} />
              <Chips
                options={(["all", "owes", "owed", "paid"] as TextKey[]).map(
                  (v) => ({ value: v, label: t(v) }),
                )}
                value={filter}
                onChange={setFilter}
              />
            </Row>
          </Card>
        </View>
      }
      ListEmptyComponent={
        <Card>
          <Empty
            icon="people-outline"
            title={
              query
                ? t("noResults")
                : t(kind === "customer" ? "noCustomers" : "noSuppliers")
            }
            description={t(
              kind === "customer" ? "noCustomersHint" : "noSuppliersHint",
            )}
            action={{
              label: t(kind === "customer" ? "newCustomer" : "newSupplier"),
              onPress: () => open({ type: "party", kind }),
            }}
          />
        </Card>
      }
    />
  );
}
export function InventoryScreen() {
  const { repo, theme, open } = useApp();
  const width = useWindowDimensions().width;
  const [selected, setSelected] = useState<number | null>(null);
  const items = repo!.inventory();
  const cols = width >= 1100 ? 3 : width >= 700 ? 2 : 1;
  const total = items.reduce(
    (a, p) => ({
      weight: a.weight + p.weight,
      pool: a.pool + p.pool,
      quantity: a.quantity + p.quantity,
    }),
    { weight: 0, pool: 0, quantity: 0 },
  );
  const movements = selected
    ? repo!
        .documents({ limit: 100000 })
        .filter((d) =>
          repo!.document(d.id)?.items?.some((i) => i.type_id === selected),
        )
    : [];
  return (
    <FlatList
      data={items}
      numColumns={cols}
      key={cols}
      keyExtractor={(p) => String(p.id)}
      contentContainerStyle={{ padding: pagePadding(width), paddingBottom: 40 }}
      columnWrapperStyle={
        cols > 1 ? { flexDirection: "row-reverse", gap: 15 } : undefined
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => setSelected(selected === item.id ? null : item.id)}
          style={{ flex: 1, marginBottom: 15 }}
        >
          <Card
            style={{
              padding: 23,
              borderColor: selected === item.id ? theme.primary : theme.border,
              minHeight: 208,
            }}
          >
            <Row style={{ justifyContent: "space-between" }}>
              <View
                style={{
                  width: 43,
                  height: 43,
                  borderRadius: 13,
                  backgroundColor: theme.primarySoft,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Icon name="leaf-outline" size={23} color={theme.primary} />
              </View>
              <Badge
                label={item.active === 0 ? t("inactive") : t(item.weight ? "available" : "pending")}
                tone={item.active === 0 ? "amber" : item.weight ? "green" : "neutral"}
              />
            </Row>
            <T bold style={{ fontSize: 18, marginTop: 14 }}>
              {item.name}
            </T>
            <Row style={{ gap: 7, marginTop: 12 }}>
              <T number bold style={{ fontSize: 32, lineHeight: 40 }}>
                {weight(item.weight)}
              </T>
              <T style={{ color: theme.muted }}>{t("kg")}</T>
            </Row>
            <Row style={{ justifyContent: "space-between", marginTop: 9 }}>
              <T style={{ fontSize: 12, color: theme.muted }}>
                {item.quantity} {t("bird")} · {item.cages} {t("cage")}
              </T>
              <T number style={{ fontSize: 12, color: theme.primary }}>
                {money(item.pool)} {t("currency")}
              </T>
            </Row>
            <Row
              style={{
                justifyContent: "space-between",
                borderTopWidth: 1,
                borderColor: theme.border,
                paddingTop: 12,
                marginTop: 13,
              }}
            >
              <T style={{ fontSize: 11, color: theme.muted }}>
                {t("averageCost")}
              </T>
              <T number medium style={{ fontSize: 12 }}>
                {money(roundedRatio(item.pool, 1000, item.weight))}
              </T>
            </Row>
          </Card>
        </Pressable>
      )}
      ListHeaderComponent={
        <View>
          <PageTitle
            title={t("inventory")}
            subtitle={t("inventoryHint")}
            action={{
              label: t("newType"),
              onPress: () => open({ type: "type" }),
            }}
          />
          <Card style={{ padding: 22, marginBottom: 24 }}>
            <Row style={{ justifyContent: "space-around", gap: 10, flexWrap: "wrap" }}>
              <View>
                <T style={{ fontSize: 12, color: theme.muted }}>
                  {t("stockValue")}
                </T>
                <Money value={total.pool} size={26} />
              </View>
              <View>
                <T style={{ fontSize: 12, color: theme.muted }}>
                  {t("totalWeight")}
                </T>
                <T number bold style={{ fontSize: 26, lineHeight: 36 }}>
                  {weight(total.weight)}{" "}
                  <T style={{ fontSize: 12 }}>{t("kg")}</T>
                </T>
              </View>
              <View>
                <T style={{ fontSize: 12, color: theme.muted }}>
                  {t("totalBirds")}
                </T>
                <T number bold style={{ fontSize: 26, lineHeight: 36 }}>
                  {total.quantity}
                </T>
              </View>
            </Row>
          </Card>
        </View>
      }
      ListFooterComponent={
        selected ? (
          <Card style={{ marginTop: 9, overflow: "hidden" }}>
            <View style={{ padding: 20 }}>
              <SectionHeading
                title={`${t("stockMovements")} · ${items.find((i) => i.id === selected)?.name}`}
              />
            </View>
            <Transactions docs={movements} />
          </Card>
        ) : (
          <View style={{ alignItems: "center", padding: 15 }}>
            <Button
              variant="soft"
              label={t("newPurchase")}
              icon="add"
              onPress={() => open({ type: "invoice", kind: "purchase" })}
            />
          </View>
        )
      }
    />
  );
}
export function ReportsScreen() {
  const { repo, theme, notify } = useApp();
  const width = useWindowDimensions().width;
  const [period, setPeriod] = useState("month");
  const [report, setReport] = useState("profit");
  const stats = repo!.stats(periodStart(period));
  const docs = repo!.documents({ start: periodStart(period), limit: 100000 });
  const reports: { key: string; label: TextKey; icon: IconName }[] = [
    { key: "profit", label: "netProfit", icon: "pie-chart-outline" },
    { key: "sale", label: "sales", icon: "trending-up-outline" },
    { key: "purchase", label: "purchases", icon: "bag-handle-outline" },
    { key: "expense", label: "expenses", icon: "receipt-outline" },
    { key: "customer", label: "customerDebts", icon: "people-outline" },
    { key: "supplier", label: "supplierDebts", icon: "business-outline" },
    { key: "inventory", label: "inventory", icon: "cube-outline" },
    { key: "payments", label: "payments", icon: "wallet-outline" },
  ];
  const filtered = docs.filter(
    (d) =>
      report === "profit" ||
      (report === "payments" &&
        (d.kind === "receipt" || d.kind === "voucher")) ||
      d.kind === report,
  );
  const handleExport = async (pdf = false) => {
    try {
      if (report === "customer" || report === "supplier") {
        const parties = repo!.parties(
          report === "customer" ? "customer" : "supplier",
        );
        const { saveFile } = await import("../lib/files");
        await saveFile(
          "balances.csv",
          "\uFEFF" +
            [
              `${t("name")},${t("balance")}`,
              ...parties.map(
                (p) => `"${p.name.replace(/"/g, '""')}","${money(p.balance)}"`,
              ),
            ].join("\n"),
          "text/csv;charset=utf-8",
        );
      } else if (report === "inventory") {
        const { saveFile } = await import("../lib/files");
        await saveFile(
          "inventory.csv",
          "\uFEFF" +
            [
              `${t("poultry")},${t("weight")},${t("stockValue")}`,
              ...repo!
                .inventory()
                .map((p) => `${p.name},${weight(p.weight)},"${money(p.pool)}"`),
            ].join("\n"),
          "text/csv;charset=utf-8",
        );
      } else if (pdf)
        await printReport(
          repo!,
          filtered,
          t(reports.find((r) => r.key === report)!.label),
        );
      else await exportCsv(filtered);
      notify(t("reportReady"));
    } catch (e: any) {
      notify(e.message);
    }
  };
  return (
    <FlatList
      data={[]}
      renderItem={() => null}
      contentContainerStyle={{ padding: pagePadding(width), paddingBottom: 40 }}
      ListHeaderComponent={
        <View>
          <PageTitle
            title={t("reports")}
            subtitle={t("reportsHint")}
            action={{
              label: t("exportCsv"),
              icon: "download-outline",
              onPress: () => handleExport(),
            }}
          />
          <View
            style={{
              flexDirection: "row-reverse",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 25,
            }}
          >
            {reports.map((r) => (
              <Pressable
                key={r.key}
                onPress={() => setReport(r.key)}
                style={{ width: width < 700 ? "47%" : "23.5%" }}
              >
                <Card
                  style={{
                    padding: 18,
                    gap: 12,
                    borderColor:
                      r.key === report ? theme.primary : theme.border,
                    backgroundColor:
                      r.key === report ? theme.primarySoft : theme.surface,
                  }}
                >
                  <Icon
                    name={r.icon}
                    color={r.key === report ? theme.primary : theme.secondary}
                    size={24}
                  />
                  <T
                    bold
                    style={{
                      fontSize: 13,
                      color: r.key === report ? theme.primary : theme.text,
                    }}
                  >
                    {t(r.label)}
                  </T>
                </Card>
              </Pressable>
            ))}
          </View>
          <Row
            style={{
              justifyContent: "space-between",
              marginBottom: 20,
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <Chips
              value={period}
              onChange={setPeriod}
              options={(["today", "week", "month", "allTime"] as TextKey[]).map(
                (p) => ({ value: p, label: t(p) }),
              )}
            />
            {!["inventory", "customer", "supplier"].includes(report) && (
              <Button
                small
                variant="outline"
                label={t("print")}
                icon="print-outline"
                onPress={() => handleExport(true)}
              />
            )}
          </Row>
          {report === "profit" ? (
            <Card style={{ padding: 24 }}>
              <SectionHeading
                title={t("reportsSummary")}
                subtitle={t(period as TextKey)}
              />
              <View style={{ marginTop: 24, gap: 20 }}>
                {[
                  { key: "revenue", value: stats.sales },
                  { key: "cogs", value: stats.cogs },
                  { key: "grossProfit", value: stats.sales - stats.cogs },
                  { key: "expenses", value: stats.expenses },
                  { key: "netProfit", value: stats.profit },
                ].map((item, n) => (
                  <Row
                    key={item.key}
                    style={{
                      justifyContent: "space-between",
                      borderBottomWidth: n < 4 ? 1 : 0,
                      borderColor: theme.border,
                      paddingBottom: 18,
                    }}
                  >
                    <T medium style={{ fontSize: n === 4 ? 18 : 14 }}>
                      {t(item.key as TextKey)}
                    </T>
                    <Money
                      value={item.value}
                      size={n === 4 ? 28 : 22}
                      color={n === 4 ? theme.primary : undefined}
                    />
                  </Row>
                ))}
              </View>
              <Row
                style={{
                  backgroundColor: theme.primarySoft,
                  padding: 16,
                  gap: 12,
                  borderRadius: 10,
                  marginTop: 12,
                }}
              >
                <Icon name="information-circle-outline" color={theme.primary} />
                <T style={{ fontSize: 12, color: theme.primary, flex: 1 }}>
                  {t("profitHint")}
                </T>
              </Row>
            </Card>
          ) : report === "customer" || report === "supplier" ? (
            <Card style={{ padding: 20 }}>
              <SectionHeading
                title={t(
                  report === "customer" ? "customerDebts" : "supplierDebts",
                )}
              />
              <FlatList
                data={repo!
                  .parties(report === "customer" ? "customer" : "supplier")
                  .filter((p) =>
                    report === "customer" ? p.balance > 0 : p.balance < 0,
                  )}
                keyExtractor={(p) => p.id}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Row
                    style={{
                      justifyContent: "space-between",
                      paddingVertical: 18,
                      borderBottomWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <T medium>{item.name}</T>
                    <Money value={Math.abs(item.balance)} size={23} />
                  </Row>
                )}
                ListEmptyComponent={
                  <Empty
                    title={t("noReport")}
                    description={t("noReportHint")}
                    icon="wallet-outline"
                  />
                }
              />
            </Card>
          ) : report === "inventory" ? (
            <Card style={{ padding: 20 }}>
              <FlatList
                data={repo!.inventory()}
                keyExtractor={(p) => String(p.id)}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <Row
                    style={{
                      justifyContent: "space-between",
                      paddingVertical: 18,
                      borderBottomWidth: 1,
                      borderColor: theme.border,
                    }}
                  >
                    <T medium>{item.name}</T>
                    <T number>
                      {weight(item.weight)} {t("kg")}
                    </T>
                    <Money value={item.pool} size={21} />
                  </Row>
                )}
              />
            </Card>
          ) : (
            <Card style={{ overflow: "hidden" }}>
              <Transactions docs={filtered} />
            </Card>
          )}
        </View>
      }
    />
  );
}
export function SettingsScreen() {
  const { repo, theme, settings, refresh, notify, open } = useApp();
  const width = useWindowDimensions().width;
  const [name, setName] = useState(settings.business_name || "");
  const [phone, setPhone] = useState(settings.phone || "");
  const [address, setAddress] = useState(settings.address || "");
  const [footer, setFooter] = useState(settings.footer || "");
  const [busy, setBusy] = useState(false);
  const [backups, setBackups] = useState<
    { name: string; uri: string; size: number | null; modified: number | null }[]
  >([]);
  useEffect(() => {
    listBackups().then(setBackups).catch(() => setBackups([]));
  }, [settings.last_backup]);
  const save = async () => {
    if (!name.trim()) {
      notify(t("nameRequired"));
      return;
    }
    setBusy(true);
    try {
      await repo!.setSettings({
        business_name: name.trim(),
        phone,
        address,
        footer,
      });
      refresh();
      notify(t("done"));
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  const backupNow = async () => {
    try {
      await backup(repo!);
      refresh();
      notify(t("backupSuccess"));
    } catch (e: any) {
      notify(e.message);
    }
  };
  const restoreBytes = async (bytes: Uint8Array) => {
    if (!(await ask(t("restoreBackup"), t("restoreWarning")))) return;
    await repo!.restore(bytes);
    refresh();
    const s = repo!.settings();
    setName(s.business_name || "");
    setPhone(s.phone || "");
    setAddress(s.address || "");
    setFooter(s.footer || "");
    notify(t("restoreSuccess"));
  };
  const restoreNow = async () => {
    try {
      await backupSafetyCopy(repo!);
      const bytes = await pickBackup();
      if (bytes) await restoreBytes(bytes);
      listBackups().then(setBackups).catch(() => setBackups([]));
    } catch (e: any) {
      notify(e.message);
    }
  };
  return (
    <FlatList
      data={[]}
      renderItem={() => null}
      contentContainerStyle={{ padding: pagePadding(width), paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ gap: 20 }}>
          <PageTitle title={t("settings")} subtitle={t("tagline")} />
          <Card style={{ padding: 25, gap: 20 }}>
            <SectionHeading
              title={t("businessInfo")}
              subtitle={t("setBusinessReminderHint")}
            />
            <Row style={{ gap: 18, flexWrap: "wrap" }}>
              <Field
                label={t("businessName")}
                value={name}
                onChangeText={setName}
              />
              <Field
                label={t("businessPhone")}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </Row>
            <Field
              label={t("businessAddress")}
              value={address}
              onChangeText={setAddress}
            />
            <Field
              label={t("invoiceFooter")}
              value={footer}
              onChangeText={setFooter}
            />
            <Row>
              <Button
                label={t("saveChanges")}
                icon="checkmark"
                onPress={save}
                loading={busy}
              />
            </Row>
          </Card>
          <Card style={{ padding: 25, gap: 17 }}>
            <SectionHeading title={t("appearance")} />
            <Chips
              value={settings.theme || "light"}
              options={(["light", "dark", "system"] as TextKey[]).map((v) => ({
                value: v,
                label: t(v),
              }))}
              onChange={async (themeMode) => {
                await repo!.setSettings({ theme: themeMode });
                refresh();
              }}
            />
          </Card>
          <Card style={{ padding: 25, gap: 18 }}>
            <SectionHeading
              title={t("dataSafety")}
              subtitle={t("backupHint")}
            />
            <Row style={{ gap: 10, flexWrap: "wrap" }}>
              <Button
                label={t("createBackup")}
                icon="cloud-download-outline"
                onPress={backupNow}
              />
              <Button
                variant="outline"
                label={t("restoreBackup")}
                icon="refresh-outline"
                onPress={restoreNow}
              />
            </Row>
            {settings.last_backup && (
              <T style={{ fontSize: 12, color: theme.muted }}>
                {t("savedAt")}: {formatDate(Number(settings.last_backup))}
              </T>
            )}
            <Row style={{ gap: 7 }}>
              <Icon
                name="shield-checkmark-outline"
                size={16}
                color={theme.primary}
              />
              <T style={{ fontSize: 11, color: theme.muted, flex: 1 }}>
                {t("localOnly")}
              </T>
            </Row>
            {!!backups.length && (
              <View style={{ gap: 10, marginTop: 14 }}>
                <T medium>{t("backup")}</T>
                {backups.map((file) => (
                  <Pressable
                    key={file.uri}
                    onPress={async () => {
                      try {
                        await backupSafetyCopy(repo!);
                        await restoreBytes(await readBackupBytes(file.uri));
                      } catch (e: any) {
                        notify(e.message);
                      }
                    }}
                  >
                    <Card style={{ padding: 14, backgroundColor: theme.surface2 }}>
                      <Row style={{ justifyContent: "space-between", gap: 12 }}>
                        <View style={{ flex: 1 }}>
                          <T medium style={{ fontSize: 12 }}>{file.name}</T>
                          <T style={{ fontSize: 11, color: theme.muted, marginTop: 4 }}>
                            {file.modified ? formatDate(file.modified) : t("pending")}
                            {file.size ? ` · ${(file.size / 1024).toFixed(1)} KB` : ""}
                          </T>
                        </View>
                        <Icon name="refresh-outline" size={16} color={theme.primary} />
                      </Row>
                    </Card>
                  </Pressable>
                ))}
              </View>
            )}
          </Card>
          <Card style={{ padding: 25 }}>
            <SectionHeading
              title={t("poultryTypes")}
              action={{
                label: t("newType"),
                onPress: () => open({ type: "type" }),
              }}
            />
            <Row style={{ gap: 8, flexWrap: "wrap", marginTop: 16 }}>
              {repo!.inventory(false).map((p) => (
                <Badge key={p.id} label={p.name + (p.active === 0 ? " · " + t("inactive") : "")} tone={p.active === 0 ? "amber" : "neutral"} />
              ))}
            </Row>
          </Card>
          <Card style={{ padding: 22 }}>
            <Row style={{ justifyContent: "space-between" }}>
              <View>
                <T bold>{t("licenseTitle")}</T>
                <T style={{ fontSize: 11, color: theme.muted }}>
                  {t("version")}
                </T>
              </View>
              <Button
                label={t("license")}
                variant="outline"
                small
                icon="key-outline"
                onPress={() => open({ type: "license" })}
              />
            </Row>
          </Card>
        </View>
      }
    />
  );
}
export function MoreScreen() {
  const { setPage, open, theme } = useApp();
  const width = useWindowDimensions().width;
  const items: {
    key: string;
    icon: IconName;
    label: TextKey;
    action: () => void;
  }[] = [
    {
      key: "inventory",
      icon: "cube-outline",
      label: "inventory",
      action: () => setPage("inventory"),
    },
    {
      key: "transactions",
      icon: "swap-horizontal-outline",
      label: "transactions",
      action: () => setPage("transactions"),
    },
    {
      key: "reports",
      icon: "bar-chart-outline",
      label: "reports",
      action: () => setPage("reports"),
    },
    {
      key: "expenses",
      icon: "receipt-outline",
      label: "expenses",
      action: () => setPage("expenses"),
    },
    {
      key: "payments",
      icon: "wallet-outline",
      label: "payments",
      action: () => setPage("payments"),
    },
    {
      key: "settings",
      icon: "settings-outline",
      label: "settings",
      action: () => setPage("settings"),
    },
    {
      key: "license",
      icon: "key-outline",
      label: "license",
      action: () => open({ type: "license" }),
    },
  ];
  return (
    <FlatList
      data={items}
      keyExtractor={(i) => i.key}
      contentContainerStyle={{ padding: pagePadding(width) }}
      ListHeaderComponent={
        <PageTitle title={t("more")} subtitle={t("manage")} />
      }
      renderItem={({ item }) => (
        <Pressable onPress={item.action} style={{ marginBottom: 12 }}>
          <Card style={{ padding: 23 }}>
            <Row style={{ gap: 13 }}>
              <Icon name={item.icon} color={theme.primary} />
              <T bold style={{ flex: 1 }}>
                {t(item.label)}
              </T>
              <Icon name="chevron-back" size={16} />
            </Row>
          </Card>
        </Pressable>
      )}
    />
  );
}
