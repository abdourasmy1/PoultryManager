import React, { useState } from "react";
import { View, useWindowDimensions } from "react-native";
import { Chips } from "../components/ui";
import { t } from "../lib/ar";
import { DocumentScreen } from "./BusinessScreens";
export default function PaymentsScreen() {
  const [kind, setKind] = useState<"receipt" | "voucher">("receipt");
  const width = useWindowDimensions().width;
  return (
    <View style={{ flex: 1 }}>
      <View
        style={{ paddingTop: 20, paddingHorizontal: width < 700 ? 18 : 29 }}
      >
        <Chips
          value={kind}
          onChange={setKind}
          options={[
            { value: "receipt", label: t("receipt") },
            { value: "voucher", label: t("voucher") },
          ]}
        />
      </View>
      <DocumentScreen key={kind} kind={kind} />
    </View>
  );
}
