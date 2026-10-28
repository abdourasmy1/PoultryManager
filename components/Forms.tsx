import React, { useRef, useState } from "react";
import { View, Pressable, Platform, Switch } from "react-native";
import * as Crypto from "expo-crypto";
import { useApp } from "../lib/context";
import { t, TextKey, expenseNames } from "../lib/ar";
import {
  decimalString,
  inputDate,
  Item,
  Kind,
  lineTotal,
  money,
  normalize,
  parseDate,
  parseDecimal,
  PartyKind,
  weight,
  western,
} from "../lib/domain";
import {
  Badge,
  Button,
  Card,
  Chips,
  Field,
  Icon,
  IconButton,
  Money,
  Row,
  T,
} from "./ui";
import { ask } from "../lib/confirm";
function ErrorText({ message }: { message: string }) {
  const { theme } = useApp();
  return message ? (
    <Row
      style={{
        backgroundColor: theme.redSoft,
        borderRadius: 9,
        padding: 13,
        gap: 9,
      }}
    >
      <Icon name="alert-circle-outline" color={theme.error} />
      <T style={{ fontSize: 12, color: theme.error, flex: 1 }}>{message}</T>
    </Row>
  ) : null;
}
function FormLabel({ title }: { title: string }) {
  const { theme } = useApp();
  return (
    <Row style={{ gap: 8, marginTop: 4, marginBottom: 3 }}>
      <View
        style={{
          height: 15,
          width: 3,
          borderRadius: 2,
          backgroundColor: theme.primary,
        }}
      />
      <T bold style={{ fontSize: 15 }}>
        {title}
      </T>
    </Row>
  );
}
export function PartySelector({
  kind,
  value,
  onChange,
}: {
  kind: PartyKind;
  value: string;
  onChange: (v: string) => void;
}) {
  const { repo, theme, refresh, notify } = useApp();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const parties = repo!.parties(kind, query, query.trim() ? 1000 : 200);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      const id = Crypto.randomUUID();
      await repo!.saveParty({
        id,
        kind,
        name: newName,
        phone: "",
        address: "",
        notes: "",
        opening: 0,
      });
      refresh();
      onChange(id);
      setAdding(false);
      setNewName("");
    } catch (e: any) {
      notify(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 10 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <T medium style={{ fontSize: 13 }}>
          {t(kind === "customer" ? "selectCustomer" : "selectSupplier")}
        </T>
        <Button
          variant="ghost"
          small
          icon="add"
          label={t(kind === "customer" ? "newCustomer" : "newSupplier")}
          onPress={() => setAdding(!adding)}
        />
      </Row>
      {adding ? (
        <Card style={{ padding: 14, gap: 12, backgroundColor: theme.surface2 }}>
          <Field label={t("name")} value={newName} onChangeText={setNewName} />
          <Row style={{ gap: 8 }}>
            <Button
              small
              label={t("save")}
              icon="checkmark"
              onPress={save}
              loading={busy}
            />
            <Button
              small
              label={t("cancel")}
              variant="ghost"
              onPress={() => setAdding(false)}
            />
          </Row>
        </Card>
      ) : null}
      <Field label={t("searchList")} value={query} onChangeText={setQuery} />
      <Row style={{ gap: 7, flexWrap: "wrap" }}>
        {parties.map((p) => (
            <Pressable
              key={p.id}
              onPress={() => onChange(p.id)}
              style={{
                borderWidth: 1,
                borderColor: value === p.id ? theme.primary : theme.border,
                backgroundColor:
                  value === p.id ? theme.primarySoft : theme.surface2,
                borderRadius: 9,
                paddingVertical: 10,
                paddingHorizontal: 14,
              }}
            >
              <T
                medium
                style={{
                  fontSize: 12,
                  color: value === p.id ? theme.primary : theme.secondary,
                }}
              >
                {p.name}
              </T>
            </Pressable>
          ))}
      </Row>
      {!parties.length && !adding && (
        <T style={{ fontSize: 12, color: theme.amber }}>
          {t(kind === "supplier" ? "noParty" : "noCustomersHint")}
        </T>
      )}
    </View>
  );
}
type DraftItem = {
  type_id: number;
  quantity: string;
  cages: string;
  weight: string;
  price: string;
};
export function InvoiceForm({
  kind,
  id,
  partyId,
}: {
  kind: "sale" | "purchase";
  id?: string;
  partyId?: string;
}) {
  const { repo, theme, open, refresh, notify } = useApp();
  const old = id ? repo!.document(id) : undefined;
  const types = repo!.inventory(true);
  const allTypes = repo!.inventory(false);
  const uuid = useRef(id || Crypto.randomUUID());
  const savingRef = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [party, setParty] = useState(
    old?.party_id || partyId || (kind === "sale" ? "walk-in" : ""),
  );
  const [date, setDate] = useState(inputDate(old?.occurred_at));
  const [notes, setNotes] = useState(old?.notes || "");
  const initial: DraftItem = {
    type_id: types[0]?.id || allTypes[0]?.id || 0,
    quantity: "",
    cages: "0",
    weight: "",
    price: "",
  };
  const [items, setItems] = useState<DraftItem[]>(
    old?.items?.map((i) => ({
      type_id: i.type_id,
      quantity: String(i.quantity),
      cages: String(i.cages),
      weight: decimalString(i.weight, 3),
      price: decimalString(i.price),
    })) || [{ ...initial }],
  );
  const [transport, setTransport] = useState(
    old ? decimalString(old.transport) : "",
  );
  const [other, setOther] = useState(old ? decimalString(old.other) : "");
  const [charge, setCharge] = useState(!!old?.charge_extras);
  const [paid, setPaid] = useState(old ? decimalString(old.paid) : "");
  const [method, setMethod] = useState(old?.method || t("cash"));
  const update = (n: number, key: keyof DraftItem, value: any) =>
    setItems((current) =>
      current.map((i, j) => (j === n ? { ...i, [key]: value } : i)),
    );
  const safe = (s: string, d = 2) => {
    try {
      return parseDecimal(s, d);
    } catch {
      return 0;
    }
  };
  const total = items.reduce(
    (n, i) => n + lineTotal(safe(i.weight, 3), safe(i.price)),
    0,
  );
  const extra = kind === "purchase" ? safe(transport) + safe(other) : 0;
  const payable = total + (charge ? extra : 0);
  if (!types.length) {
    return (
      <View style={{ gap: 16 }}>
        <T style={{ fontSize: 13, color: theme.secondary }}>
          {t("noActiveTypes")}
        </T>
        <Button
          variant="soft"
          label={t("manageTypes")}
          onPress={() => open({ type: "type" })}
        />
      </View>
    );
  }
  const save = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    try {
      const values: Item[] = items.map((i) => ({
        type_id: i.type_id,
        quantity: parseDecimal(i.quantity, 0),
        cages: parseDecimal(i.cages, 0),
        weight: parseDecimal(i.weight, 3),
        price: parseDecimal(i.price),
        total: 0,
        cogs: 0,
        transport: 0,
        other: 0,
      }));
      await repo!.saveDocument({
        id: uuid.current,
        kind,
        party_id: party,
        occurred_at: parseDate(date),
        items: values,
        transport: parseDecimal(transport),
        other: parseDecimal(other),
        charge_extras: charge,
        paid: parseDecimal(paid),
        notes,
        method,
      });
      refresh();
      notify(t("done"));
      open({ type: "detail", id: uuid.current });
    } catch (e: any) {
      setError(e.message || t("error"));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };
  return (
    <View style={{ gap: 20 }}>
      <PartySelector
        kind={kind === "sale" ? "customer" : "supplier"}
        value={party}
        onChange={setParty}
      />
      <Field
        label={`${t("date")} · ${t("dateHint")}`}
        value={date}
        onChangeText={setDate}
      />
      <FormLabel title={t("itemDetails")} />
      {items.map((item, n) => (
        <Card
          key={n}
          style={{ padding: 17, gap: 14, backgroundColor: theme.surface2 }}
        >
          <Row style={{ justifyContent: "space-between" }}>
            <T bold style={{ fontSize: 13 }}>
              {t("poultry")} {items.length > 1 ? n + 1 : ""}
            </T>
            {items.length > 1 && (
              <IconButton
                icon="trash-outline"
                label={t("delete")}
                color={theme.error}
                size={28}
                onPress={() => setItems(items.filter((_, i) => i !== n))}
              />
            )}
          </Row>
          <Chips
            value={String(item.type_id)}
            onChange={(v) => update(n, "type_id", Number(v))}
            options={types.map((p) => ({ value: String(p.id), label: p.name }))}
          />
          {kind === "sale" && (
            <Row style={{ gap: 5 }}>
              <Icon name="cube-outline" size={13} color={theme.primary} />
              <T style={{ fontSize: 11, color: theme.primary }}>
                {t("available")}:{" "}
                {weight(types.find((p) => p.id === item.type_id)?.weight || 0)}{" "}
                {t("kg")}
              </T>
            </Row>
          )}
          <Row style={{ gap: 14 }}>
            <Field
              label={t("quantity")}
              keyboardType="number-pad"
              value={item.quantity}
              onChangeText={(v) => update(n, "quantity", v)}
              placeholder="0"
            />
            <Field
              label={t("cages")}
              keyboardType="number-pad"
              value={item.cages}
              onChangeText={(v) => update(n, "cages", v)}
              placeholder="0"
            />
          </Row>
          <Row style={{ gap: 14 }}>
            <Field
              label={t("weight")}
              keyboardType="decimal-pad"
              value={item.weight}
              onChangeText={(v) => update(n, "weight", v)}
              placeholder="0.000"
            />
            <Field
              label={`${t("price")} (${t("currency")})`}
              keyboardType="decimal-pad"
              value={item.price}
              onChangeText={(v) => update(n, "price", v)}
              placeholder="0.00"
            />
          </Row>
          <Row
            style={{
              justifyContent: "space-between",
              borderTopWidth: 1,
              borderColor: theme.border,
              paddingTop: 11,
            }}
          >
            <T style={{ fontSize: 12, color: theme.secondary }}>{t("total")}</T>
            <Money
              value={lineTotal(safe(item.weight, 3), safe(item.price))}
              size={21}
            />
          </Row>
        </Card>
      ))}
      <Button
        label={t("addItem")}
        variant="outline"
        icon="add"
        onPress={() => setItems([...items, { ...initial }])}
      />
      {kind === "purchase" && (
        <View style={{ gap: 14 }}>
          <FormLabel title={t("costs")} />
          <Row style={{ gap: 14 }}>
            <Field
              label={t("transport")}
              keyboardType="decimal-pad"
              value={transport}
              onChangeText={setTransport}
              placeholder="0.00"
            />
            <Field
              label={t("otherCosts")}
              keyboardType="decimal-pad"
              value={other}
              onChangeText={setOther}
              placeholder="0.00"
            />
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <T style={{ fontSize: 12 }}>{t("chargeExtras")}</T>
            <Switch
              accessibilityLabel={t("chargeExtras")}
              value={charge}
              onValueChange={setCharge}
              trackColor={{ true: theme.primary, false: theme.border }}
            />
          </Row>
          <T style={{ fontSize: 11, color: theme.amber }}>{t("costsHint")}</T>
        </View>
      )}
      <FormLabel title={t("paymentDetails")} />
      <Field
        label={`${t("paidAmount")} (${t("currency")})`}
        keyboardType="decimal-pad"
        value={paid}
        onChangeText={setPaid}
        editable={!old}
        placeholder="0.00"
      />
      {!old && (
        <Row style={{ gap: 8 }}>
          <Button
            small
            variant="soft"
            label={t("fullAmount")}
            onPress={() => setPaid(decimalString(payable))}
          />
          <Button
            small
            variant="outline"
            label={t("noPayment")}
            onPress={() => setPaid("0")}
          />
        </Row>
      )}
      <Chips
        value={method}
        onChange={setMethod}
        options={(["cash", "bank", "other"] as TextKey[]).map((k) => ({
          value: t(k),
          label: t(k),
        }))}
      />
      <Field
        label={`${t("notes")} (${t("optional")})`}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <Card
        style={{
          padding: 19,
          gap: 12,
          backgroundColor: theme.primarySoft,
          borderColor: theme.primarySoft,
        }}
      >
        <Row style={{ justifyContent: "space-between" }}>
          <T bold>{t("total")}</T>
          <Money value={total} size={24} />
        </Row>
        {kind === "purchase" && (
          <Row style={{ justifyContent: "space-between" }}>
            <T style={{ fontSize: 12 }}>{t("actualCost")}</T>
            <Money value={total + extra} size={19} />
          </Row>
        )}
        <Row style={{ justifyContent: "space-between" }}>
          <T style={{ fontSize: 12, color: theme.secondary }}>
            {t("remaining")}
          </T>
          <Money value={payable - safe(paid)} size={20} />
        </Row>
      </Card>
      <ErrorText message={error} />
      <Button
        label={t(old ? "saveChanges" : "saveInvoice")}
        icon="checkmark-circle-outline"
        onPress={save}
        loading={saving}
      />
    </View>
  );
}
export function PartyForm({ kind, id }: { kind: PartyKind; id?: string }) {
  const { repo, theme, refresh, notify, open } = useApp();
  const old = id ? repo!.party(id) : undefined;
  const uuid = useRef(id || Crypto.randomUUID());
  const [name, setName] = useState(old?.name || "");
  const [phone, setPhone] = useState(old?.phone || "");
  const [address, setAddress] = useState(old?.address || "");
  const [notes, setNotes] = useState(old?.notes || "");
  const [balance, setBalance] = useState(
    old ? decimalString(Math.abs(old.opening)) : "",
  );
  const [sign, setSign] = useState(old && old.opening < 0 ? "owed" : "owes");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [numbers, setNumbers] = useState<{ label: string; number: string }[]>(
    [],
  );
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await repo!.saveParty({
        id: uuid.current,
        kind,
        name,
        phone: western(phone),
        address,
        notes,
        opening: parseDecimal(balance) * (sign === "owed" ? -1 : 1),
      });
      refresh();
      notify(t("done"));
      open({ type: "partyDetail", id: uuid.current });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const contacts = async () => {
    if (Platform.OS === "web") {
      notify(t("contactUnavailable"));
      return;
    }
    try {
      const { Contact, ContactField } = await import("expo-contacts");
      const contact = await Contact.presentPicker();
      if (!contact) return;
      const data = await contact.getDetails([
        ContactField.FULL_NAME,
        ContactField.PHONES,
        ContactField.ADDRESSES,
      ] as const);
      if ((name || phone) && !(await ask(t("contacts"), t("replaceContact"))))
        return;
      setName(data.fullName || data.phones?.[0]?.number || "");
      if (data.phones?.length === 1)
        setPhone(western(data.phones[0].number || "").replace(/[\s\-()]/g, ""));
      else if ((data.phones?.length || 0) > 1)
        setNumbers(
          data.phones!.map((p) => ({
            label: p.label || t("phone"),
            number: p.number || "",
          })),
        );
      if (!address && data.addresses?.[0]) {
        const a = data.addresses[0] as any;
        setAddress([a.street, a.city, a.region].filter(Boolean).join("، "));
      }
    } catch (e: any) {
      notify(e.message || t("contactUnavailable"));
    }
  };
  return (
    <View style={{ gap: 20 }}>
      <Button
        variant="soft"
        icon="person-circle-outline"
        label={t("contacts")}
        onPress={contacts}
      />
      {numbers.length > 0 && (
        <Card style={{ padding: 16, gap: 8 }}>
          <T medium>{t("phone")}</T>
          {numbers.map((n, i) => (
            <Button
              key={i}
              variant="outline"
              label={`${n.label} · ${n.number}`}
              onPress={() => {
                setPhone(western(n.number).replace(/[\s\-()]/g, ""));
                setNumbers([]);
              }}
            />
          ))}
        </Card>
      )}
      <Field label={t("name")} value={name} onChangeText={setName} />
      <Field
        label={`${t("phone")} (${t("optional")})`}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <Field
        label={`${t("address")} (${t("optional")})`}
        value={address}
        onChangeText={setAddress}
      />
      <View style={{ gap: 11 }}>
        <Field
          label={t("opening")}
          value={balance}
          onChangeText={setBalance}
          keyboardType="decimal-pad"
          placeholder="0.00"
        />
        <Chips
          value={sign}
          onChange={setSign}
          options={[
            { value: "owes", label: t("owes") },
            { value: "owed", label: t("owed") },
          ]}
        />
      </View>
      <Field
        label={`${t("notes")} (${t("optional")})`}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      <ErrorText message={error} />
      <Button
        label={t(old ? "saveChanges" : "save")}
        icon="checkmark"
        onPress={save}
        loading={busy}
      />
    </View>
  );
}
export function MoneyForm({
  kind,
  id,
  partyId,
}: {
  kind: "receipt" | "voucher" | "expense";
  id?: string;
  partyId?: string;
}) {
  const { repo, theme, refresh, notify, open } = useApp();
  const old = id ? repo!.document(id) : undefined;
  const uuid = useRef(id || Crypto.randomUUID());
  const [party, setParty] = useState(old?.party_id || partyId || "");
  const [amount, setAmount] = useState(old ? decimalString(old.total) : "");
  const [date, setDate] = useState(inputDate(old?.occurred_at));
  const [category, setCategory] = useState(old?.category || expenseNames[0]);
  const [notes, setNotes] = useState(old?.notes || "");
  const [method, setMethod] = useState(old?.method || t("cash"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const selected = repo!.party(party);
  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const total = parseDecimal(amount);
      if (
        kind !== "expense" &&
        selected &&
        total > Math.abs(selected.balance) &&
        !(await ask(t("confirm"), t("overBalance")))
      ) {
        setBusy(false);
        return;
      }
      await repo!.saveDocument({
        id: uuid.current,
        kind,
        party_id: kind === "expense" ? undefined : party,
        amount: total,
        occurred_at: parseDate(date),
        category: kind === "expense" ? category : "",
        notes,
        method,
      });
      refresh();
      notify(t("done"));
      open({ type: "detail", id: uuid.current });
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 20 }}>
      {kind !== "expense" ? (
        <PartySelector
          kind={kind === "receipt" ? "customer" : "supplier"}
          value={party}
          onChange={setParty}
        />
      ) : (
        <View style={{ gap: 12 }}>
          <T medium>{t("category")}</T>
          <Chips
            value={category}
            onChange={setCategory}
            options={expenseNames.map((c) => ({ value: c, label: c }))}
          />
        </View>
      )}
      {selected && (
        <Card style={{ padding: 17, backgroundColor: theme.surface2 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <T>{t("balance")}</T>
            <Money value={Math.abs(selected.balance)} size={23} />
          </Row>
        </Card>
      )}
      <Field
        label={`${t("amount")} (${t("currency")})`}
        value={amount}
        onChangeText={setAmount}
        keyboardType="decimal-pad"
        placeholder="0.00"
      />
      {selected && (
        <Button
          small
          label={t("fullAmount")}
          variant="soft"
          onPress={() => setAmount(decimalString(Math.abs(selected.balance)))}
        />
      )}
      <Field
        label={`${t("date")} · ${t("dateHint")}`}
        value={date}
        onChangeText={setDate}
      />
      <View style={{ gap: 10 }}>
        <T medium>{t("paymentMethod")}</T>
        <Chips
          value={method}
          onChange={setMethod}
          options={(["cash", "bank", "other"] as TextKey[]).map((k) => ({
            label: t(k),
            value: t(k),
          }))}
        />
      </View>
      <Field
        label={t(kind === "expense" ? "description" : "notes")}
        value={notes}
        onChangeText={setNotes}
        multiline
      />
      {kind !== "expense" && (
        <T style={{ fontSize: 12, color: theme.muted }}>
          {t(kind === "receipt" ? "receiptHint" : "voucherHint")}
        </T>
      )}
      <ErrorText message={error} />
      <Button
        label={t(old ? "saveChanges" : "save")}
        icon="checkmark"
        onPress={save}
        loading={busy}
      />
    </View>
  );
}
export function TypeForm() {
  const { repo, refresh, open, notify, theme } = useApp();
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const types = repo!.inventory(false);
  const q = normalize(query);
  const filtered = q ? types.filter((p) => normalize(p.name).includes(q)) : types;
  const busy = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
      refresh();
      notify(t("done"));
    } catch (e: any) {
      setError(e.message || t("error"));
    }
  };
  return (
    <View style={{ gap: 18 }}>
      <Card style={{ padding: 16, gap: 12, backgroundColor: theme.surface2 }}>
        <T medium>{t("manageTypes")}</T>
        <Field label={t("searchList")} value={query} onChangeText={setQuery} />
        <Field label={t("name")} value={name} onChangeText={setName} />
        <Button
          label={t("newType")}
          icon="add"
          onPress={() =>
            busy(async () => {
              await repo!.addType(name);
              setName("");
            })
          }
        />
      </Card>
      <ErrorText message={error} />
      <View style={{ gap: 12 }}>
        {filtered.map((item) => {
          const current = drafts[item.id] ?? item.name;
          return (
            <Card key={item.id} style={{ padding: 16, gap: 10 }}>
              <Row style={{ justifyContent: "space-between", gap: 10 }}>
                <Badge label={item.active === 0 ? t("inactive") : t("active")} tone={item.active === 0 ? "amber" : "green"} />
                <Row style={{ gap: 8 }}>
                  <Button
                    small
                    variant="outline"
                    icon="arrow-up-outline"
                    label={t("moveUp")}
                    onPress={() => busy(async () => repo!.moveType(item.id, -1))}
                  />
                  <Button
                    small
                    variant="outline"
                    icon="arrow-down-outline"
                    label={t("moveDown")}
                    onPress={() => busy(async () => repo!.moveType(item.id, 1))}
                  />
                </Row>
              </Row>
              <Field
                label={t("name")}
                value={current}
                onChangeText={(v) => setDrafts((s) => ({ ...s, [item.id]: v }))}
              />
              <Row style={{ gap: 8, flexWrap: "wrap" }}>
                <Button
                  small
                  icon="checkmark"
                  label={t("save")}
                  onPress={() => busy(async () => repo!.updateType(item.id, current))}
                />
                <Button
                  small
                  variant="soft"
                  icon={item.active === 0 ? "play-outline" : "archive-outline"}
                  label={t(item.active === 0 ? "restore" : "archive")}
                  onPress={() => busy(async () => repo!.setTypeActive(item.id, item.active === 0))}
                />
                <Button
                  small
                  variant="outline"
                  icon="trash-outline"
                  label={t("delete")}
                  onPress={() =>
                    ask(t("delete"), t("typeDeleteWarning")).then((ok) => {
                      if (ok) busy(async () => repo!.deleteType(item.id));
                    })
                  }
                />
              </Row>
            </Card>
          );
        })}
      </View>
    </View>
  );
}
