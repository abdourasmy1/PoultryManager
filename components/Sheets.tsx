import React, { useState } from "react";
import {
  View,
  Modal,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Linking,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useApp } from "../lib/context";
import { t, TextKey } from "../lib/ar";
import { formatDate, money, weight } from "../lib/domain";
import {
  Badge,
  Button,
  Card,
  Empty,
  Icon,
  IconButton,
  Money,
  Row,
  SearchBox,
  SectionHeading,
  T,
} from "./ui";
import { InvoiceForm, MoneyForm, PartyForm, TypeForm } from "./Forms";
import { LicenseContent } from "./LicenseGate";
import { Transactions } from "./TransactionList";
import { ask } from "../lib/confirm";
import { printInvoice, printReport } from "../lib/files";
export function DocumentDetail({ id }: { id: string }) {
  const { repo, theme, open, refresh, notify } = useApp();
  const doc = repo!.document(id)!;
  const items = repo!.inventory();
  const [busy, setBusy] = useState(false);
  const invoice = doc.kind === "sale" || doc.kind === "purchase";
  const cancel = async () => {
    if (!(await ask(t("confirmCancel"), t("cancelWarning")))) return;
    setBusy(true);
    try {
      await repo!.cancelDocument(id);
      refresh();
      notify(t("cancelledSuccess"));
      open(null);
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 22 }}>
      <Card
        style={{
          padding: 23,
          backgroundColor: theme.primarySoft,
          borderColor: theme.primarySoft,
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <View>
            <T bold style={{ fontSize: 19 }}>
              {doc.party_name || doc.category || t(doc.kind)}
            </T>
            <T
              number
              style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}
            >
              {doc.doc_no} · {formatDate(doc.occurred_at)}
            </T>
          </View>
          <Badge
            label={t(
              doc.status === "cancelled"
                ? "cancelled"
                : !invoice || doc.paid >= doc.payable
                  ? "paid"
                  : doc.paid > 0
                    ? "partial"
                    : "unpaid",
            )}
            tone={
              doc.status === "cancelled"
                ? "red"
                : doc.paid >= doc.payable
                  ? "green"
                  : "amber"
            }
          />
        </Row>
        <View style={{ marginTop: 24 }}>
          <Money value={doc.total} size={37} />
        </View>
      </Card>
      {invoice && (
        <Card style={{ padding: 19, gap: 17 }}>
          <SectionHeading title={t("itemDetails")} />
          {doc.items?.map((i, n) => (
            <View
              key={n}
              style={{
                gap: 7,
                borderTopWidth: 1,
                borderColor: theme.border,
                paddingTop: 14,
              }}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <T bold>{items.find((p) => p.id === i.type_id)?.name}</T>
                <Money value={i.total} size={20} />
              </Row>
              <T style={{ fontSize: 12, color: theme.muted }}>
                {i.quantity} {t("bird")} · {i.cages} {t("cage")} ·{" "}
                {weight(i.weight)} {t("kg")} × {money(i.price)} {t("currency")}
              </T>
            </View>
          ))}
        </Card>
      )}
      {invoice && (
        <View style={{ gap: 13 }}>
          {doc.kind === "purchase" && (
            <>
              <Row style={{ justifyContent: "space-between" }}>
                <T>{t("transport")}</T>
                <Money value={doc.transport} size={19} />
              </Row>
              <Row style={{ justifyContent: "space-between" }}>
                <T>{t("otherCosts")}</T>
                <Money value={doc.other} size={19} />
              </Row>
            </>
          )}
          <Row style={{ justifyContent: "space-between" }}>
            <T>{t("paidAmount")}</T>
            <Money value={doc.paid} size={21} />
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <T bold>{t("remaining")}</T>
            <Money
              value={doc.payable - doc.paid}
              size={23}
              color={theme.amber}
            />
          </Row>
          {doc.kind === "sale" && (
            <Row
              style={{
                justifyContent: "space-between",
                paddingTop: 14,
                borderTopWidth: 1,
                borderColor: theme.border,
              }}
            >
              <T bold>{t("grossProfit")}</T>
              <Money
                value={doc.total - doc.cogs}
                size={23}
                color={theme.primary}
              />
            </Row>
          )}
        </View>
      )}
      {!!doc.notes && (
        <Card style={{ padding: 17 }}>
          <T medium>{t("notes")}</T>
          <T style={{ fontSize: 13, color: theme.secondary, marginTop: 7 }}>
            {doc.notes}
          </T>
        </Card>
      )}
      <Button
        label={t("print")}
        icon="print-outline"
        variant="outline"
        onPress={async () => {
          try {
            await printInvoice(repo!, doc);
          } catch (e: any) {
            notify(e.message);
          }
        }}
      />
      {doc.status === "active" && (
        <Row style={{ gap: 10, flexWrap: "wrap" }}>
          <Button
            label={t("edit")}
            icon="create-outline"
            variant="soft"
            onPress={() =>
              open({
                type: invoice ? "invoice" : "money",
                kind: doc.kind,
                id: doc.id,
              })
            }
            style={{ flex: 1 }}
          />
          {invoice && doc.payable > doc.paid && (
            <Button
              label={t(doc.kind === "sale" ? "collect" : "pay")}
              icon="wallet-outline"
              onPress={() =>
                open({
                  type: "money",
                  kind: doc.kind === "sale" ? "receipt" : "voucher",
                  partyId: doc.party_id!,
                })
              }
              style={{ flex: 1 }}
            />
          )}
          <Button
            label={t("delete")}
            icon="close-circle-outline"
            variant="danger"
            onPress={cancel}
            loading={busy}
          />
        </Row>
      )}
    </View>
  );
}
function PartyDetail({ id }: { id: string }) {
  const { repo, theme, open, notify } = useApp();
  const party = repo!.party(id)!;
  const docs = repo!.documents({ partyId: id, limit: 100000 });
  return (
    <View style={{ gap: 21 }}>
      <Row style={{ gap: 16 }}>
        <View
          style={{
            width: 65,
            height: 65,
            backgroundColor: theme.primarySoft,
            borderRadius: 22,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <T bold style={{ fontSize: 31, color: theme.primary }}>
            {party.name.charAt(0)}
          </T>
        </View>
        <View style={{ flex: 1 }}>
          <T bold style={{ fontSize: 24, lineHeight: 33 }}>
            {party.name}
          </T>
          <T number style={{ fontSize: 13, color: theme.muted }}>
            {party.phone || party.address}
          </T>
        </View>
        {!party.walk_in && (
          <IconButton
            icon="create-outline"
            label={t("edit")}
            onPress={() => open({ type: "party", kind: party.kind, id })}
          />
        )}
      </Row>
      <Card style={{ padding: 23, backgroundColor: theme.surface2 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <T bold>{t("balance")}</T>
          <Badge
            label={t(
              party.balance > 0 ? "owes" : party.balance < 0 ? "owed" : "paid",
            )}
            tone={party.balance ? "amber" : "green"}
          />
        </Row>
        <View style={{ marginTop: 12 }}>
          <Money value={Math.abs(party.balance)} size={34} />
        </View>
      </Card>
      <Row style={{ gap: 8, flexWrap: "wrap" }}>
        <Button
          label={t(party.kind === "customer" ? "newSale" : "newPurchase")}
          icon="add"
          onPress={() =>
            open({
              type: "invoice",
              kind: party.kind === "customer" ? "sale" : "purchase",
              partyId: id,
            })
          }
        />
        <Button
          variant="soft"
          label={t(party.kind === "customer" ? "collect" : "pay")}
          icon="wallet-outline"
          onPress={() =>
            open({
              type: "money",
              kind: party.kind === "customer" ? "receipt" : "voucher",
              partyId: id,
            })
          }
        />
        {!!party.phone && (
          <Button
            variant="outline"
            label={t("call")}
            icon="call-outline"
            onPress={() =>
              Linking.openURL("tel:" + party.phone).catch(() =>
                notify(t("error")),
              )
            }
          />
        )}
      </Row>
      <SectionHeading
        title={t("transactions")}
        action={{
          label: t("print"),
          onPress: async () => {
            try {
              await printReport(
                repo!,
                docs,
                `${t("transactions")} · ${party.name}`,
              );
            } catch (e: any) {
              notify(e.message);
            }
          },
        }}
      />
      <Card style={{ overflow: "hidden" }}>
        <Transactions docs={docs} compact />
      </Card>
    </View>
  );
}
function SearchSheet() {
  const { repo, theme, open } = useApp();
  const [query, setQuery] = useState("");
  const parties = query.trim() ? repo!.parties(undefined, query) : [];
  const docs = query.trim() ? repo!.documents({ query }) : [];
  return (
    <View style={{ gap: 20 }}>
      <SearchBox
        value={query}
        onChangeText={setQuery}
        placeholder={t("search")}
      />
      {parties.length > 0 && (
        <Card style={{ padding: 17, gap: 10 }}>
          <T bold>{t("accounts")}</T>
          {parties.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => open({ type: "partyDetail", id: p.id })}
            >
              <Row style={{ paddingVertical: 10, gap: 10 }}>
                <Icon
                  name={
                    p.kind === "customer"
                      ? "person-outline"
                      : "business-outline"
                  }
                  color={theme.primary}
                />
                <T medium style={{ flex: 1 }}>
                  {p.name}
                </T>
                <T number style={{ fontSize: 12, color: theme.muted }}>
                  {p.phone}
                </T>
                <Icon name="chevron-back" size={14} />
              </Row>
            </Pressable>
          ))}
        </Card>
      )}
      {docs.length > 0 && (
        <Card>
          <Transactions docs={docs} compact />
        </Card>
      )}
      {!parties.length && !docs.length && (
        <Empty
          icon="search-outline"
          title={t(query ? "noResults" : "searchList")}
          description={t("noResultsHint")}
        />
      )}
    </View>
  );
}
function Notifications() {
  const { theme, settings, setPage, open } = useApp();
  const reminders = [
    ...(!settings.business_name
      ? [
          {
            title: t("setBusinessReminder"),
            description: t("setBusinessReminderHint"),
            icon: "storefront-outline" as const,
          },
        ]
      : []),
    ...(!settings.last_backup
      ? [
          {
            title: t("backupReminder"),
            description: t("backupReminderHint"),
            icon: "cloud-download-outline" as const,
          },
        ]
      : []),
  ];
  return (
    <View style={{ gap: 14 }}>
      {reminders.length ? (
        reminders.map((n, i) => (
          <Pressable
            key={i}
            onPress={() => {
              open(null);
              setPage("settings");
            }}
          >
            <Card style={{ padding: 19 }}>
              <Row style={{ gap: 13 }}>
                <Icon name={n.icon} size={25} color={theme.primary} />
                <View style={{ flex: 1 }}>
                  <T bold style={{ fontSize: 15 }}>
                    {n.title}
                  </T>
                  <T style={{ fontSize: 12, color: theme.muted, marginTop: 4 }}>
                    {n.description}
                  </T>
                </View>
                <Icon name="chevron-back" size={15} />
              </Row>
            </Card>
          </Pressable>
        ))
      ) : (
        <Empty
          icon="checkmark-circle-outline"
          title={t("allGood")}
          description={t("allGoodHint")}
        />
      )}
    </View>
  );
}
export function HelpContent({ license = false }: { license?: boolean }) {
  const { theme, notify } = useApp();
  return (
    <View style={{ gap: 22 }}>
      <View
        style={{
          width: 67,
          height: 67,
          borderRadius: 22,
          backgroundColor: theme.primarySoft,
          alignSelf: "center",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon
          name={license ? "key-outline" : "leaf-outline"}
          size={32}
          color={theme.primary}
        />
      </View>
      <T bold style={{ fontSize: 21, textAlign: "center" }}>
        {t(license ? "licenseTitle" : "helpTitle")}
      </T>
      <T style={{ fontSize: 14, lineHeight: 29, color: theme.secondary }}>
        {license
          ? t(Platform.OS === "web" ? "licenseWeb" : "licenseNotConfigured")
          : t("helpBody")}
      </T>
      <Button
        label={t(license ? "requestLicense" : "helpAction")}
        icon="logo-whatsapp"
        onPress={() =>
          Linking.openURL(
            `https://wa.me/201028965962?text=${encodeURIComponent(t("helpTitle"))}`,
          ).catch(() => notify(t("error")))
        }
      />
    </View>
  );
}
export function SheetHost() {
  const { sheet, open, theme } = useApp();
  const width = useWindowDimensions().width;
  const mobile = width < 700;
  if (!sheet) return null;
  const close = async () => {
    if (
      ["invoice", "party", "money"].includes(sheet.type) &&
      !(await ask(t("close"), t("discardChanges")))
    )
      return;
    open(null);
  };
  const title =
    sheet.type === "invoice" || sheet.type === "money"
      ? t(sheet.kind as TextKey)
      : sheet.type === "party"
        ? t(sheet.kind === "supplier" ? "newSupplier" : "newCustomer")
        : sheet.type === "detail"
          ? t("document")
          : sheet.type === "partyDetail"
            ? t("accounts")
            : sheet.type === "notifications"
              ? t("notifications")
              : sheet.type === "search"
                ? t("searchList")
                : sheet.type === "type"
                  ? t("newType")
                  : sheet.type === "license"
                    ? t("license")
                    : t("help");
  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <SafeAreaView style={{ flex: 1, backgroundColor: "#14251D77" }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{
            flex: 1,
            justifyContent: mobile ? "flex-end" : "center",
            alignItems: "center",
            padding: mobile ? 0 : 24,
          }}
        >
          <Pressable
            accessibilityLabel={t("close")}
            onPress={close}
            style={{
              position: "absolute",
              top: 0,
              bottom: 0,
              left: 0,
              right: 0,
            }}
          />
          <View
            style={{
              width: mobile ? "100%" : 660,
              maxWidth: "100%",
              maxHeight: mobile ? "96%" : "92%",
              backgroundColor: theme.surface,
              borderRadius: mobile ? 22 : 18,
              borderBottomLeftRadius: mobile ? 0 : 18,
              borderBottomRightRadius: mobile ? 0 : 18,
              overflow: "hidden",
              shadowColor: "#000",
              shadowOpacity: 0.18,
              shadowRadius: 40,
              shadowOffset: { width: 0, height: 15 },
            }}
          >
            <Row
              style={{
                paddingHorizontal: 24,
                paddingVertical: 18,
                borderBottomWidth: 1,
                borderColor: theme.border,
                justifyContent: "space-between",
              }}
            >
              <T bold style={{ fontSize: 20 }}>
                {title}
              </T>
              <IconButton label={t("close")} icon="close" onPress={close} />
            </Row>
            <FlatList
              key={`${sheet.type}-${sheet.id || sheet.kind || ""}`}
              data={[]}
              renderItem={() => null}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{
                padding: mobile ? 20 : 25,
                paddingBottom: 30,
              }}
              ListHeaderComponent={
                sheet.type === "invoice" ? (
                  <InvoiceForm
                    kind={sheet.kind as any}
                    id={sheet.id}
                    partyId={sheet.partyId}
                  />
                ) : sheet.type === "party" ? (
                  <PartyForm kind={sheet.kind as any} id={sheet.id} />
                ) : sheet.type === "money" ? (
                  <MoneyForm
                    kind={sheet.kind as any}
                    id={sheet.id}
                    partyId={sheet.partyId}
                  />
                ) : sheet.type === "detail" ? (
                  <DocumentDetail id={sheet.id!} />
                ) : sheet.type === "partyDetail" ? (
                  <PartyDetail id={sheet.id!} />
                ) : sheet.type === "search" ? (
                  <SearchSheet />
                ) : sheet.type === "notifications" ? (
                  <Notifications />
                ) : sheet.type === "type" ? (
                  <TypeForm />
                ) : sheet.type === "license" ? (
                  <LicenseContent />
                ) : (
                  <HelpContent />
                )
              }
            />
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
