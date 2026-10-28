import React from "react";
import { View, Pressable, FlatList, useWindowDimensions } from "react-native";
import { useApp } from "../lib/context";
import { Document, formatDate, money } from "../lib/domain";
import { t } from "../lib/ar";
import { Badge, Empty, Icon, IconName, Row, T } from "./ui";
export const kindIcon: Record<string, IconName> = {
  sale: "arrow-up-outline",
  purchase: "arrow-down-outline",
  receipt: "wallet-outline",
  voucher: "cash-outline",
  expense: "receipt-outline",
};
export function TransactionRow({
  doc,
  compact = false,
}: {
  doc: Document;
  compact?: boolean;
}) {
  const { theme, open } = useApp();
  const width = useWindowDimensions().width;
  const small = width < 800 || compact;
  const green = doc.kind === "sale" || doc.kind === "receipt";
  const status =
    doc.status === "cancelled"
      ? "cancelled"
      : !["sale", "purchase"].includes(doc.kind) || doc.paid >= doc.payable
        ? "paid"
        : doc.paid > 0
          ? "partial"
          : "unpaid";
  return (
    <Pressable
      onPress={() => open({ type: "detail", id: doc.id })}
      style={({ hovered, pressed }: any) => ({
        backgroundColor: hovered || pressed ? theme.surface2 : "transparent",
        paddingVertical: 15,
        paddingHorizontal: 20,
        borderTopWidth: 1,
        borderColor: theme.border,
      })}
    >
      <Row style={{ gap: 13 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 11,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: green ? theme.primarySoft : theme.amberSoft,
          }}
        >
          <Icon
            name={kindIcon[doc.kind]}
            size={18}
            color={green ? theme.primary : theme.amber}
          />
        </View>
        <View style={{ flex: 1 }}>
          <T medium style={{ fontSize: 13 }}>
            {doc.party_name || doc.category || t(doc.kind)}
          </T>
          <T number style={{ fontSize: 11, color: theme.muted }}>
            {doc.doc_no} · {formatDate(doc.occurred_at)}
          </T>
        </View>
        {!small && (
          <View style={{ width: 95, alignItems: "flex-end" }}>
            <T style={{ fontSize: 12, color: theme.secondary }}>
              {t(doc.kind)}
            </T>
          </View>
        )}
        <View style={{ width: small ? 100 : 130, alignItems: "flex-start" }}>
          <T
            number
            bold
            style={{ fontSize: 14, color: green ? theme.primary : theme.text }}
          >
            {money(doc.total)}{" "}
            <T style={{ fontSize: 10, color: theme.muted }}>{t("currency")}</T>
          </T>
          {small && (
            <Badge
              label={t(status)}
              tone={
                status === "paid"
                  ? "green"
                  : status === "cancelled"
                    ? "red"
                    : "amber"
              }
            />
          )}
        </View>
        {!small && (
          <View style={{ width: 95, alignItems: "center" }}>
            <Badge
              label={t(status)}
              tone={
                status === "paid"
                  ? "green"
                  : status === "cancelled"
                    ? "red"
                    : "amber"
              }
            />
          </View>
        )}
        <Icon name="chevron-back" size={14} color={theme.muted} />
      </Row>
    </Pressable>
  );
}
export function Transactions({
  docs,
  compact = false,
  emptyAction,
}: {
  docs: Document[];
  compact?: boolean;
  emptyAction?: () => void;
}) {
  return (
    <FlatList
      scrollEnabled={false}
      data={docs}
      keyExtractor={(d) => d.id}
      renderItem={({ item }) => <TransactionRow doc={item} compact={compact} />}
      ListEmptyComponent={
        <Empty
          compact={compact}
          icon="swap-horizontal-outline"
          title={t("noTransactions")}
          description={t("noTransactionsHint")}
          action={
            emptyAction
              ? { label: t("firstTransaction"), onPress: emptyAction }
              : undefined
          }
        />
      }
    />
  );
}
